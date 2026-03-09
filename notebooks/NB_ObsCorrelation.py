# Fabric Notebook: NB_ObsCorrelation
# Performs cross-item correlation analysis on ingested FabricEvents
# Links pipeline runs to their child notebook/dataflow/copyjob executions
#
# Strategy 0: Pipeline Activity Runs API — direct parent-child links (confidence 0.99)
# Strategy 1: rootActivityId matching — shared execution chain (confidence 0.95)
# Strategy 2: Time-window overlap — temporal proximity +/-5 min in same workspace (confidence 0.70)
#
# Target table: EventCorrelations (guid, guid, string, real, datetime)
#   UpstreamEventId   — guid  — the pipeline event
#   DownstreamEventId — guid  — the child notebook/dataflow/copyjob event
#   RelationshipType  — string — how the correlation was detected
#   ConfidenceScore   — real   — 0.00 to 1.00
#   DetectedAt        — datetime
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
TEMPORAL_WINDOW_SECONDS = 300  # +/- 5 minutes for temporal proximity (Strategy 2)
ACTIVITY_WINDOW_TOLERANCE_SECONDS = 60  # Extra tolerance for activity-run matching
CHILD_ITEM_TYPES = ("Notebook", "Dataflow", "CopyJob", "SparkJobDefinition", "Lakehouse")

# Rate limiting for Fabric API calls
API_DELAY_SECONDS = 0.5  # Delay between API calls to avoid 429s

print(f"[{datetime.now(timezone.utc).isoformat()}] NB_ObsCorrelation starting")
print(f"  Lookback: {LOOKBACK_HOURS}h, Temporal window: {TEMPORAL_WINDOW_SECONDS}s")

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

# Cell 3: KQL helpers
# ─────────────────────────────────────────────────────────────────────────────

def kql_query(query):
    """Execute a KQL query via v2 REST API and return rows as list of dicts."""
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
    """Execute a KQL management command via v1 REST API."""
    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/mgmt",
        headers={
            "Authorization": f"Bearer {kusto_token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": command},
    )
    return resp

def parse_dt(dt_str):
    """Parse a datetime string from KQL into a datetime object. Returns None on failure."""
    if not dt_str:
        return None
    try:
        cleaned = str(dt_str).rstrip("Z")
        return datetime.fromisoformat(cleaned)
    except (ValueError, TypeError):
        return None

def sanitize_psv(value):
    """Escape characters that could break pipe-delimited KQL inline ingestion."""
    if value is None:
        return ""
    s = str(value)
    # Remove pipe characters and newlines that would break PSV format
    s = s.replace("|", " ").replace("\n", " ").replace("\r", "")
    return s

def is_valid_guid(s):
    """Check if a string is a valid UUID/GUID format."""
    if not s:
        return False
    try:
        uuid.UUID(str(s))
        return True
    except (ValueError, AttributeError):
        return False

# Cell 4: Query recent events from Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

# Query all events from the lookback window
# EventId in FabricEvents is a string, but it contains UUID values from the Fabric API
query = f"""
FabricEvents
| where StartTimeUtc > ago({LOOKBACK_HOURS}h)
| project EventId, WorkspaceId, WorkspaceName, ItemId, ItemName, ItemType,
          JobType, Status, RootActivityId, StartTimeUtc, EndTimeUtc,
          DurationSeconds, CorrelationGroup
| order by StartTimeUtc asc
"""

events = kql_query(query)
print(f"Retrieved {len(events)} events from the last {LOOKBACK_HOURS}h")

