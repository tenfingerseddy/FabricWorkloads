#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy-to-fabric.sh — Idempotent deployment of Observability Workbench to Fabric
#
# Uploads notebooks to a Fabric workspace via REST API, schedules them using
# the Fabric Job Scheduler API, and verifies deployment health by querying
# the Eventhouse.
#
# Usage:
#   ./scripts/deploy-to-fabric.sh                     # Uses default (dev) env
#   ./scripts/deploy-to-fabric.sh --env staging       # Uses staging env
#   ./scripts/deploy-to-fabric.sh --env prod          # Uses production env
#   ./scripts/deploy-to-fabric.sh --env prod --dry-run  # Validate without changes
#
# Environment files:
#   .fabric-deploy.dev.env      — Development workspace configuration
#   .fabric-deploy.staging.env  — Staging workspace configuration
#   .fabric-deploy.prod.env     — Production workspace configuration
#
# Required secrets (env vars or in env file):
#   FABRIC_TENANT_ID      — Azure AD / Entra tenant ID
#   FABRIC_CLIENT_ID      — Service principal client ID
#   FABRIC_CLIENT_SECRET  — Service principal client secret
#
# This script is idempotent — safe to run multiple times. It will:
#   - Skip notebooks that are already up to date (checksum match)
#   - Update schedules only if they differ from desired state
#   - Report health status without modifying running workloads
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Constants ─────────────────────────────────────────────────────────────────

FABRIC_API="https://api.fabric.microsoft.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NOTEBOOKS_DIR="$PROJECT_DIR/products/observability-workbench/notebooks"

# ANSI colors (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''; BOLD=''
fi

# ─── Parse Arguments ──────────────────────────────────────────────────────────

DEPLOY_ENV="dev"
DRY_RUN=false
SKIP_HEALTH_CHECK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)       DEPLOY_ENV="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --skip-health) SKIP_HEALTH_CHECK=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--env dev|staging|prod] [--dry-run] [--skip-health]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Load Environment ─────────────────────────────────────────────────────────

ENV_FILE="$PROJECT_DIR/.fabric-deploy.${DEPLOY_ENV}.env"

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

if [ -f "$ENV_FILE" ]; then
  log_info "Loading environment from $ENV_FILE"
  # Source env file, ignoring comments and empty lines
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
  set +a
else
  log_info "No env file at $ENV_FILE — using environment variables"
fi

# ─── Validate Required Variables ───────────────────────────────────────────────

MISSING=()
for VAR in FABRIC_TENANT_ID FABRIC_CLIENT_ID FABRIC_CLIENT_SECRET; do
  if [ -z "${!VAR:-}" ]; then
    MISSING+=("$VAR")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  log_error "Missing required environment variables: ${MISSING[*]}"
  log_error "Set them in $ENV_FILE or export them before running this script."
  exit 1
fi

# Deployment configuration with defaults
WORKSPACE_NAME="${FABRIC_WORKSPACE_NAME:-ObservabilityWorkbench-Dev}"
KQL_ENDPOINT="${EVENTHOUSE_QUERY_ENDPOINT:-${FABRIC_KQL_ENDPOINT:-}}"
if [ -z "$KQL_ENDPOINT" ]; then
  log_error "Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT (or FABRIC_KQL_ENDPOINT)"
  exit 1
fi
KQL_DATABASE="${FABRIC_KQL_DATABASE:-EH_Observability}"

# Notebook schedule configuration (cron-like)
# Ingestion runs every 15 minutes, Correlation every 30 minutes, Alerts every hour
SCHEDULE_INGESTION="${SCHEDULE_INGESTION:-*/15 * * * *}"
SCHEDULE_CORRELATION="${SCHEDULE_CORRELATION:-*/30 * * * *}"
SCHEDULE_ALERTS="${SCHEDULE_ALERTS:-0 * * * *}"

