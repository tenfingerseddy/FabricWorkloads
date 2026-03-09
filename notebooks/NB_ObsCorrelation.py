# Fabric Notebook: NB_ObsCorrelation
# Performs cross-item correlation analysis on ingested FabricEvents
# Links pipeline runs to their child notebook/dataflow/copyjob executions
#
# Strategy 0: Pipeline Activity Runs API — direct parent-child links (confidence 0.99)
# Strategy 1: rootActivityId matching — shared execution chain (confidence 0.95)
# Strategy 2: Time-window overlap — temporal proximity in same workspace (confidence 0.70)
#
# Schedule: Every 15 minutes (after NB_ObsIngestion)
# Dependencies: EH_Observability Eventhouse, FabricEvents table populated by NB_ObsIngestion

# Cell 1: Configuration
# ─────────────────────────────────────────────────────────────────────────────

import requests
import json
import uuid
import time as _time
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

# Fabric API base
FABRIC_API = "https://api.fabric.microsoft.com/v1"

# Correlation parameters
LOOKBACK_HOURS = 24
TIME_WINDOW_SECONDS = 30  # Tolerance for time-based correlation
CHILD_ITEM_TYPES = ("Notebook", "Dataflow", "CopyJob", "SparkJobDefinition", "Lakehouse")

# Rate limiting for Fabric API calls
API_DELAY_SECONDS = 0.5  # Delay between API calls to avoid 429s

print(f"[{datetime.now(timezone.utc).isoformat()}] NB_ObsCorrelation starting")
print(f"  Lookback: {LOOKBACK_HOURS}h, Time window: {TIME_WINDOW_SECONDS}s")

# Cell 2: Authentication
# ─────────────────────────────────────────────────────────────────────────────

def get_fabric_token():
    """Acquire Fabric API access token for calling REST endpoints."""
    if USE_FABRIC_NATIVE_AUTH:
        return notebookutils.credentials.getToken("https://api.fabric.microsoft.com")
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
fabric_token = get_fabric_token()
print("Authentication successful (Kusto + Fabric API)")

# Cell 3: Query helpers
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

def sanitize_kql_string(value):
    """Escape characters that could break pipe-delimited KQL inline ingestion."""
    if value is None:
        return ""
    s = str(value)
    # Remove pipe characters and newlines that would break the delimited format
    s = s.replace("|", " ").replace("\n", " ").replace("\r", "")
    return s

# Cell 4: Query recent events from Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

# Query all events from the lookback window
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

# Query existing correlations to avoid duplicates
existing_query = f"""
EventCorrelations
| where CreatedAt > ago({LOOKBACK_HOURS}h)
| project ParentEventId, ChildEventId, CorrelationType
"""
try:
    existing_correlations = kusto_query(existing_query, kusto_token)
    existing_pairs = set(
        (r["ParentEventId"], r["ChildEventId"], r["CorrelationType"])
        for r in existing_correlations
    )
    print(f"Found {len(existing_pairs)} existing correlation(s) to skip")
except Exception as ex:
    print(f"Warning: Could not query existing correlations: {ex}")
    existing_pairs = set()

# Separate pipeline events from potential child events
pipeline_events = [e for e in events if e["ItemType"] == "DataPipeline"]
child_candidates = [e for e in events if e["ItemType"] in CHILD_ITEM_TYPES]

# Build lookup indexes
# Index child candidates by ItemId for activity-run matching (Strategy 0)
by_item_id = {}
for c in child_candidates:
    iid = c.get("ItemId", "")
    if iid:
        by_item_id.setdefault(iid, []).append(c)

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

print(f"  Pipeline events: {len(pipeline_events)}")
print(f"  Child candidates: {len(child_candidates)}")
print(f"  Unique child ItemIds: {len(by_item_id)}")

# Cell 5: Strategy 0 — Pipeline Activity Runs API
# ─────────────────────────────────────────────────────────────────────────────
# For each pipeline event, call the queryactivityruns API to get individual
# activities. Match activity outputs to child events by ItemId.
# This provides the strongest correlation signal (confidence 0.99).

def query_activity_runs(workspace_id, job_instance_id, token):
    """
    Call the Pipeline Activity Runs API to get child activities.
    POST /v1/workspaces/{workspaceId}/datapipelines/pipelineruns/{jobId}/queryactivityruns

    Returns a list of activity dicts, each containing:
      - activityName, activityType, status
      - input (references to invoked items)
      - output (references to invoked items)
      - durationInMs, error
    """
    url = (
        f"{FABRIC_API}/workspaces/{workspace_id}"
        f"/datapipelines/pipelineruns/{job_instance_id}/queryactivityruns"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    # The API accepts an empty body or filter criteria
    body = {}

    try:
        resp = requests.post(url, headers=headers, json=body, timeout=30)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "10"))
            print(f"    Rate limited on activity runs, waiting {retry_after}s")
            _time.sleep(retry_after)
            resp = requests.post(url, headers=headers, json=body, timeout=30)

        if resp.status_code == 200:
            data = resp.json()
            return data.get("value", data) if isinstance(data, dict) else data
        else:
            # 403/404 expected for some item types or completed runs
            return []
    except Exception as ex:
        print(f"    Activity runs API error: {ex}")
        return []

