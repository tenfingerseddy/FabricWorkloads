# Fabric Notebook: NB_ObsAlerts
# Evaluates SLO metrics against alert rules and fires notifications
#
# Schedule: Every 15 minutes
# Dependencies: EH_Observability Eventhouse with FabricEvents, SloDefinitions, AlertRules tables

# Cell 1: Configuration
# ─────────────────────────────────────────────────────────────────────────────

import requests
import json
from datetime import datetime, timezone, timedelta

# Authentication: Try notebookutils (Fabric-native) first, fall back to spark.conf
USE_FABRIC_NATIVE_AUTH = True
try:
    import notebookutils
    print("Using Fabric-native authentication (notebookutils)")
except ImportError:
    USE_FABRIC_NATIVE_AUTH = False
    print("notebookutils not available, falling back to service principal")

# Service Principal credentials (only needed if notebookutils unavailable)
TENANT_ID = spark.conf.get("spark.obs.tenantId", "")
CLIENT_ID = spark.conf.get("spark.obs.clientId", "")
CLIENT_SECRET = spark.conf.get("spark.obs.clientSecret", "")

# Target Eventhouse
KUSTO_URI = "https://trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com"
KUSTO_DB = "EH_Observability"

# Alert thresholds (defaults — overridden per item by SloDefinitions table)
DEFAULT_MIN_SUCCESS_RATE = 0.995
DEFAULT_MAX_FRESHNESS_HOURS = 24.0
DEFAULT_DURATION_REGRESSION_MULTIPLIER = 2.0
DEFAULT_MAX_CONSECUTIVE_FAILURES = 3

# Teams webhook (optional)
TEAMS_WEBHOOK_URL = spark.conf.get("spark.obs.teamsWebhook", "")

print(f"[{datetime.now(timezone.utc).isoformat()}] NB_ObsAlerts starting")

# Cell 2: Authentication
# ─────────────────────────────────────────────────────────────────────────────

def get_kusto_token():
    """Acquire Kusto/Eventhouse access token."""
    if USE_FABRIC_NATIVE_AUTH:
        return notebookutils.credentials.getToken(KUSTO_URI)
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": f"{KUSTO_URI}/.default",
        "grant_type": "client_credentials",
    }
    resp = requests.post(url, data=data)
    resp.raise_for_status()
    return resp.json()["access_token"]

kusto_token = get_kusto_token()
print("Authentication successful")

# Cell 3: Query SLO metrics from Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

def kql_query(query):
    """Execute a KQL query and return rows as list of dicts."""
    resp = requests.post(
        f"{KUSTO_URI}/v2/rest/query",
        headers={
            "Authorization": f"Bearer {kusto_token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": query},
    )
    resp.raise_for_status()
    frames = resp.json()

    rows = []
    columns = []
    for frame in frames:
        if frame.get("FrameType") == "DataTable" and frame.get("TableName") == "PrimaryResult":
            columns = [col["ColumnName"] for col in frame.get("Columns", [])]
            for row in frame.get("Rows", []):
                rows.append(dict(zip(columns, row)))
    return rows

def kql_mgmt(command):
    """Execute a KQL management command."""
    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/mgmt",
        headers={
            "Authorization": f"Bearer {kusto_token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": command},
    )
    resp.raise_for_status()
    return resp

# Get success rate per item (last 7 days)
success_rate_query = """
FabricEvents
| where coalesce(StartTimeUtc, IngestedAt) > ago(7d)
| where Status in ("Completed", "Failed")
| summarize
    TotalRuns = count(),
    SuccessfulRuns = countif(Status == "Completed"),
    FailedRuns = countif(Status == "Failed")
    by ItemId, ItemName, ItemType, WorkspaceId, WorkspaceName
| extend SuccessRate = todouble(SuccessfulRuns) / TotalRuns
"""
success_metrics = kql_query(success_rate_query)
print(f"Retrieved success metrics for {len(success_metrics)} items")