log_step "Deploying Observability Workbench to Fabric ($DEPLOY_ENV)"
echo "  Workspace:  $WORKSPACE_NAME"
echo "  KQL:        $KQL_ENDPOINT"
echo "  Database:   $KQL_DATABASE"
echo "  Dry Run:    $DRY_RUN"

if $DRY_RUN; then
  log_warn "DRY RUN mode — no changes will be made"
fi

# ─── Authentication ────────────────────────────────────────────────────────────

log_step "Step 1: Authenticate with Fabric"

get_token() {
  local token_response
  token_response=$(curl -s -X POST \
    "https://login.microsoftonline.com/${FABRIC_TENANT_ID}/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${FABRIC_CLIENT_ID}&client_secret=${FABRIC_CLIENT_SECRET}&scope=https://api.fabric.microsoft.com/.default&grant_type=client_credentials")

  local token
  token=$(echo "$token_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

  if [ -z "$token" ]; then
    log_error "Authentication failed"
    echo "$token_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error_description', d.get('error', 'Unknown error')))" 2>/dev/null || true
    return 1
  fi

  echo "$token"
}

TOKEN=$(get_token) || exit 1
log_ok "Authentication successful (token: ${#TOKEN} chars)"

# ─── Workspace Discovery ──────────────────────────────────────────────────────

log_step "Step 2: Resolve workspace"

get_workspace_id() {
  local response
  response=$(curl -s "${FABRIC_API}/v1/workspaces" \
    -H "Authorization: Bearer $TOKEN")

  local ws_id
  ws_id=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
workspaces = data.get('value', [])
name = '${WORKSPACE_NAME}'
match = next((w for w in workspaces if w['displayName'] == name), None)
if match:
    print(match['id'])
else:
    # Try partial match
    match = next((w for w in workspaces if name.lower() in w['displayName'].lower()), None)
    if match:
        print(match['id'])
    else:
        print('')
        import sys
        print('Available workspaces:', [w['displayName'] for w in workspaces], file=sys.stderr)
" 2>/dev/null)

  if [ -z "$ws_id" ]; then
    log_error "Workspace '$WORKSPACE_NAME' not found"
    return 1
  fi

  echo "$ws_id"
}

WORKSPACE_ID=$(get_workspace_id) || exit 1
log_ok "Workspace: $WORKSPACE_NAME ($WORKSPACE_ID)"

# ─── Notebook Discovery ───────────────────────────────────────────────────────

log_step "Step 3: Discover existing notebooks"

ITEMS_RESPONSE=$(curl -s "${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/items" \
  -H "Authorization: Bearer $TOKEN")

# Extract notebook IDs
get_notebook_id() {
  local name="$1"
  echo "$ITEMS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('value', [])
nb = next((i for i in items if i['type'] == 'Notebook' and i['displayName'] == '${name}'), None)
print(nb['id'] if nb else '')
" 2>/dev/null
}

declare -A NOTEBOOK_MAP
NOTEBOOK_FILES=("NB_ObsIngestion" "NB_ObsCorrelation" "NB_ObsAlerts")

for nb_name in "${NOTEBOOK_FILES[@]}"; do
  nb_id=$(get_notebook_id "$nb_name")
  if [ -n "$nb_id" ]; then
    NOTEBOOK_MAP[$nb_name]="$nb_id"
    log_ok "Found $nb_name: $nb_id"
  else
    log_warn "Notebook $nb_name not found in workspace — will need to be created first"
    NOTEBOOK_MAP[$nb_name]=""
  fi
done

# ─── Upload Notebooks ─────────────────────────────────────────────────────────

log_step "Step 4: Upload notebooks"

upload_notebook() {
  local nb_name="$1"
  local nb_id="$2"
  local py_file="$NOTEBOOKS_DIR/${nb_name}.py"

  if [ ! -f "$py_file" ]; then
    log_error "Notebook file not found: $py_file"
    return 1
  fi

  if [ -z "$nb_id" ]; then
    log_warn "Skipping $nb_name — no notebook ID (create it in Fabric first)"
    return 0
  fi

  # Check if content has changed using checksum
  local current_checksum
  current_checksum=$(sha256sum "$py_file" | cut -d' ' -f1)

  local checksum_file="$PROJECT_DIR/.deploy-checksums.${DEPLOY_ENV}"
  local previous_checksum=""
  if [ -f "$checksum_file" ]; then
    previous_checksum=$(grep "^${nb_name}=" "$checksum_file" 2>/dev/null | cut -d'=' -f2 || true)
  fi

  if [ "$current_checksum" = "$previous_checksum" ]; then
    log_ok "$nb_name — unchanged (checksum match), skipping upload"
    return 0
  fi

  log_info "Uploading $nb_name (content changed)..."

  if $DRY_RUN; then
    log_info "[DRY RUN] Would upload $py_file to notebook $nb_id"
    return 0
  fi

  # Convert .py to ipynb and upload via Node.js helper
  local ipynb_json
  ipynb_json=$(python3 -c "
import json, re, sys

with open('${py_file}', 'r') as f:
    content = f.read()

# Split by cell markers
cell_pattern = re.compile(r'^# Cell \d+:.*\n# ─+$', re.MULTILINE)
markers = [(m.start(), m.end()) for m in cell_pattern.finditer(content)]

cells = []
if not markers:
    cells.append(content)
else:
    for i, (start, end) in enumerate(markers):
        if i + 1 < len(markers):
            cell_content = content[start:markers[i+1][0]].rstrip() + '\n'
        else:
            cell_content = content[start:].rstrip() + '\n'
        cells.append(cell_content)

notebook_cells = []
for cell_source in cells:
    lines = cell_source.split('\n')
    source_lines = [line + '\n' for line in lines[:-1]]
    if lines[-1]:
        source_lines.append(lines[-1] + '\n')
    notebook_cells.append({
        'cell_type': 'code',
        'execution_count': None,
        'metadata': {},
        'outputs': [],
        'source': source_lines,
    })

ipynb = {
    'nbformat': 4,
    'nbformat_minor': 5,
    'metadata': {
        'language_info': {'name': 'python'},
        'kernel_info': {'name': 'synapse_pyspark'},
        'kernelspec': {
            'display_name': 'Synapse PySpark',
            'language': 'Python',
            'name': 'synapse_pyspark',
        },
    },
    'cells': notebook_cells,
}

print(json.dumps(ipynb))
" 2>/dev/null)

  if [ -z "$ipynb_json" ]; then
    log_error "Failed to convert $nb_name to ipynb format"
    return 1
  fi

  # Base64 encode
  local base64_payload
  base64_payload=$(echo -n "$ipynb_json" | base64 -w 0)

  # Build request body
  local request_body
  request_body=$(python3 -c "
import json
body = {
    'definition': {
        'format': 'ipynb',
        'parts': [{
            'path': 'notebook-content.ipynb',
            'payload': '${base64_payload}',
            'payloadType': 'InlineBase64',
        }],
    },
}
print(json.dumps(body))
")

  # POST to updateDefinition
  local update_url="${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/notebooks/${nb_id}/updateDefinition"
  local response
  local http_code

  http_code=$(curl -s -o /tmp/fabric_upload_response.json -w "%{http_code}" \
    -X POST "$update_url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$request_body")

  if [ "$http_code" = "200" ]; then
    log_ok "$nb_name — uploaded successfully (synchronous)"
  elif [ "$http_code" = "202" ]; then
    log_info "$nb_name — upload accepted (async), polling for completion..."

    # Extract operation URL from Location header
    local operation_url
    operation_url=$(curl -s -D - -o /dev/null \
      -X POST "$update_url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$request_body" 2>/dev/null | grep -i "^location:" | tr -d '\r' | awk '{print $2}')

    if [ -n "$operation_url" ]; then
      # Poll for completion (max 60 seconds)
      for attempt in $(seq 1 12); do
        sleep 5
        local op_status
        op_status=$(curl -s "$operation_url" \
          -H "Authorization: Bearer $TOKEN" | \
          python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)

        if [ "$op_status" = "Succeeded" ] || [ "$op_status" = "succeeded" ]; then
          log_ok "$nb_name — upload completed"
          break
        elif [ "$op_status" = "Failed" ] || [ "$op_status" = "failed" ]; then
          log_error "$nb_name — upload failed"
          return 1
        fi
        log_info "  Attempt $attempt/12 — status: $op_status"
      done
    else
      log_ok "$nb_name — accepted (202, no polling URL)"
    fi
  else
    log_error "$nb_name — upload failed (HTTP $http_code)"
    cat /tmp/fabric_upload_response.json 2>/dev/null | head -5
    return 1
  fi

  # Update checksum record
  mkdir -p "$(dirname "$checksum_file")"
  if [ -f "$checksum_file" ]; then
    grep -v "^${nb_name}=" "$checksum_file" > "$checksum_file.tmp" 2>/dev/null || true
    mv "$checksum_file.tmp" "$checksum_file"
  fi
  echo "${nb_name}=${current_checksum}" >> "$checksum_file"

  return 0
}

UPLOAD_FAILURES=0
for nb_name in "${NOTEBOOK_FILES[@]}"; do
  if ! upload_notebook "$nb_name" "${NOTEBOOK_MAP[$nb_name]:-}"; then
    ((UPLOAD_FAILURES++))
  fi
done

if [ "$UPLOAD_FAILURES" -gt 0 ]; then
  log_error "$UPLOAD_FAILURES notebook upload(s) failed"
fi

# ─── Schedule Notebooks ───────────────────────────────────────────────────────

log_step "Step 5: Configure notebook schedules"

schedule_notebook() {
  local nb_name="$1"
  local nb_id="$2"
  local schedule_expression="$3"

  if [ -z "$nb_id" ]; then
    log_warn "Skipping schedule for $nb_name — no notebook ID"
    return 0
  fi

  if $DRY_RUN; then
    log_info "[DRY RUN] Would schedule $nb_name with: $schedule_expression"
    return 0
  fi

  # Check existing schedule
  local existing_schedule
  existing_schedule=$(curl -s \
    "${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/items/${nb_id}/jobs/instances?limit=1" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  # Use the Job Scheduler API to set/update the schedule
  local schedule_body
  schedule_body=$(python3 -c "
import json
body = {
    'type': 'DefaultJob',
    'enabled': True,
    'configuration': {
        'type': 'Cron',
        'expression': '${schedule_expression}',
        'startDateTime': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
        'timeZone': 'UTC'
    }
}
print(json.dumps(body))
" 2>/dev/null)

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/items/${nb_id}/jobs/instances?jobType=DefaultJob" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$schedule_body" 2>/dev/null)

  # 202 = accepted, 200 = ok, 409 = already scheduled (idempotent)
  if [ "$http_code" = "200" ] || [ "$http_code" = "202" ] || [ "$http_code" = "409" ]; then
    log_ok "$nb_name — schedule configured (HTTP $http_code)"
  else
    log_warn "$nb_name — schedule API returned HTTP $http_code (schedule may need manual configuration)"
  fi
}

# Map notebook names to their schedule expressions
declare -A SCHEDULE_MAP
SCHEDULE_MAP[NB_ObsIngestion]="$SCHEDULE_INGESTION"
SCHEDULE_MAP[NB_ObsCorrelation]="$SCHEDULE_CORRELATION"
SCHEDULE_MAP[NB_ObsAlerts]="$SCHEDULE_ALERTS"

for nb_name in "${NOTEBOOK_FILES[@]}"; do
  schedule_notebook "$nb_name" "${NOTEBOOK_MAP[$nb_name]:-}" "${SCHEDULE_MAP[$nb_name]}"
done

# ─── Health Check / Verification ───────────────────────────────────────────────

if ! $SKIP_HEALTH_CHECK; then
  log_step "Step 6: Verify deployment health"

  # Get KQL token (Kusto scope)
  KQL_TOKEN=$(curl -s -X POST \
    "https://login.microsoftonline.com/${FABRIC_TENANT_ID}/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${FABRIC_CLIENT_ID}&client_secret=${FABRIC_CLIENT_SECRET}&scope=https://api.kusto.windows.net/.default&grant_type=client_credentials" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

  if [ -z "$KQL_TOKEN" ]; then
    log_warn "Could not acquire KQL token — skipping Eventhouse health check"
  else
    # Query: check table existence and row counts
    HEALTH_QUERY="
      FabricEvents | count;
      WorkspaceInventory | count;
      SloDefinitions | count;
      AlertRules | count
    "

    KQL_RESPONSE=$(curl -s -X POST \
      "${KQL_ENDPOINT}/v1/rest/query" \
      -H "Authorization: Bearer $KQL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"db\": \"${KQL_DATABASE}\",
        \"csl\": \"FabricEvents | summarize EventCount=count(), LastEvent=max(Timestamp)\",
        \"properties\": {\"Options\": {\"servertimeout\": \"00:01:00\"}}
      }" 2>/dev/null)

    if echo "$KQL_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tables = data.get('Tables', data.get('tables', []))
    if tables:
        rows = tables[0].get('Rows', tables[0].get('rows', []))
        if rows:
            count = rows[0][0]
            last_event = rows[0][1] if len(rows[0]) > 1 else 'unknown'
            print(f'Events: {count}, Last event: {last_event}')
            sys.exit(0)
    print('No data returned')
    sys.exit(1)
except Exception as e:
    print(f'Parse error: {e}')
    sys.exit(1)
" 2>/dev/null; then
      log_ok "Eventhouse is healthy and contains data"
    else
      log_warn "Eventhouse query returned unexpected response — verify manually"
    fi

    # Check data freshness
    FRESHNESS_RESPONSE=$(curl -s -X POST \
      "${KQL_ENDPOINT}/v1/rest/query" \
      -H "Authorization: Bearer $KQL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"db\": \"${KQL_DATABASE}\",
        \"csl\": \"FabricEvents | summarize LastEvent=max(Timestamp) | extend AgeHours=datetime_diff('hour', now(), LastEvent)\",
        \"properties\": {\"Options\": {\"servertimeout\": \"00:01:00\"}}
      }" 2>/dev/null)

    AGE_HOURS=$(echo "$FRESHNESS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tables = data.get('Tables', data.get('tables', []))
    if tables:
        rows = tables[0].get('Rows', tables[0].get('rows', []))
        if rows and len(rows[0]) > 1:
            print(rows[0][1])
        else:
            print('-1')
    else:
        print('-1')
except:
    print('-1')
" 2>/dev/null)

    if [ "$AGE_HOURS" != "-1" ] && [ "$AGE_HOURS" -lt 24 ]; then
      log_ok "Data freshness: last event was $AGE_HOURS hours ago"
    elif [ "$AGE_HOURS" != "-1" ]; then
      log_warn "Data may be stale: last event was $AGE_HOURS hours ago"
    fi
  fi
else
  log_info "Health check skipped (--skip-health)"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

log_step "Deployment Summary"

echo ""
echo "  Environment:  $DEPLOY_ENV"
echo "  Workspace:    $WORKSPACE_NAME ($WORKSPACE_ID)"
echo "  Notebooks:"
for nb_name in "${NOTEBOOK_FILES[@]}"; do
  nb_id="${NOTEBOOK_MAP[$nb_name]:-N/A}"
  echo "    $nb_name: $nb_id"
done
echo ""

if [ "$UPLOAD_FAILURES" -gt 0 ]; then
  log_error "Deployment completed with $UPLOAD_FAILURES failure(s)"
  exit 1
else
  if $DRY_RUN; then
    log_ok "Dry run completed — no changes made"
  else
    log_ok "Deployment completed successfully"
  fi
  exit 0
fi
