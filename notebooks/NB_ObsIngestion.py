# Fabric Notebook: NB_ObsIngestion
# Collects job instances from all monitored workspaces and ingests into EH_Observability
#
# Schedule: Every 5 minutes
# Dependencies: EH_Observability Eventhouse, Service Principal credentials in Key Vault or notebook params

# Cell 1: Configuration
# ─────────────────────────────────────────────────────────────────────────────

import requests
import json
from datetime import datetime, timezone
from pyspark.sql import SparkSession
from pyspark.sql.types import *
from pyspark.sql.functions import *

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

# Fabric API
FABRIC_API = "https://api.fabric.microsoft.com/v1"
FABRIC_SCOPE = "https://api.fabric.microsoft.com/.default"

# Item types that support the Jobs API
JOB_ITEM_TYPES = {"DataPipeline", "Notebook", "CopyJob", "Lakehouse", "SemanticModel", "Dataflow", "SparkJobDefinition"}

print(f"[{datetime.now(timezone.utc).isoformat()}] NB_ObsIngestion starting")

# Cell 2: Authentication
# ─────────────────────────────────────────────────────────────────────────────

def get_fabric_token():
    """Acquire Fabric API access token."""
    if USE_FABRIC_NATIVE_AUTH:
        return notebookutils.credentials.getToken("https://api.fabric.microsoft.com")
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": FABRIC_SCOPE,
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

fabric_token = get_fabric_token()
kusto_token = get_kusto_token()
print("Authentication successful")

# Cell 3: Discover workspaces and items
# ─────────────────────────────────────────────────────────────────────────────

def fabric_get(path, token):
    """GET request to Fabric API with pagination."""
    results = []
    url = f"{FABRIC_API}{path}"
    while url:
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 429:
            import time
            retry_after = int(resp.headers.get("Retry-After", "10"))
            print(f"  Rate limited, waiting {retry_after}s")
            time.sleep(retry_after)
            continue
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("value", []))
        url = data.get("continuationUri")
    return results

# Discover all workspaces
workspaces = fabric_get("/workspaces", fabric_token)
print(f"Found {len(workspaces)} workspace(s)")

# Collect items per workspace
workspace_items = {}
for ws in workspaces:
    items = fabric_get(f"/workspaces/{ws['id']}/items", fabric_token)
    job_items = [i for i in items if i["type"] in JOB_ITEM_TYPES]
    workspace_items[ws["id"]] = {"workspace": ws, "items": items, "job_items": job_items}
    print(f"  {ws['displayName']}: {len(items)} items ({len(job_items)} with jobs)")

# Cell 4: Collect job instances
# ─────────────────────────────────────────────────────────────────────────────

all_events = []
now = datetime.now(timezone.utc).isoformat()

for ws_id, ws_data in workspace_items.items():
    ws_name = ws_data["workspace"]["displayName"]
    capacity_id = ws_data["workspace"].get("capacityId", "")

    for item in ws_data["job_items"]:
        try:
            jobs = fabric_get(
                f"/workspaces/{ws_id}/items/{item['id']}/jobs/instances",
                fabric_token
            )
        except Exception as e:
            # Some items don't support jobs API — skip gracefully
            continue

        for job in jobs:
            start = job.get("startTimeUtc", "")
            end = job.get("endTimeUtc", "")
            duration = 0
            if start and end:
                try:
                    s = datetime.fromisoformat(start.rstrip("Z"))
                    e = datetime.fromisoformat(end.rstrip("Z"))
                    duration = (e - s).total_seconds()
                except:
                    pass

            # Ensure failed jobs still get valid timestamps for SLO evaluation.
            # Fabric API may return empty timestamps for fast-failing jobs.
            effective_start = start or now
            effective_end = end or now

            # Parse failureReason — API returns dict or string
            failure_raw = job.get("failureReason", "")
            if isinstance(failure_raw, dict):
                failure_reason = failure_raw.get("message", str(failure_raw))
            elif failure_raw:
                failure_reason = str(failure_raw)
            else:
                failure_reason = ""

            all_events.append({
                "EventId": job["id"],
                "WorkspaceId": ws_id,
                "WorkspaceName": ws_name,
                "ItemId": item["id"],
                "ItemName": item["displayName"],
                "ItemType": item["type"],
                "JobType": job.get("jobType", ""),
                "InvokeType": job.get("invokeType", ""),
                "Status": job.get("status", ""),
                "FailureReason": failure_reason.replace(",", ";"),
                "RootActivityId": job.get("rootActivityId", ""),
                "StartTimeUtc": effective_start,
                "EndTimeUtc": effective_end,
                "DurationSeconds": duration,
                "CorrelationGroup": "",
                "IngestedAt": now,
            })

print(f"Collected {len(all_events)} job events")

# Cell 5: Ingest into Eventhouse
# ─────────────────────────────────────────────────────────────────────────────

def kusto_ingest(table, rows):
    """Ingest rows into KQL table using inline ingestion."""
    if not rows:
        return 0

    ingested = 0
    for row in rows:
        values = ",".join(str(row.get(k, "")) for k in [
            "EventId", "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
            "ItemType", "JobType", "InvokeType", "Status", "FailureReason",
            "RootActivityId", "StartTimeUtc", "EndTimeUtc", "DurationSeconds",
            "CorrelationGroup", "IngestedAt"
        ])
        csl = f".ingest inline into table {table} <| {values}"

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

    return ingested

count = kusto_ingest("FabricEvents", all_events)
print(f"Ingested {count}/{len(all_events)} events into FabricEvents")

# Cell 6: Update workspace inventory
# ─────────────────────────────────────────────────────────────────────────────

inventory_rows = []
for ws_id, ws_data in workspace_items.items():
    ws = ws_data["workspace"]
    for item in ws_data["items"]:
        inventory_rows.append({
            "WorkspaceId": ws_id,
            "WorkspaceName": ws["displayName"],
            "ItemId": item["id"],
            "ItemName": item["displayName"],
            "ItemType": item["type"],
            "CapacityId": ws.get("capacityId", ""),
            "DiscoveredAt": now,
            "LastSeenAt": now,
        })

inv_count = 0
for row in inventory_rows:
    values = ",".join(str(row.get(k, "")) for k in [
        "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
        "ItemType", "CapacityId", "DiscoveredAt", "LastSeenAt"
    ])
    csl = f".ingest inline into table WorkspaceInventory <| {values}"
    resp = requests.post(
        f"{KUSTO_URI}/v1/rest/mgmt",
        headers={
            "Authorization": f"Bearer {kusto_token}",
            "Content-Type": "application/json",
        },
        json={"db": KUSTO_DB, "csl": csl},
    )
    if resp.status_code == 200:
        inv_count += 1

print(f"Inventoried {inv_count}/{len(inventory_rows)} items")

# Cell 7: Summary
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n{'='*60}")
print(f"NB_ObsIngestion completed at {datetime.now(timezone.utc).isoformat()}")
print(f"  Workspaces scanned: {len(workspaces)}")
print(f"  Job events ingested: {count}")
print(f"  Inventory items updated: {inv_count}")
print(f"{'='*60}")
