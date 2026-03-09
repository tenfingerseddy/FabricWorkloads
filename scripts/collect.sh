#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────
# Observability Workbench - One-shot Collection
#
# Runs a single collection cycle: discover workspaces, collect jobs,
# compute SLO metrics, display the dashboard, and persist results.
#
# Usage:
#   ./scripts/collect.sh              # Full collect + dashboard
#   ./scripts/collect.sh --collect    # Collect only (no dashboard)
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
  echo "[collect.sh] Installing dependencies..."
  npm install --silent
fi

# Determine mode
MODE="full"
if [[ "${1:-}" == "--collect" ]]; then
  MODE="collect"
fi

echo "[collect.sh] Starting collection (mode: $MODE)..."
exec node --import tsx src/index.ts --mode "$MODE"
