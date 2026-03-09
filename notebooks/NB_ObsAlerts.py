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

# Service Principal credentials
TENANT_ID = spark.conf.get("spark.obs.tenantId", "")
CLIENT_ID = spark.conf.get("spark.obs.clientId", "")
CLIENT_SECRET = spark.conf.get("spark.obs.clientSecret", "")

# Target Eventhouse
KUSTO_URI = "https://trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com"
KUSTO_DB = "EH_Observability"

# Alert thresholds (defaults, overridden by AlertRules table)
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

# Get success rate per item (last 7 days)
success_rate_query = """
FabricEvents
| where StartTimeUtc > ago(7d)
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

# Get consecutive failures
consec_failures_query = """
FabricEvents
| where StartTimeUtc > ago(7d)
| order by ItemId asc, StartTimeUtc desc
| serialize
| extend PrevStatus = next(Status), PrevItemId = next(ItemId)
| where Status == "Failed"
| summarize ConsecFails = count() by ItemId, ItemName, WorkspaceId, WorkspaceName
| where ConsecFails >= 3
"""
consec_failures = kql_query(consec_failures_query)
print(f"Found {len(consec_failures)} items with consecutive failures")

# Cell 4: Evaluate alert rules
# ─────────────────────────────────────────────────────────────────────────────

alerts = []
now_iso = datetime.now(timezone.utc).isoformat()

# 1. Success rate violations
for m in success_metrics:
    if m["TotalRuns"] < 3:
        continue
    rate = m["SuccessRate"]
    if rate < DEFAULT_MIN_SUCCESS_RATE:
        severity = "critical" if rate < DEFAULT_MIN_SUCCESS_RATE * 0.8 else "warning"
        alerts.append({
            "Kind": "success_rate_violation",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": m["ItemId"],
            "ItemName": m["ItemName"],
            "Message": f"Success rate {rate*100:.1f}% below {DEFAULT_MIN_SUCCESS_RATE*100:.1f}% SLO",
            "Value": round(rate, 4),
            "Threshold": DEFAULT_MIN_SUCCESS_RATE,
            "Timestamp": now_iso,
        })

# 2. Duration regressions
for m in duration_metrics:
    baseline = m.get("BaselineP95")
    current = m.get("CurrentP95")
    if not baseline or baseline <= 0 or not current:
        continue
    ratio = current / baseline
    if ratio > DEFAULT_DURATION_REGRESSION_MULTIPLIER:
        severity = "critical" if ratio > 3 else "warning"
        alerts.append({
            "Kind": "duration_regression",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": m["ItemId"],
            "ItemName": m["ItemName"],
            "Message": f"P95 duration {current:.0f}s is {ratio:.1f}x baseline ({baseline:.0f}s)",
            "Value": round(current, 1),
            "Threshold": round(baseline * DEFAULT_DURATION_REGRESSION_MULTIPLIER, 1),
            "Timestamp": now_iso,
        })

# 3. Freshness violations
for m in freshness_metrics:
    hours = m.get("HoursSinceSuccess", 0)
    if hours > DEFAULT_MAX_FRESHNESS_HOURS:
        severity = "critical" if hours > DEFAULT_MAX_FRESHNESS_HOURS * 2 else "warning"
        alerts.append({
            "Kind": "freshness_violation",
            "Severity": severity,
            "WorkspaceId": m["WorkspaceId"],
            "WorkspaceName": m["WorkspaceName"],
            "ItemId": m["ItemId"],
            "ItemName": m["ItemName"],
            "Message": f"Last success was {hours:.1f}h ago (limit: {DEFAULT_MAX_FRESHNESS_HOURS}h)",
            "Value": round(hours, 1),
            "Threshold": DEFAULT_MAX_FRESHNESS_HOURS,
            "Timestamp": now_iso,
        })

# 4. Consecutive failures
for m in consec_failures:
    count = m.get("ConsecFails", 0)
    severity = "critical" if count >= 5 else "warning"
    alerts.append({
        "Kind": "consecutive_failures",
        "Severity": severity,
        "WorkspaceId": m["WorkspaceId"],
        "WorkspaceName": m["WorkspaceName"],
        "ItemId": m["ItemId"],
        "ItemName": m["ItemName"],
        "Message": f"{count} consecutive failures detected",
        "Value": count,
        "Threshold": DEFAULT_MAX_CONSECUTIVE_FAILURES,
        "Timestamp": now_iso,
    })

print(f"\nEvaluated alerts: {len(alerts)} triggered")
for a in alerts:
    emoji = "🔴" if a["Severity"] == "critical" else "🟡" if a["Severity"] == "warning" else "🔵"
    print(f"  {emoji} [{a['Severity'].upper()}] {a['ItemName']}: {a['Message']}")

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

requests.post(
    f"{KUSTO_URI}/v1/rest/mgmt",
    headers={
        "Authorization": f"Bearer {kusto_token}",
        "Content-Type": "application/json",
    },
    json={"db": KUSTO_DB, "csl": create_table},
)

# Ingest alerts
import uuid
ingested = 0
for a in alerts:
    alert_id = str(uuid.uuid4())
    values = ",".join([
        alert_id,
        a["Kind"],
        a["Severity"],
        a["WorkspaceId"],
        a["WorkspaceName"],
        a["ItemId"],
        a["ItemName"],
        a["Message"].replace(",", ";"),
        str(a["Value"]),
        str(a["Threshold"]),
        str(notifications_sent > 0).lower(),
        a["Timestamp"],
    ])
    csl = f".ingest inline into table AlertLog <| {values}"

    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/mgmt",
        headers={
            "Authorization": f"Bearer {kusto_token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": csl},
    )
    if resp.status_code == 200:
        ingested += 1

print(f"Logged {ingested}/{len(alerts)} alerts to AlertLog table")

# Cell 7: Summary
# ─────────────────────────────────────────────────────────────────────────────

critical_count = len([a for a in alerts if a["Severity"] == "critical"])
warning_count = len([a for a in alerts if a["Severity"] == "warning"])

print(f"\n{'='*60}")
print(f"NB_ObsAlerts completed at {datetime.now(timezone.utc).isoformat()}")
print(f"  Items evaluated: {len(success_metrics)}")
print(f"  Alerts triggered: {len(alerts)}")
print(f"    Critical: {critical_count}")
print(f"    Warning: {warning_count}")
print(f"  Notifications sent: {notifications_sent}")
print(f"  Alerts logged: {ingested}")
print(f"{'='*60}")