# Get P95 duration (current week vs baseline)
duration_query = """
let CurrentWeek = FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Completed" and DurationSeconds > 0
| summarize CurrentP95 = percentile(DurationSeconds, 95) by ItemId, ItemName, WorkspaceId, WorkspaceName;
let Baseline = FabricEvents
| where StartTimeUtc between (ago(30d) .. ago(7d))
| where Status == "Completed" and DurationSeconds > 0
| summarize BaselineP95 = percentile(DurationSeconds, 95) by ItemId;
CurrentWeek
| join kind=leftouter Baseline on ItemId
| project ItemId, ItemName, WorkspaceId, WorkspaceName, CurrentP95, BaselineP95
"""
duration_metrics = kql_query(duration_query)
print(f"Retrieved duration metrics for {len(duration_metrics)} items")

# Get freshness (hours since last success)
freshness_query = """
FabricEvents
| where Status == "Completed"
| summarize LastSuccess = max(EndTimeUtc) by ItemId, ItemName, ItemType, WorkspaceId, WorkspaceName
| extend HoursSinceSuccess = datetime_diff('second', now(), LastSuccess) / 3600.0
"""
freshness_metrics = kql_query(freshness_query)
print(f"Retrieved freshness metrics for {len(freshness_metrics)} items")

# Get consecutive failures (robust run-length encoding approach)
consec_failures_query = """
FabricEvents
| where StartTimeUtc > ago(7d)
| order by ItemId asc, StartTimeUtc desc
| serialize
| extend IsNewGroup = iff(ItemId != prev(ItemId) or Status != prev(Status), 1, 0)
| extend GroupId = row_cumsum(IsNewGroup)
| where Status == "Failed"
| summarize ConsecFails = count(), FirstFail = min(StartTimeUtc), LastFail = max(StartTimeUtc)
    by GroupId, ItemId, ItemName, WorkspaceId, WorkspaceName
| where ConsecFails >= 3
| project-away GroupId
"""
consec_failures = kql_query(consec_failures_query)
print(f"Found {len(consec_failures)} items with consecutive failures")

# Cell 3.5: Load SLO definitions from Eventhouse
# ─────────────────────────────────────────────────────────────────────────────
# SloDefinitions table overrides hardcoded DEFAULT_* thresholds per item.
# If no SLO is defined for an item, the defaults still apply.

slo_definitions_query = """
SloDefinitions
| where IsActive == true
| project SloId, ItemId, ItemName, MetricType, TargetValue, WarningThreshold, EvaluationWindow
"""
try:
    slo_definitions = kql_query(slo_definitions_query)
    print(f"Loaded {len(slo_definitions)} active SLO definitions from Eventhouse")
except Exception as e:
    print(f"Warning: Could not load SloDefinitions table ({e}). Using defaults only.")
    slo_definitions = []

# Build per-item threshold lookups keyed by (ItemId, MetricType)
# Each entry stores the SLO definition so we can reference SloId, etc.
slo_lookup = {}
for slo in slo_definitions:
    key = (slo["ItemId"], slo["MetricType"])
    slo_lookup[key] = slo

def get_slo(item_id, slo_type, default_target, default_warning=None):
    """Get SLO thresholds for a specific item and metric type.
    Returns (target_value, warning_threshold, severity, slo_id).
    Falls back to defaults if no SLO definition exists."""
    slo = slo_lookup.get((item_id, slo_type))
    if slo:
        target = slo["TargetValue"]
        warning = slo.get("WarningThreshold") or default_warning or target
        severity = slo.get("Severity", "warning")
        slo_id = slo.get("SloId", "")
        return target, warning, severity, slo_id
    return default_target, default_warning or default_target, "warning", ""

print(f"SLO lookup built: {len(slo_lookup)} item-specific overrides available")

# Cell 4: Evaluate alert rules
# ─────────────────────────────────────────────────────────────────────────────

alerts = []
slo_snapshots = []  # Collect SLO metric snapshots for trend tracking
now_iso = datetime.now(timezone.utc).isoformat()