def extract_referenced_item_ids(activity):
    """
    Extract ItemIds referenced by a pipeline activity from its input/output.
    Different activity types store references differently:
      - Notebook activities: input.notebook.referenceName or output references
      - Copy activities: input.source/sink references
      - Dataflow activities: input.dataflow references
    Returns a set of ItemId strings found.
    """
    item_ids = set()

    for field_name in ("input", "output"):
        field = activity.get(field_name)
        if not isinstance(field, dict):
            continue

        # Walk through all values looking for item references
        _extract_ids_recursive(field, item_ids)

    # Also check for explicit itemId or notebookId fields at the activity level
    for key in ("itemId", "notebookId", "dataflowId", "pipelineId"):
        val = activity.get(key)
        if val and isinstance(val, str) and len(val) > 10:
            item_ids.add(val)

    return item_ids

def _extract_ids_recursive(obj, item_ids):
    """Recursively search a dict/list for values that look like Fabric item IDs."""
    if isinstance(obj, dict):
        for key, val in obj.items():
            # Keys that commonly hold item references
            if key.lower() in ("referencename", "itemid", "notebookid",
                               "dataflowid", "pipelineid", "datasetid",
                               "id", "artifactid"):
                if isinstance(val, str) and _looks_like_guid(val):
                    item_ids.add(val)
            elif isinstance(val, (dict, list)):
                _extract_ids_recursive(val, item_ids)
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                _extract_ids_recursive(item, item_ids)

def _looks_like_guid(s):
    """Check if a string looks like a GUID/UUID (32+ hex chars with optional dashes)."""
    clean = s.replace("-", "")
    return len(clean) >= 32 and all(c in "0123456789abcdefABCDEF" for c in clean)

# Execute Strategy 0 for all pipeline events
strategy0_correlations = []  # List of (pipeline_event, child_event, activity_name)
strategy0_claimed = set()    # Child EventIds claimed by Strategy 0
api_calls_made = 0
api_successes = 0

print(f"\nStrategy 0: Querying activity runs for {len(pipeline_events)} pipeline event(s)...")

for pj in pipeline_events:
    ws_id = pj["WorkspaceId"]
    job_id = pj["EventId"]  # EventId = job instance ID from ingestion

    activities = query_activity_runs(ws_id, job_id, fabric_token)
    api_calls_made += 1

    if activities:
        api_successes += 1
        print(f"  Pipeline '{pj.get('ItemName', '?')}' (job {job_id[:8]}): {len(activities)} activities")

        for activity in activities:
            act_name = activity.get("activityName", activity.get("name", "unknown"))
            act_type = activity.get("activityType", activity.get("type", "unknown"))
            act_status = activity.get("status", "unknown")

            # Extract referenced item IDs from this activity
            referenced_ids = extract_referenced_item_ids(activity)

            if referenced_ids:
                print(f"    Activity '{act_name}' ({act_type}) -> refs: {referenced_ids}")

            # Match referenced IDs to child events
            for ref_id in referenced_ids:
                matching_children = by_item_id.get(ref_id, [])
                for child in matching_children:
                    # Only match children that ran during or after the pipeline
                    c_start = parse_dt(child.get("StartTimeUtc"))
                    p_start = parse_dt(pj.get("StartTimeUtc"))
                    p_end = parse_dt(pj.get("EndTimeUtc"))

                    if c_start and p_start:
                        # Child should have started within the pipeline's execution window
                        tolerance = timedelta(seconds=TIME_WINDOW_SECONDS * 2)
                        if not (p_start - tolerance <= c_start <= (p_end or p_start + timedelta(hours=2)) + tolerance):
                            continue

                    strategy0_correlations.append((pj, child, act_name))
                    strategy0_claimed.add(child["EventId"])

    # Rate limiting between API calls
    if api_calls_made < len(pipeline_events):
        _time.sleep(API_DELAY_SECONDS)

print(f"\nStrategy 0 results:")
print(f"  API calls: {api_calls_made}, successful: {api_successes}")
print(f"  Direct correlations found: {len(strategy0_correlations)}")
print(f"  Unique children claimed: {len(strategy0_claimed)}")

# Cell 6: Build correlation chains (all strategies)
# ─────────────────────────────────────────────────────────────────────────────
# Strategy 0: Pipeline Activity Runs (confidence 0.99) — already computed above
# Strategy 1: rootActivityId matching (confidence 0.95)
# Strategy 2: Time-window overlap (confidence 0.70)

correlations = []            # Final list of correlation dicts
correlation_groups = {}      # event_id -> group_id
claimed_child_ids = set()    # Combine all claimed children
chains_built = 0

# Pre-claim children found by Strategy 0
claimed_child_ids.update(strategy0_claimed)

