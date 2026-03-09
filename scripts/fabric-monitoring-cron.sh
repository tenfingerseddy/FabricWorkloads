#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# fabric-monitoring-cron.sh — Lightweight Fabric health monitoring
#
# Checks the health of the Observability Workbench infrastructure:
#   1. Eventhouse connectivity
#   2. Data freshness (last event < threshold)
#   3. Notebook schedule health (job failure rate)
#   4. SLO breach status
#
# Exit codes:
#   0 — Healthy: all checks pass
#   1 — Degraded: some checks have warnings
#   2 — Critical: critical checks failing
#
# Output format:
#   Each check outputs a structured line for easy parsing:
#     CHECK:<name>:<status>:<message>
#
# Usage:
#   FABRIC_TENANT_ID=xxx FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=xxx \
#     ./scripts/fabric-monitoring-cron.sh
#
# Cron example (every 6 hours):
#   0 */6 * * * /path/to/fabric-monitoring-cron.sh >> /var/log/fabric-health.log 2>&1
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────

FABRIC_API="https://api.fabric.microsoft.com"
KQL_ENDPOINT="${EVENTHOUSE_QUERY_ENDPOINT:-${FABRIC_KQL_ENDPOINT:-}}"
if [ -z "$KQL_ENDPOINT" ]; then
  echo "HEALTH_CHECK:${TIMESTAMP}:critical:Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT"
  exit 2
fi
KQL_DATABASE="${FABRIC_KQL_DATABASE:-EH_Observability}"
WORKSPACE_NAME="${FABRIC_WORKSPACE_NAME:-ObservabilityWorkbench-Dev}"

# Thresholds
DATA_FRESHNESS_WARN_HOURS="${DATA_FRESHNESS_WARN_HOURS:-2}"
DATA_FRESHNESS_CRIT_HOURS="${DATA_FRESHNESS_CRIT_HOURS:-6}"
JOB_FAILURE_WARN_PERCENT="${JOB_FAILURE_WARN_PERCENT:-20}"
JOB_FAILURE_CRIT_PERCENT="${JOB_FAILURE_CRIT_PERCENT:-50}"

# Tracking
OVERALL_STATUS="healthy"
CHECKS_RUN=0
CHECKS_PASSED=0
CHECKS_WARNED=0
CHECKS_FAILED=0
REPORT_LINES=()

# Timestamp for log output
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─── Helper Functions ──────────────────────────────────────────────────────────

report_check() {
  local name="$1"
  local status="$2"    # ok, warn, critical
  local message="$3"

  ((CHECKS_RUN++))

  case "$status" in
    ok)
      ((CHECKS_PASSED++))
      ;;
    warn)
      ((CHECKS_WARNED++))
      if [ "$OVERALL_STATUS" = "healthy" ]; then
        OVERALL_STATUS="degraded"
      fi
      ;;
    critical)
      ((CHECKS_FAILED++))
      OVERALL_STATUS="critical"
      ;;
  esac

  local line="CHECK:${name}:${status}:${message}"
  REPORT_LINES+=("$line")
  echo "$line"
}

# ─── Validate Environment ─────────────────────────────────────────────────────

if [ -z "${FABRIC_TENANT_ID:-}" ] || [ -z "${FABRIC_CLIENT_ID:-}" ] || [ -z "${FABRIC_CLIENT_SECRET:-}" ]; then
  echo "HEALTH_CHECK:${TIMESTAMP}:critical:Missing required environment variables (FABRIC_TENANT_ID, FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET)"
  exit 2
fi

echo "HEALTH_CHECK:${TIMESTAMP}:start:Fabric Observability Workbench Health Check"

# ─── Check 1: Authentication ──────────────────────────────────────────────────

get_fabric_token() {
  curl -s --max-time 30 -X POST \
    "https://login.microsoftonline.com/${FABRIC_TENANT_ID}/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${FABRIC_CLIENT_ID}&client_secret=${FABRIC_CLIENT_SECRET}&scope=https://api.fabric.microsoft.com/.default&grant_type=client_credentials" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null
}

get_kql_token() {
  curl -s --max-time 30 -X POST \
    "https://login.microsoftonline.com/${FABRIC_TENANT_ID}/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${FABRIC_CLIENT_ID}&client_secret=${FABRIC_CLIENT_SECRET}&scope=https://api.kusto.windows.net/.default&grant_type=client_credentials" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null
}

