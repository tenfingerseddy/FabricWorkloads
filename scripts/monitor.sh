#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────
# Observability Workbench - Continuous Monitoring
#
# Runs the observability workbench in continuous monitoring mode.
# Collection runs every 5 minutes by default.
#
# Usage:
#   ./scripts/monitor.sh
#
# Environment:
#   FABRIC_TENANT_ID      - Azure AD tenant ID
#   FABRIC_CLIENT_ID      - Service principal client ID
#   FABRIC_CLIENT_SECRET  - Service principal client secret
#   OBS_POLL_INTERVAL_MS  - (optional) Override poll interval in ms
# ───────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Verify environment
for VAR in FABRIC_TENANT_ID FABRIC_CLIENT_ID FABRIC_CLIENT_SECRET; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "ERROR: $VAR is not set. Export it before running this script." >&2
    exit 1
  fi
done

cd "$PROJECT_DIR"

# Install deps if needed
if [[ ! -d "node_modules" ]]; then
  echo "[monitor.sh] Installing dependencies..."
  npm install --silent
fi

echo "[monitor.sh] Starting continuous monitoring..."
echo "[monitor.sh] Press Ctrl+C to stop."
echo ""

exec node --import tsx src/index.ts --mode monitor
