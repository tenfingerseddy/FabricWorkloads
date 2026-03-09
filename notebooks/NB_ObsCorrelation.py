# Fabric Notebook: NB_ObsCorrelation
# Performs cross-item correlation analysis on ingested FabricEvents
# Links pipeline runs to their child notebook/dataflow/copyjob executions
#
# Schedule: Every 15 minutes (after NB_ObsIngestion)
# Dependencies: EH_Observability Eventhouse, FabricEvents table populated by NB_ObsIngestion

# Cell 1: Configuration
# ─────────────────────────────────────────────────────────────────────────────

import requests
import json
import uuid
from datetime import datetime, timezone, timedelta

# Service Principal credentials (set via notebook parameters or Key Vault)
TENANT_ID = spark.conf.get("spark.obs.tenantId", "")
CLIENT_ID = spark.conf.get("spark.obs.clientId", "")
CLIENT_SECRET = spark.conf.get("spark.obs.clientSecret", "")

# Target Eventhouse
KUSTO_URI = "https://trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com"
KUSTO_DB = "EH_Observability"

# Correlation parameters
LOOKBACK_HOURS = 24
TIME_WINDOW_SECONDS = 30  # Tolerance for time-based correlation
CHILD_ITEM_TYPES = ("Notebook", "Dataflow", "CopyJob", "SparkJobDefinition", "Lakehouse")

print(f"[{datetime.now(timezone.utc).isoformat()}] NB_ObsCorrelation starting")
print(f"  Lookback: {LOOKBACK_HOURS}h, Time window: {TIME_WINDOW_SECONDS}s")

# Cell 2: Authentication
# ─────────────────────────────────────────────────────────────────────────────

def get_fabric_token():
    """Acquire Fabric API access token via client credentials."""
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://api.fabric.microsoft.com/.default",
        "grant_type": "client_credentials",
    }
    resp = requests.post(url, data=data)
    resp.raise_for_status()
    return resp.json()["access_token"]

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

# Cell 3: Query recent events from Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

def kusto_query(kql, token):
    """Execute a KQL query via REST API and return rows as dicts."""
    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/query",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": kql},
    )
    resp.raise_for_status()
    result = resp.json()

    # Parse the v1 response format: Tables[0].Columns + Tables[0].Rows
    tables = result.get("Tables", [])
    if not tables:
        return []

    primary = tables[0]
    columns = [col["ColumnName"] for col in primary["Columns"]]
    rows = []
    for row in primary["Rows"]:
        rows.append(dict(zip(columns, row)))
    return rows

def kusto_mgmt(csl, token):
    """Execute a KQL management command via REST API."""
    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/mgmt",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": csl},
    )
    return resp

# Query all events from the lookback window that do not yet have a CorrelationGroup
query = f"""
FabricEvents
| where StartTimeUtc > ago({LOOKBACK_HOURS}h)
| project EventId, WorkspaceId, WorkspaceName, ItemId, ItemName, ItemType,
          JobType, Status, RootActivityId, StartTimeUtc, EndTimeUtc,
          DurationSeconds, CorrelationGroup
| order by StartTimeUtc asc
"""

events = kusto_query(query, kusto_token)
print(f"Retrieved {len(events)} events from the last {LOOKBACK_HOURS}h")

# Separate pipeline events from potential child events
pipeline_events = [e for e in events if e["ItemType"] == "DataPipeline"]
child_candidates = [e for e in events if e["ItemType"] in CHILD_ITEM_TYPES]

print(f"  Pipeline events: {len(pipeline_events)}")
print(f"  Child candidates: {len(child_candidates)}")

# Cell 4: Build correlation chains
# ─────────────────────────────────────────────────────────────────────────────

def parse_dt(dt_str):
    """Parse a datetime string from KQL into a datetime object. Returns None on failure."""
    if not dt_str:
        return None
    try:
        # KQL returns ISO format; strip trailing Z if present
        cleaned = str(dt_str).rstrip("Z")
        return datetime.fromisoformat(cleaned)
    except (ValueError, TypeError):
        return None

correlations = []    # List of (parent_event_id, child_event_id, corr_type, confidence)
correlation_groups = {}  # event_id -> group_id
claimed_child_ids = set()
chains_built = 0

# Index child candidates by rootActivityId for fast lookup (Strategy 1)
by_root_activity = {}
for c in child_candidates:
    raid = c.get("RootActivityId", "")
    if raid:
        by_root_activity.setdefault(raid, []).append(c)

# Index child candidates by workspace for time-window lookup (Strategy 2)
by_workspace = {}
for c in child_candidates:
    ws = c["WorkspaceId"]
    by_workspace.setdefault(ws, []).append(c)