FABRIC_TOKEN=$(get_fabric_token)
if [ -z "$FABRIC_TOKEN" ]; then
  report_check "auth_fabric" "critical" "Failed to authenticate with Fabric API"
  echo "HEALTH_CHECK:${TIMESTAMP}:complete:${OVERALL_STATUS}:${CHECKS_PASSED}/${CHECKS_RUN} passed"
  exit 2
fi
report_check "auth_fabric" "ok" "Fabric API authentication successful"

KQL_TOKEN=$(get_kql_token)
if [ -z "$KQL_TOKEN" ]; then
  report_check "auth_kql" "critical" "Failed to authenticate with KQL/Kusto endpoint"
else
  report_check "auth_kql" "ok" "KQL endpoint authentication successful"
fi

# ─── Check 2: Eventhouse Connectivity ─────────────────────────────────────────

if [ -n "$KQL_TOKEN" ]; then
  KQL_RESPONSE=$(curl -s --max-time 30 -X POST \
    "${KQL_ENDPOINT}/v1/rest/query" \
    -H "Authorization: Bearer $KQL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"db\": \"${KQL_DATABASE}\",
      \"csl\": \"print Status='OK', Timestamp=now()\",
      \"properties\": {\"Options\": {\"servertimeout\": \"00:00:30\"}}
    }" 2>/dev/null)

  if echo "$KQL_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tables = data.get('Tables', data.get('tables', []))
if tables and tables[0].get('Rows', tables[0].get('rows', [])):
    sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    report_check "eventhouse_connectivity" "ok" "Eventhouse is reachable and responding"
  else
    report_check "eventhouse_connectivity" "critical" "Eventhouse query failed or returned empty response"
  fi
else
  report_check "eventhouse_connectivity" "critical" "Skipped — no KQL token"
fi

# ─── Check 3: Data Freshness ──────────────────────────────────────────────────