# 1. Success rate violations
for m in success_metrics:
    if m["TotalRuns"] < 3:
        continue
    rate = m["SuccessRate"]
    item_id = m["ItemId"]

    target, warning, base_severity, slo_id = get_slo(
        item_id, "success_rate", DEFAULT_MIN_SUCCESS_RATE, DEFAULT_MIN_SUCCESS_RATE * 0.8
    )

    is_breached = rate < target
    # Error budget: if target is 99.5%, budget is 0.5%. Consumed = (target - actual) / (1 - target)
    error_budget_total = 1.0 - target if target < 1.0 else 0.005
    error_budget_used = max(0.0, (target - rate) / error_budget_total) if error_budget_total > 0 else 0.0
    error_budget_used = min(error_budget_used, 1.0)

    slo_snapshots.append({
        "SloId": slo_id or f"default_success_rate_{item_id}",
        "ItemId": item_id,
        "ItemName": m["ItemName"],
        "MetricType": "success_rate",
        "CurrentValue": round(rate, 6),
        "TargetValue": target,
        "IsBreaching": 1 if is_breached else 0,
        "ErrorBudgetRemaining": round(1.0 - error_budget_used, 4),
    })

    if is_breached:
        severity = "critical" if rate < warning else base_severity
        alerts.append({
            "Kind": "success_rate_violation",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": item_id,
            "ItemName": m["ItemName"],
            "Message": f"Success rate {rate*100:.1f}% below {target*100:.1f}% SLO",
            "Value": round(rate, 4),
            "Threshold": target,
            "Timestamp": now_iso,
        })

# 2. Duration regressions
for m in duration_metrics:
    baseline = m.get("BaselineP95")
    current = m.get("CurrentP95")
    item_id = m["ItemId"]

    if not baseline or baseline <= 0 or not current:
        continue

    ratio = current / baseline
    target_multiplier, warning_multiplier, base_severity, slo_id = get_slo(
        item_id, "duration_p95", DEFAULT_DURATION_REGRESSION_MULTIPLIER, 3.0
    )

    is_breached = ratio > target_multiplier
    # Error budget: how far into the regression zone (1x to target_multiplier is healthy)
    budget_range = target_multiplier - 1.0 if target_multiplier > 1.0 else 1.0
    error_budget_used = max(0.0, (ratio - 1.0) / budget_range)
    error_budget_used = min(error_budget_used, 1.0)

    slo_snapshots.append({
        "SloId": slo_id or f"default_duration_p95_{item_id}",
        "ItemId": item_id,
        "ItemName": m["ItemName"],
        "MetricType": "duration_p95",
        "CurrentValue": round(current, 1),
        "TargetValue": round(baseline * target_multiplier, 1),
        "IsBreaching": 1 if is_breached else 0,
        "ErrorBudgetRemaining": round(1.0 - error_budget_used, 4),
    })

    if is_breached:
        severity = "critical" if ratio > warning_multiplier else base_severity
        alerts.append({
            "Kind": "duration_regression",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": item_id,
            "ItemName": m["ItemName"],
            "Message": f"P95 duration {current:.0f}s is {ratio:.1f}x baseline ({baseline:.0f}s)",
            "Value": round(current, 1),
            "Threshold": round(baseline * target_multiplier, 1),
            "Timestamp": now_iso,
        })

# 3. Freshness violations
for m in freshness_metrics:
    hours = m.get("HoursSinceSuccess", 0)
    item_id = m["ItemId"]

    target_hours, warning_hours, base_severity, slo_id = get_slo(
        item_id, "freshness", DEFAULT_MAX_FRESHNESS_HOURS, DEFAULT_MAX_FRESHNESS_HOURS * 2
    )

    is_breached = hours > target_hours
    # Error budget: fraction of freshness limit consumed
    error_budget_used = hours / target_hours if target_hours > 0 else 0.0
    error_budget_used = min(error_budget_used, 1.0)

    slo_snapshots.append({
        "SloId": slo_id or f"default_freshness_{item_id}",
        "ItemId": item_id,
        "ItemName": m["ItemName"],
        "MetricType": "freshness",
        "CurrentValue": round(hours, 1),
        "TargetValue": target_hours,
        "IsBreaching": 1 if is_breached else 0,
        "ErrorBudgetRemaining": round(1.0 - error_budget_used, 4),
    })

    if is_breached:
        severity = "critical" if hours > warning_hours else base_severity
        alerts.append({
            "Kind": "freshness_violation",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": item_id,
            "ItemName": m["ItemName"],
            "Message": f"Last success was {hours:.1f}h ago (limit: {target_hours}h)",
            "Value": round(hours, 1),
            "Threshold": target_hours,
            "Timestamp": now_iso,
        })