# Query existing correlations to avoid duplicates
# EventCorrelations schema: UpstreamEventId (guid), DownstreamEventId (guid),
#   RelationshipType (string), ConfidenceScore (real), DetectedAt (datetime)
existing_query = f"""
EventCorrelations
| where DetectedAt > ago({LOOKBACK_HOURS}h)
| project UpstreamEventId = tostring(UpstreamEventId),
          DownstreamEventId = tostring(DownstreamEventId),
          RelationshipType
"""
try:
    existing_correlations = kql_query(existing_query)
    existing_pairs = set(
        (r["UpstreamEventId"], r["DownstreamEventId"], r["RelationshipType"])
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
        print(f"  Pipeline '{pj.get('ItemName', '?')}' (job {str(job_id)[:8]}): {len(activities)} activities")

        for activity in activities:
            act_name = activity.get("activityName", activity.get("name", "unknown"))
            act_type = activity.get("activityType", activity.get("type", "unknown"))

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
                        tolerance = timedelta(seconds=ACTIVITY_WINDOW_TOLERANCE_SECONDS)
                        effective_end = p_end or (p_start + timedelta(hours=2))
                        if not (p_start - tolerance <= c_start <= effective_end + tolerance):
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
# Strategy 2: Time-window overlap +/- 5 minutes (confidence 0.70)

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

    # -- Strategy 0: Pipeline Activity Runs (pre-computed) --
    for parent_ev, child_ev, act_name in strategy0_correlations:
        if parent_ev["EventId"] != pj["EventId"]:
            continue
        children_found.append((
            child_ev,
            f"activityRuns:{act_name}",
            0.99,
        ))

    # -- Strategy 1: rootActivityId matching --
    # Jobs sharing the same rootActivityId are part of the same execution chain.
    if p_raid:
        for child in by_root_activity.get(p_raid, []):
            if child["EventId"] in claimed_child_ids:
                continue
            if child["WorkspaceId"] != p_ws:
                continue
            children_found.append((child, "rootActivityId", 0.95))
            claimed_child_ids.add(child["EventId"])

    # -- Strategy 2: Time-window overlap within same workspace (+/- 5 min) --
    # If the child started within the pipeline's execution window (plus tolerance),
    # it is likely a downstream item triggered by the pipeline.
    if p_start and p_end:
        tolerance = timedelta(seconds=TEMPORAL_WINDOW_SECONDS)
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

    # -- Record correlations --
    if children_found:
        chains_built += 1
        correlation_groups[pj["EventId"]] = group_id

        for child, rel_type, confidence in children_found:
            correlation_groups[child["EventId"]] = group_id

            # Validate that both EventIds are valid GUIDs before ingesting
            upstream_id = str(pj["EventId"])
            downstream_id = str(child["EventId"])

            if not is_valid_guid(upstream_id) or not is_valid_guid(downstream_id):
                print(f"  Skipping: invalid GUID pair ({upstream_id[:12]}..., {downstream_id[:12]}...)")
                continue

            # Skip if this exact correlation already exists in Eventhouse
            pair_key = (upstream_id, downstream_id, rel_type)
            if pair_key in existing_pairs:
                continue

            correlations.append({
                "UpstreamEventId": upstream_id,
                "DownstreamEventId": downstream_id,
                "RelationshipType": rel_type,
                "ConfidenceScore": confidence,
                "DetectedAt": datetime.now(timezone.utc).isoformat(),
            })

print(f"\nCorrelation analysis complete:")
print(f"  Chains built: {chains_built}")
print(f"  Total new correlations: {len(correlations)}")
print(f"  Events assigned to groups: {len(correlation_groups)}")

# Cell 7: Ingest correlations into EventCorrelations table
# ─────────────────────────────────────────────────────────────────────────────
# EventCorrelations schema (5 columns, positional mapping with PSV):
#   UpstreamEventId: guid
#   DownstreamEventId: guid
#   RelationshipType: string
#   ConfidenceScore: real
#   DetectedAt: datetime
#
# IMPORTANT: UpstreamEventId and DownstreamEventId are guid type.
# Inline ingestion with format=psv will parse UUID strings like
# "a1b2c3d4-e5f6-7890-abcd-ef1234567890" into guid columns correctly.
# No CorrelationId column exists — the table uses the (Upstream, Downstream) pair as key.

ingested_corr = 0
failed_corr = 0

if correlations:
    print(f"\nIngesting {len(correlations)} correlations into EventCorrelations...")

for row in correlations:
    # Build pipe-delimited values matching the EXACT EventCorrelations schema:
    # UpstreamEventId | DownstreamEventId | RelationshipType | ConfidenceScore | DetectedAt
    values = "|".join([
        row["UpstreamEventId"],
        row["DownstreamEventId"],
        sanitize_psv(row["RelationshipType"]),
        str(row["ConfidenceScore"]),
        row["DetectedAt"],
    ])
    csl = f".ingest inline into table EventCorrelations with (format=psv) <| {values}"

    resp = kql_mgmt(csl)
    if resp.status_code == 200:
        ingested_corr += 1
    else:
        failed_corr += 1
        if failed_corr <= 5:
            body = ""
            try:
                body = resp.text[:300]
            except Exception:
                pass
            print(f"  Failed ingestion: HTTP {resp.status_code}")
            print(f"    Upstream={row['UpstreamEventId']}, Downstream={row['DownstreamEventId']}")
            print(f"    Response: {body}")

print(f"Ingested {ingested_corr}/{len(correlations)} correlations into EventCorrelations")
if failed_corr > 0:
    print(f"  ({failed_corr} failed)")

# Cell 8: Update FabricEvents with CorrelationGroup
# ─────────────────────────────────────────────────────────────────────────────
# Use soft-delete + re-append to set the CorrelationGroup on correlated events.
# This is an Eventhouse-compatible approach (no update-in-place support).

updated_events = 0
update_errors = 0

# Group event IDs by their correlation group to minimize update commands
groups_to_events = {}
for event_id, group_id in correlation_groups.items():
    groups_to_events.setdefault(group_id, []).append(event_id)

for group_id, event_ids in groups_to_events.items():
    for eid in event_ids:
        # Check if this event already has the correct CorrelationGroup
        check_query = f"""
        FabricEvents
        | where EventId == "{eid}"
        | project CorrelationGroup
        | take 1
        """
        try:
            check_rows = kql_query(check_query)
            if check_rows and check_rows[0].get("CorrelationGroup") == group_id:
                # Already has the correct group, skip
                updated_events += 1
                continue
        except Exception:
            pass

        # Use .set-or-append to a temp table, then soft-delete + append
        # For simplicity in v1, just log the group assignments
        # Full update requires .delete + .set-or-append which needs careful handling
        # This is tracked as a future enhancement
        pass

# For now, log the correlation groups for reference
if correlation_groups:
    print(f"\nCorrelation groups assigned ({len(groups_to_events)} groups, {len(correlation_groups)} events):")
    for gid, eids in list(groups_to_events.items())[:5]:
        print(f"  {gid}: {len(eids)} event(s)")
    if len(groups_to_events) > 5:
        print(f"  ... and {len(groups_to_events) - 5} more group(s)")

# Cell 9: Summary
# ─────────────────────────────────────────────────────────────────────────────

total_events = len(events)
total_correlations = len(correlations)
total_chains = chains_built
activity_run_matches = sum(1 for c in correlations if c["RelationshipType"].startswith("activityRuns:"))
root_activity_matches = sum(1 for c in correlations if c["RelationshipType"] == "rootActivityId")
time_window_matches = sum(1 for c in correlations if c["RelationshipType"] == "timeWindow")

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
print(f"  API calls to activity runs:{api_calls_made}")
print(f"{'='*60}")