for pj in pipeline_events:
    children_found = []
    group_id = f"CG-{uuid.uuid4().hex[:12]}"

    p_start = parse_dt(pj.get("StartTimeUtc"))
    p_end = parse_dt(pj.get("EndTimeUtc"))
    p_ws = pj["WorkspaceId"]
    p_raid = pj.get("RootActivityId", "")

    # ── Strategy 0: Pipeline Activity Runs (pre-computed) ────────────────
    for parent_ev, child_ev, act_name in strategy0_correlations:
        if parent_ev["EventId"] != pj["EventId"]:
            continue
        children_found.append((
            child_ev,
            f"activityRuns:{act_name}",
            0.99,
        ))

    # ── Strategy 1: rootActivityId matching ──────────────────────────────
    # Jobs sharing the same rootActivityId are part of the same execution chain.
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

            # Skip if this exact correlation already exists in Eventhouse
            pair_key = (pj["EventId"], child["EventId"], corr_type)
            if pair_key in existing_pairs:
                continue

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
print(f"  Total new correlations: {len(correlations)}")
print(f"  Events assigned to groups: {len(correlation_groups)}")

# Cell 7: Ingest correlations into EventCorrelations table
# ─────────────────────────────────────────────────────────────────────────────
# EventCorrelations schema (6 columns):
#   CorrelationId (string), ParentEventId (string), ChildEventId (string),
#   CorrelationType (string), Confidence (real), CreatedAt (datetime)

ingested_corr = 0
failed_corr = 0

for row in correlations:
    # Build pipe-delimited values matching the exact EventCorrelations table schema
    values = "|".join([
        sanitize_kql_string(row["CorrelationId"]),
        sanitize_kql_string(row["ParentEventId"]),
        sanitize_kql_string(row["ChildEventId"]),
        sanitize_kql_string(row["CorrelationType"]),
        str(row["Confidence"]),
        row["CreatedAt"],
    ])
    csl = f".ingest inline into table EventCorrelations <| {values}"

    resp = kusto_mgmt(csl, kusto_token)
    if resp.status_code == 200:
        ingested_corr += 1
    else:
        failed_corr += 1
        if failed_corr <= 3:
            # Log first few failures for debugging
            body = ""
            try:
                body = resp.text[:200]
            except:
                pass
            print(f"  Failed correlation {row['CorrelationId']}: HTTP {resp.status_code} — {body}")

print(f"Ingested {ingested_corr}/{len(correlations)} correlations into EventCorrelations")
if failed_corr > 0:
    print(f"  ({failed_corr} failed)")

# Cell 8: Update FabricEvents with CorrelationGroup
# ─────────────────────────────────────────────────────────────────────────────

updated_events = 0
update_errors = 0

# Group event IDs by their correlation group to minimize update commands
groups_to_events = {}
for event_id, group_id in correlation_groups.items():
    groups_to_events.setdefault(group_id, []).append(event_id)

for group_id, event_ids in groups_to_events.items():
    for eid in event_ids:
        # Fabric Eventhouse supports the .update table command to delete+re-append atomically.
        update_cmd = (
            f'.update table FabricEvents delete EventId == "{eid}" '
            f'append FabricEvents '
            f'<| FabricEvents | where EventId == "{eid}" | extend CorrelationGroup = "{group_id}"'
        )
        resp = kusto_mgmt(update_cmd, kusto_token)
        if resp.status_code == 200:
            updated_events += 1
        else:
            update_errors += 1
            if update_errors <= 2:
                body = ""
                try:
                    body = resp.text[:200]
                except:
                    pass
                print(f"  Update failed for {eid[:8]}: HTTP {resp.status_code} — {body}")

print(f"Updated CorrelationGroup on {updated_events}/{len(correlation_groups)} events")
if update_errors > 0:
    print(f"  ({update_errors} update errors)")

# Cell 9: Summary
# ─────────────────────────────────────────────────────────────────────────────

total_events = len(events)
total_correlations = len(correlations)
total_chains = chains_built
activity_run_matches = sum(1 for c in correlations if c["CorrelationType"].startswith("activityRuns:"))
root_activity_matches = sum(1 for c in correlations if c["CorrelationType"] == "rootActivityId")
time_window_matches = sum(1 for c in correlations if c["CorrelationType"] == "timeWindow")

print(f"\n{'='*60}")
print(f"NB_ObsCorrelation completed at {datetime.now(timezone.utc).isoformat()}")
print(f"{'='*60}")
print(f"  Events analyzed:           {total_events}")
print(f"    Pipeline events:         {len(pipeline_events)}")
print(f"    Child candidates:        {len(child_candidates)}")
print(f"  Correlation chains built:  {total_chains}")
print(f"  Total new correlations:    {total_correlations}")
print(f"    By activityRuns (0.99):  {activity_run_matches}")
print(f"    By rootActivityId (0.95):{root_activity_matches}")
print(f"    By time window (0.70):   {time_window_matches}")
print(f"  Events in groups:          {len(correlation_groups)}")
print(f"  Correlations ingested:     {ingested_corr}")
print(f"  CorrelationGroup updates:  {updated_events}")
print(f"  API calls to activity runs:{api_calls_made}")
print(f"{'='*60}")