# 4. Consecutive failures
for m in consec_failures:
    count = m.get("ConsecFails", 0)
    item_id = m["ItemId"]

    target_max, warning_max, base_severity, slo_id = get_slo(
        item_id, "consecutive_failures", DEFAULT_MAX_CONSECUTIVE_FAILURES, 5
    )

    is_breached = count >= target_max
    error_budget_used = count / target_max if target_max > 0 else 1.0
    error_budget_used = min(error_budget_used, 1.0)

    slo_snapshots.append({
        "SloId": slo_id or f"default_consec_failures_{item_id}",
        "ItemId": item_id,
        "ItemName": m["ItemName"],
        "MetricType": "consecutive_failures",
        "CurrentValue": float(count),
        "TargetValue": float(target_max),
        "IsBreaching": 1 if is_breached else 0,
        "ErrorBudgetRemaining": round(1.0 - error_budget_used, 4),
    })

    if is_breached:
        severity = "critical" if count >= warning_max else base_severity
        alerts.append({
            "Kind": "consecutive_failures",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": item_id,
            "ItemName": m["ItemName"],
            "Message": f"{count} consecutive failures detected",
            "Value": count,
            "Threshold": float(target_max),
            "Timestamp": now_iso,
        })

print(f"\nEvaluated alerts: {len(alerts)} triggered")
for a in alerts:
    emoji = "🔴" if a["Severity"] == "critical" else "🟡" if a["Severity"] == "warning" else "🔵"
    print(f"  {emoji} [{a['Severity'].upper()}] {a['ItemName']}: {a['Message']}")

print(f"\nSLO snapshots collected: {len(slo_snapshots)}")

# Cell 4.5: Write SLO snapshots to Eventhouse
# ─────────────────────────────────────────────────────────────────────────────
# Record point-in-time SLO metric values for trend tracking and dashboards.

# SloSnapshots table schema (verified from live Eventhouse):
# SnapshotId: guid, SloId: guid, ItemId: guid, MetricType: string,
# CurrentValue: real, TargetValue: real, IsBreaching: bool,
# ErrorBudgetRemaining: real, ComputedAt: datetime

import uuid

snapshot_ingested = 0
for snap in slo_snapshots:
    snapshot_id = str(uuid.uuid4())
    slo_id = snap["SloId"]
    # SloId may not be a valid guid if it's a default — generate one
    if not slo_id or slo_id.startswith("default_"):
        slo_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, snap["SloId"]))

    # Column order matches actual table: SnapshotId, SloId, ItemId, MetricType,
    # CurrentValue, TargetValue, IsBreaching, ErrorBudgetRemaining, ComputedAt
    # Use pipe delimiter to avoid issues with commas in values
    values = "|".join([
        snapshot_id,
        slo_id,
        snap["ItemId"],
        snap["MetricType"],
        str(snap["CurrentValue"]),
        str(snap["TargetValue"]),
        str(snap["IsBreaching"]),
        str(snap["ErrorBudgetRemaining"]),
        now_iso,
    ])
    csl = f".ingest inline into table SloSnapshots with (format=psv) <| {values}"

    try:
        resp = kql_mgmt(csl)
        if resp.status_code == 200:
            snapshot_ingested += 1
    except Exception as e:
        print(f"  Warning: Failed to ingest snapshot for {snap.get('ItemName', '?')}/{snap['MetricType']}: {e}")