if [ -n "$KQL_TOKEN" ]; then
  FRESHNESS_RESPONSE=$(curl -s --max-time 30 -X POST \
    "${KQL_ENDPOINT}/v1/rest/query" \
    -H "Authorization: Bearer $KQL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"db\": \"${KQL_DATABASE}\",
      \"csl\": \"FabricEvents | summarize TotalEvents=count(), LastEvent=max(Timestamp) | extend AgeHours=datetime_diff('hour', now(), LastEvent)\",
      \"properties\": {\"Options\": {\"servertimeout\": \"00:00:30\"}}
    }" 2>/dev/null)

  FRESHNESS_DATA=$(echo "$FRESHNESS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tables = data.get('Tables', data.get('tables', []))
    if tables:
        rows = tables[0].get('Rows', tables[0].get('rows', []))
        if rows:
            total_events = rows[0][0]
            last_event = rows[0][1]
            age_hours = rows[0][2]
            print(f'{total_events}|{last_event}|{age_hours}')
        else:
            print('0|never|999')
    else:
        print('ERROR')
except Exception as e:
    print('ERROR')
" 2>/dev/null)

  if [ "$FRESHNESS_DATA" = "ERROR" ]; then
    report_check "data_freshness" "critical" "Failed to query data freshness from FabricEvents table"
  else
    IFS='|' read -r TOTAL_EVENTS LAST_EVENT AGE_HOURS <<< "$FRESHNESS_DATA"

    if [ "$TOTAL_EVENTS" = "0" ]; then
      report_check "data_freshness" "warn" "FabricEvents table is empty — no data ingested yet"
    elif [ "$AGE_HOURS" -ge "$DATA_FRESHNESS_CRIT_HOURS" ]; then
      report_check "data_freshness" "critical" "Data is stale: last event was ${AGE_HOURS}h ago (threshold: ${DATA_FRESHNESS_CRIT_HOURS}h), total events: ${TOTAL_EVENTS}"
    elif [ "$AGE_HOURS" -ge "$DATA_FRESHNESS_WARN_HOURS" ]; then
      report_check "data_freshness" "warn" "Data freshness warning: last event was ${AGE_HOURS}h ago (threshold: ${DATA_FRESHNESS_WARN_HOURS}h), total events: ${TOTAL_EVENTS}"
    else
      report_check "data_freshness" "ok" "Data is fresh: last event ${AGE_HOURS}h ago, total events: ${TOTAL_EVENTS}"
    fi
  fi
else
  report_check "data_freshness" "critical" "Skipped — no KQL token"
fi

# ─── Check 4: Notebook Job Health ─────────────────────────────────────────────

# Resolve workspace ID
WORKSPACE_ID=$(curl -s --max-time 30 "${FABRIC_API}/v1/workspaces" \
  -H "Authorization: Bearer $FABRIC_TOKEN" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
ws = next((w for w in data.get('value', []) if w['displayName'] == '${WORKSPACE_NAME}'), None)
print(ws['id'] if ws else '')
" 2>/dev/null)

if [ -z "$WORKSPACE_ID" ]; then
  report_check "workspace" "warn" "Workspace '${WORKSPACE_NAME}' not found"
else
  report_check "workspace" "ok" "Workspace found: ${WORKSPACE_NAME} (${WORKSPACE_ID})"

  # Get notebooks and check their recent job history
  ITEMS=$(curl -s --max-time 30 \
    "${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/items" \
    -H "Authorization: Bearer $FABRIC_TOKEN" 2>/dev/null)

  NOTEBOOK_IDS=$(echo "$ITEMS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
notebooks = [i for i in data.get('value', []) if i['type'] == 'Notebook' and i['displayName'].startswith('NB_Obs')]
for nb in notebooks:
    print(f\"{nb['id']}|{nb['displayName']}\")
" 2>/dev/null)

  if [ -z "$NOTEBOOK_IDS" ]; then
    report_check "notebook_jobs" "warn" "No observability notebooks found in workspace"
  else
    TOTAL_JOBS=0
    FAILED_JOBS=0

    while IFS='|' read -r NB_ID NB_NAME; do
      if [ -z "$NB_ID" ]; then continue; fi

      JOB_RESPONSE=$(curl -s --max-time 30 \
        "${FABRIC_API}/v1/workspaces/${WORKSPACE_ID}/items/${NB_ID}/jobs/instances?limit=10" \
        -H "Authorization: Bearer $FABRIC_TOKEN" 2>/dev/null)

      JOB_STATS=$(echo "$JOB_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    jobs = data.get('value', [])
    total = len(jobs)
    failed = len([j for j in jobs if j.get('status') == 'Failed'])
    print(f'{total}|{failed}')
except:
    print('0|0')
" 2>/dev/null)

      IFS='|' read -r NB_TOTAL NB_FAILED <<< "$JOB_STATS"
      TOTAL_JOBS=$((TOTAL_JOBS + NB_TOTAL))
      FAILED_JOBS=$((FAILED_JOBS + NB_FAILED))

      if [ "$NB_TOTAL" -gt 0 ] && [ "$NB_FAILED" -gt 0 ]; then
        FAIL_RATE=$((NB_FAILED * 100 / NB_TOTAL))
        if [ "$FAIL_RATE" -ge "$JOB_FAILURE_CRIT_PERCENT" ]; then
          report_check "notebook_${NB_NAME}" "critical" "${NB_FAILED}/${NB_TOTAL} recent jobs failed (${FAIL_RATE}%)"
        elif [ "$FAIL_RATE" -ge "$JOB_FAILURE_WARN_PERCENT" ]; then
          report_check "notebook_${NB_NAME}" "warn" "${NB_FAILED}/${NB_TOTAL} recent jobs failed (${FAIL_RATE}%)"
        else
          report_check "notebook_${NB_NAME}" "ok" "${NB_FAILED}/${NB_TOTAL} recent jobs failed (${FAIL_RATE}%)"
        fi
      elif [ "$NB_TOTAL" -eq 0 ]; then
        report_check "notebook_${NB_NAME}" "warn" "No recent job runs found"
      else
        report_check "notebook_${NB_NAME}" "ok" "${NB_TOTAL} recent jobs, none failed"
      fi
    done <<< "$NOTEBOOK_IDS"

    # Overall job health
    if [ "$TOTAL_JOBS" -gt 0 ]; then
      OVERALL_FAIL_RATE=$((FAILED_JOBS * 100 / TOTAL_JOBS))
      if [ "$OVERALL_FAIL_RATE" -ge "$JOB_FAILURE_CRIT_PERCENT" ]; then
        report_check "notebook_jobs_overall" "critical" "Overall: ${FAILED_JOBS}/${TOTAL_JOBS} jobs failed (${OVERALL_FAIL_RATE}%)"
      elif [ "$OVERALL_FAIL_RATE" -ge "$JOB_FAILURE_WARN_PERCENT" ]; then
        report_check "notebook_jobs_overall" "warn" "Overall: ${FAILED_JOBS}/${TOTAL_JOBS} jobs failed (${OVERALL_FAIL_RATE}%)"
      else
        report_check "notebook_jobs_overall" "ok" "Overall: ${FAILED_JOBS}/${TOTAL_JOBS} jobs failed (${OVERALL_FAIL_RATE}%)"
      fi
    fi
  fi
fi

# ─── Check 5: SLO Breach Status ───────────────────────────────────────────────

if [ -n "$KQL_TOKEN" ]; then
  SLO_RESPONSE=$(curl -s --max-time 30 -X POST \
    "${KQL_ENDPOINT}/v1/rest/query" \
    -H "Authorization: Bearer $KQL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"db\": \"${KQL_DATABASE}\",
      \"csl\": \"SloSnapshots | where Timestamp > ago(24h) | summarize TotalSLOs=dcount(SloId), BreachedSLOs=dcountif(SloId, IsBreached == true) | extend BreachRate=round(todouble(BreachedSLOs)/todouble(TotalSLOs)*100, 1)\",
      \"properties\": {\"Options\": {\"servertimeout\": \"00:00:30\"}}
    }" 2>/dev/null)

  SLO_DATA=$(echo "$SLO_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tables = data.get('Tables', data.get('tables', []))
    if tables:
        rows = tables[0].get('Rows', tables[0].get('rows', []))
        if rows:
            total = rows[0][0]
            breached = rows[0][1]
            rate = rows[0][2] if len(rows[0]) > 2 else 0
            print(f'{total}|{breached}|{rate}')
        else:
            print('0|0|0')
    else:
        print('EMPTY')
except:
    print('ERROR')
" 2>/dev/null)

  if [ "$SLO_DATA" = "ERROR" ]; then
    report_check "slo_breaches" "warn" "Failed to query SLO breach status"
  elif [ "$SLO_DATA" = "EMPTY" ]; then
    report_check "slo_breaches" "ok" "No SLO data in last 24h (may be expected for new deployments)"
  else
    IFS='|' read -r SLO_TOTAL SLO_BREACHED SLO_RATE <<< "$SLO_DATA"

    if [ "$SLO_TOTAL" -eq 0 ]; then
      report_check "slo_breaches" "ok" "No SLO definitions active"
    elif [ "$SLO_BREACHED" -gt 0 ]; then
      report_check "slo_breaches" "warn" "${SLO_BREACHED}/${SLO_TOTAL} SLOs breached in last 24h (${SLO_RATE}%)"
    else
      report_check "slo_breaches" "ok" "All ${SLO_TOTAL} SLOs healthy — no breaches in last 24h"
    fi
  fi
else
  report_check "slo_breaches" "critical" "Skipped — no KQL token"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "HEALTH_CHECK:${TIMESTAMP}:complete:${OVERALL_STATUS}:${CHECKS_PASSED}/${CHECKS_RUN} passed, ${CHECKS_WARNED} warnings, ${CHECKS_FAILED} critical"

# Output JSON summary for machine parsing
python3 -c "
import json
report = {
    'timestamp': '${TIMESTAMP}',
    'status': '${OVERALL_STATUS}',
    'checks_run': ${CHECKS_RUN},
    'checks_passed': ${CHECKS_PASSED},
    'checks_warned': ${CHECKS_WARNED},
    'checks_failed': ${CHECKS_FAILED},
    'checks': [
        {'name': line.split(':')[1], 'status': line.split(':')[2], 'message': ':'.join(line.split(':')[3:])}
        for line in '''$(printf '%s\n' "${REPORT_LINES[@]}")'''.strip().split('\n')
        if line.startswith('CHECK:')
    ]
}
print(json.dumps(report, indent=2))
" 2>/dev/null > /tmp/fabric-health-report.json || true

# Exit with appropriate code
case "$OVERALL_STATUS" in
  healthy)  exit 0 ;;
  degraded) exit 1 ;;
  critical) exit 2 ;;
  *)        exit 2 ;;
esac