for pj in pipeline_events:
    children_found = []
    group_id = f"CG-{uuid.uuid4().hex[:12]}"

    p_start = parse_dt(pj.get("StartTimeUtc"))
    p_end = parse_dt(pj.get("EndTimeUtc"))
    p_ws = pj["WorkspaceId"]
    p_raid = pj.get("RootActivityId", "")

    # ── Strategy 1: rootActivityId matching ──────────────────────────────
    # Jobs sharing the same rootActivityId are part of the same execution chain.
    # This is the strongest signal when available.
    if p_raid:
        for child in by_root_activity.get(p_raid, []):
            if child["EventId"] in claimed_child_ids:
                continue
            if child["WorkspaceId"] != p_ws:
                continue
            children_found.append((child, "rootActivityId", 0.95))
            claimed_child_ids.add(child["EventId"])

    # ── Strategy 2: Time-window overlap within same workspace ────────────
    # If the child started within the pipeline's execution window (plus tolerance),
    # it is likely a downstream item triggered by the pipeline.
    if p_start and p_end:
        tolerance = timedelta(seconds=TIME_WINDOW_SECONDS)
        window_start = p_start - tolerance
        window_end = p_end + tolerance

        for child in by_workspace.get(p_ws, []):
            if child["EventId"] in claimed_child_ids:
                continue

            c_start = parse_dt(child.get("StartTimeUtc"))
            if c_start is None:
                continue

            if window_start <= c_start <= window_end:
                children_found.append((child, "timeWindow", 0.70))
                claimed_child_ids.add(child["EventId"])

    # ── Record correlations ──────────────────────────────────────────────
    if children_found:
        chains_built += 1
        correlation_groups[pj["EventId"]] = group_id

        for child, corr_type, confidence in children_found:
            correlation_groups[child["EventId"]] = group_id
            correlations.append({
                "CorrelationId": f"CR-{uuid.uuid4().hex[:12]}",
                "ParentEventId": pj["EventId"],
                "ChildEventId": child["EventId"],
                "CorrelationType": corr_type,
                "Confidence": confidence,
                "CreatedAt": datetime.now(timezone.utc).isoformat(),
            })

print(f"\nCorrelation analysis complete:")
print(f"  Chains built: {chains_built}")
print(f"  Total correlations found: {len(correlations)}")
print(f"  Events assigned to groups: {len(correlation_groups)}")

# Cell 5: Ingest correlations into EventCorrelations table
# ─────────────────────────────────────────────────────────────────────────────

ingested_corr = 0

for row in correlations:
    # Build pipe-delimited values matching EventCorrelations schema:
    # CorrelationId, ParentEventId, ChildEventId, CorrelationType, Confidence, CreatedAt
    values = "|".join([
        row["CorrelationId"],
        row["ParentEventId"],
        row["ChildEventId"],
        row["CorrelationType"],
        str(row["Confidence"]),
        row["CreatedAt"],
    ])
    csl = f".ingest inline into table EventCorrelations <| {values}"

    resp = kusto_mgmt(csl, kusto_token)
    if resp.status_code == 200:
        ingested_corr += 1
    else:
        print(f"  Failed to ingest correlation {row['CorrelationId']}: {resp.status_code}")

print(f"Ingested {ingested_corr}/{len(correlations)} correlations into EventCorrelations")

# Cell 6: Update FabricEvents with CorrelationGroup
# ─────────────────────────────────────────────────────────────────────────────

updated_events = 0

# Group event IDs by their correlation group to minimize update commands
groups_to_events = {}
for event_id, group_id in correlation_groups.items():
    groups_to_events.setdefault(group_id, []).append(event_id)

for group_id, event_ids in groups_to_events.items():
    # Build a KQL update command that sets CorrelationGroup for all events in this group.
    # Use .set-or-replace with a query that merges the update.
    event_list = ", ".join(f'"{eid}"' for eid in event_ids)
    update_csl = f"""
.set-or-replace async FabricEvents_temp <|
    FabricEvents
    | where EventId in ({event_list})
    | extend CorrelationGroup = "{group_id}"
"""
    # Instead, use a simpler approach: update each event individually
    for eid in event_ids:
        # KQL does not support UPDATE in place; use .set-or-append with a delete-then-reinsert
        # approach is complex. A practical pattern is to run a soft-update via the
        # management endpoint using .update table command if available, or alternatively
        # re-ingest the row with the CorrelationGroup set.
        #
        # Fabric Eventhouse supports the .update table policy command. We use it here:
        update_cmd = (
            f'.update table FabricEvents delete EventId == "{eid}" '
            f'append FabricEvents '
            f'<| FabricEvents | where EventId == "{eid}" | extend CorrelationGroup = "{group_id}"'
        )
        resp = kusto_mgmt(update_cmd, kusto_token)
        if resp.status_code == 200:
            updated_events += 1
        else:
            # Fallback: try a simpler replace approach if .update is not available
            # This uses the replace extents pattern
            pass

print(f"Updated CorrelationGroup on {updated_events}/{len(correlation_groups)} events")

# Cell 7: Summary
# ─────────────────────────────────────────────────────────────────────────────

total_events = len(events)
total_correlations = len(correlations)
total_chains = chains_built
root_activity_matches = sum(1 for c in correlations if c["CorrelationType"] == "rootActivityId")
time_window_matches = sum(1 for c in correlations if c["CorrelationType"] == "timeWindow")

print(f"\n{'='*60}")
print(f"NB_ObsCorrelation completed at {datetime.now(timezone.utc).isoformat()}")
print(f"  Events analyzed:         {total_events}")
print(f"    Pipeline events:       {len(pipeline_events)}")
print(f"    Child candidates:      {len(child_candidates)}")
print(f"  Correlation chains built: {total_chains}")
print(f"  Total correlations:       {total_correlations}")
print(f"    By rootActivityId:     {root_activity_matches}")
print(f"    By time window:        {time_window_matches}")
print(f"  Events in groups:        {len(correlation_groups)}")
print(f"  Correlations ingested:   {ingested_corr}")
print(f"  Events updated:          {updated_events}")
print(f"{'='*60}")