print(f"Ingested {snapshot_ingested}/{len(slo_snapshots)} SLO snapshots to SloSnapshots table")

# Cell 5: Send notifications
# ─────────────────────────────────────────────────────────────────────────────

def send_teams_notification(alerts):
    """Send alert summary to Microsoft Teams via webhook."""
    if not TEAMS_WEBHOOK_URL or not alerts:
        return 0

    critical = [a for a in alerts if a["Severity"] == "critical"]
    warnings = [a for a in alerts if a["Severity"] == "warning"]

    facts = []
    for a in (critical + warnings)[:10]:  # Limit to top 10
        emoji = "🔴" if a["Severity"] == "critical" else "🟡"
        facts.append({
            "name": f"{emoji} {a['ItemName']}",
            "value": a["Message"]
        })

    card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000" if critical else "FFA500",
        "summary": f"Fabric Observability: {len(alerts)} alert(s)",
        "sections": [{
            "activityTitle": f"Fabric Observability Alert Summary",
            "activitySubtitle": f"{len(critical)} critical, {len(warnings)} warning",
            "facts": facts,
            "markdown": True
        }]
    }

    try:
        resp = requests.post(TEAMS_WEBHOOK_URL, json=card, timeout=10)
        return 1 if resp.status_code == 200 else 0
    except Exception as e:
        print(f"  Failed to send Teams notification: {e}")
        return 0

notifications_sent = send_teams_notification(alerts)
if TEAMS_WEBHOOK_URL:
    print(f"Teams notifications sent: {notifications_sent}")
else:
    print("Teams webhook not configured (set spark.obs.teamsWebhook)")

# Cell 6: Log alerts to Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

# Create AlertLog table if needed
create_table = """.create-merge table AlertLog (
    AlertId: string,
    Kind: string,
    Severity: string,
    WorkspaceId: string,
    WorkspaceName: string,
    ItemId: string,
    ItemName: string,
    Message: string,
    Value: real,
    Threshold: real,
    NotificationSent: bool,
    Timestamp: datetime
)"""

kql_mgmt(create_table)

# Ingest alerts using pipe-delimited format
ingested = 0
for a in alerts:
    alert_id = str(uuid.uuid4())
    values = "|".join([
        alert_id,
        a["Kind"],
        a["Severity"],
        a["WorkspaceId"],
        a["WorkspaceName"].replace("|", " "),
        a["ItemId"],
        a["ItemName"].replace("|", " "),
        a["Message"].replace("|", " "),
        str(a["Value"]),
        str(a["Threshold"]),
        str(notifications_sent > 0).lower(),
        a["Timestamp"],
    ])
    csl = f".ingest inline into table AlertLog with (format=psv) <| {values}"

    resp = kql_mgmt(csl)
    if resp.status_code == 200:
        ingested += 1

print(f"Logged {ingested}/{len(alerts)} alerts to AlertLog table")

# Cell 7: Summary
# ─────────────────────────────────────────────────────────────────────────────

critical_count = len([a for a in alerts if a["Severity"] == "critical"])
warning_count = len([a for a in alerts if a["Severity"] == "warning"])
breached_count = len([s for s in slo_snapshots if s["IsBreaching"]])
healthy_count = len(slo_snapshots) - breached_count

print(f"\n{'='*60}")
print(f"NB_ObsAlerts completed at {datetime.now(timezone.utc).isoformat()}")
print(f"  Items evaluated: {len(success_metrics)}")
print(f"  SLO definitions loaded: {len(slo_definitions)}")
print(f"  SLO snapshots recorded: {snapshot_ingested}")
print(f"    Healthy: {healthy_count}")
print(f"    Breached: {breached_count}")
print(f"  Alerts triggered: {len(alerts)}")
print(f"    Critical: {critical_count}")
print(f"    Warning: {warning_count}")
print(f"  Notifications sent: {notifications_sent}")
print(f"  Alerts logged: {ingested}")
print(f"{'='*60}")
