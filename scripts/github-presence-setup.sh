#!/usr/bin/env bash
# =============================================================================
# GitHub Presence Setup for Observability Workbench
# =============================================================================
# Run from: D:/AI AGency/
# Prerequisites: gh CLI installed and authenticated, or set PAT below.
# =============================================================================

set -euo pipefail

REPO="tenfingerseddy/FabricWorkloads"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Retrieve PAT and configure auth ──────────────────────────────────────────

PAT=$(powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('GitHubPatWorkloads', 'User')" | tr -d '\r')

if [ -z "$PAT" ]; then
  echo "ERROR: GitHubPatWorkloads env var is empty. Set it first."
  exit 1
fi

echo "PAT retrieved (${#PAT} chars). Configuring git remote..."

cd "$ROOT_DIR"
git remote set-url origin "https://tenfingerseddy:${PAT}@github.com/${REPO}.git" 2>/dev/null || true

# Authenticate gh CLI with the PAT
export GH_TOKEN="$PAT"

echo ""
echo "=== Step 1: Update repo description and topics ==="
echo ""

gh repo edit "$REPO" \
  --description "Open-source observability workload for Microsoft Fabric -- SLO tracking, cross-item correlation, CU waste scoring, and proactive alerting"

gh repo edit "$REPO" \
  --add-topic microsoft-fabric \
  --add-topic observability \
  --add-topic data-engineering \
  --add-topic slo \
  --add-topic finops \
  --add-topic fabric-workload \
  --add-topic monitoring \
  --add-topic kql

echo "Done: Description and topics updated."

echo ""
echo "=== Step 2: Create GitHub Issues ==="
echo ""

# Issue 1: Deduplication materialized view
gh issue create --repo "$REPO" \
  --title "Add deduplication materialized view for FabricEvents" \
  --label "enhancement" \
  --body "## Summary

Create a KQL materialized view on the \`FabricEvents\` table that provides automatic read-time deduplication, ensuring queries always return the latest version of each event.

## Problem

The current ingestion pipeline can produce duplicate rows when:
- The scheduler runs overlapping collection windows
- A retry fires after a transient network error
- Multiple collector instances target the same workspace

Duplicates inflate success-rate and duration metrics and produce confusing incident timelines.

## Proposed Solution

Add a materialized view using \`arg_max(IngestedAt, *)\` grouped by \`EventId\`:

\`\`\`kql
.create materialized-view with (backfill=true) FabricEvents_Dedup on table FabricEvents
{
    FabricEvents
    | summarize arg_max(IngestedAt, *) by EventId
}
\`\`\`

Then update all dashboard and SLO queries to read from \`FabricEvents_Dedup\` instead of \`FabricEvents\`.

## Acceptance Criteria

- [ ] Materialized view created in \`create-tables.kql\`
- [ ] All queries in \`kql/\` reference the dedup view
- [ ] CLI collector handles ingestion idempotently
- [ ] Documentation updated in \`docs/\`
- [ ] Unit tests cover duplicate-event scenarios

## Priority: High"

echo "Created issue: Deduplication materialized view"

# Issue 2: Connect dashboard to live data
gh issue create --repo "$REPO" \
  --title "Connect workload dashboard to live Eventhouse data" \
  --label "enhancement" \
  --body "## Summary

Replace the hardcoded \`SAMPLE_SLO_CARDS\` array in \`WorkbenchDashboardDefaultView.tsx\` with live data fetched from the KQL Eventhouse via the Fabric workload backend.

## Problem

The current Fabric workload dashboard (\`workload/app/items/WorkbenchDashboard/WorkbenchDashboardDefaultView.tsx\`) renders a static array of sample SLO cards:

\`\`\`tsx
const SAMPLE_SLO_CARDS: SLOCardData[] = [
  { name: \"Sales Pipeline Daily\", ... },
  { name: \"Customer 360 Dataflow\", ... },
  ...
];
\`\`\`

This is fine for the design prototype but needs to be replaced with real data before any user-facing release.

## Proposed Solution

1. Add a backend API endpoint that executes KQL queries against the Eventhouse (e.g., \`/api/slo-cards\`)
2. Use the Fabric workload client SDK to call this endpoint from the frontend
3. Replace \`SAMPLE_SLO_CARDS\` with state managed by \`useEffect\` + \`useState\`
4. Add loading/error states
5. Support auto-refresh on a configurable interval

## Key Queries Needed

- SLO status: \`SloSnapshots | summarize arg_max(SnapshotTime, *) by SloId\`
- Recent failures: \`FabricEvents | where Status == \"Failed\" | top 20 by StartTimeUtc desc\`
- Correlation chains: \`EventCorrelations | summarize count() by CorrelationGroup\`

## Acceptance Criteria

- [ ] Dashboard loads real data from Eventhouse
- [ ] Loading spinner shown while fetching
- [ ] Error state with retry button on failure
- [ ] Auto-refresh every 60 seconds (configurable)
- [ ] Sample data kept as fallback for demo/offline mode
- [ ] Workload manifest updated if new API endpoints are needed

## Priority: High"

echo "Created issue: Connect dashboard to live data"

# Issue 3: HTML export
gh issue create --repo "$REPO" \
  --title "Add HTML export for SLO reports" \
  --label "feature" \
  --body "## Summary

Add the ability to export the current dashboard state as a standalone HTML file that can be shared via email, Teams, or embedded in wikis -- no authentication required to view.

## Use Case

Data engineers and platform owners frequently need to share SLO status in weekly reviews, incident postmortems, or management summaries. Currently there is no way to export or snapshot the dashboard state.

## Proposed Solution

### CLI Export

\`\`\`bash
npm run dashboard -- --export html --output ./report.html
\`\`\`

### Workload Export

Add an \"Export\" button to the WorkbenchDashboard toolbar that:
1. Serializes current SLO cards, incident timeline, and failed jobs into JSON
2. Renders them into a self-contained HTML template (inline CSS, no external deps)
3. Triggers a browser file download

### HTML Template Features

- SLO status grid with color-coded badges
- Incident timeline (last 24h / 7d / 30d)
- Failed jobs table
- CU waste summary
- Generation timestamp and workspace metadata
- Dark/light theme toggle
- Print-friendly layout via \`@media print\`

## Acceptance Criteria

- [ ] CLI \`--export html\` flag produces valid standalone HTML
- [ ] Workload dashboard has an Export button
- [ ] HTML file renders correctly in Chrome, Edge, Firefox
- [ ] No external network requests in exported HTML
- [ ] File size under 500KB for typical dashboards
- [ ] Tests for HTML generation

## Priority: Medium"

echo "Created issue: HTML export for SLO reports"

# Issue 4: Publish to Workload Hub
gh issue create --repo "$REPO" \
  --title "Publish to Fabric Workload Hub" \
  --label "epic" \
  --body "## Summary

Track all prerequisites and steps required to publish the Observability Workbench as an official workload in the Microsoft Fabric Workload Hub (AppSource / Fabric Marketplace).

## Why This Matters

Publishing to the Workload Hub is the primary distribution channel for Fabric workloads. It enables:
- One-click installation for Fabric administrators
- Visibility to all 22,000+ Fabric organizations
- Microsoft co-sell eligibility
- Built-in billing through Azure Marketplace

## Prerequisites Checklist

### Technical
- [ ] Workload passes Fabric certification validation
- [ ] All item types register correctly with Fabric runtime
- [ ] Jobs appear in Monitoring Hub
- [ ] OneLake integration for data storage
- [ ] Proper error handling and graceful degradation
- [ ] Performance within Fabric SLA requirements
- [ ] Security review: auth flows, data access patterns, least privilege

### Business
- [ ] Microsoft Partner Network (MPN) enrollment
- [ ] AppSource publisher account
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support contact / ticketing system
- [ ] Pricing plan configured in Partner Center

### Content
- [ ] Workload icon (SVG, multiple sizes)
- [ ] Screenshots (min 3, 1280x720+)
- [ ] Short description (100 chars)
- [ ] Long description (3000 chars, markdown)
- [ ] Getting started documentation
- [ ] Video walkthrough (recommended)

### Compliance
- [ ] GDPR compliance documentation
- [ ] Data residency declaration
- [ ] SOC2 / security attestation (Enterprise tier)

## Milestones

1. **Alpha**: Internal testing on F64 capacity
2. **Private Preview**: 5-10 design partners via direct sharing
3. **Public Preview**: Open listing, free tier only
4. **GA**: Full listing with paid tiers

## Priority: Medium"

echo "Created issue: Publish to Workload Hub"

# Issue 5: Pipeline Activity Runs API
gh issue create --repo "$REPO" \
  --title "Add Pipeline Activity Runs API for richer correlation" \
  --label "enhancement" \
  --body "## Summary

Integrate the Fabric Pipeline Activity Runs API to capture activity-level execution details within pipeline runs, enabling much richer cross-item correlation data.

## Problem

Currently, correlation is based on time-window overlap: if a notebook job starts within a few minutes of a pipeline run, we infer a link. This heuristic works but produces false positives for concurrent pipelines and misses activities that are delayed.

## The API

Fabric provides a dedicated endpoint for querying individual activity runs within a pipeline:

\`\`\`
POST /v1/workspaces/{workspaceId}/datapipelines/pipelineruns/{jobInstanceId}/queryactivityruns
\`\`\`

Response includes:
- \`activityName\`: Name of the activity within the pipeline
- \`activityType\`: e.g., \`NotebookActivity\`, \`DataflowActivity\`, \`CopyActivity\`
- \`status\`: Per-activity success/failure
- \`startTimeUtc\` / \`endTimeUtc\`: Activity-level timing
- \`output\`: Activity output including downstream item references
- \`error\`: Per-activity error details

## Proposed Changes

### 1. fabric-client.ts
Add \`getPipelineActivityRuns(workspaceId, pipelineRunId)\` method.

### 2. collector.ts
After collecting pipeline jobs, fetch activity runs for each. Build correlation links from actual activity references instead of time-window heuristics.

### 3. KQL Schema
Add new table or extend \`EventCorrelations\`:

\`\`\`kql
.create-merge table PipelineActivityRuns (
    WorkspaceId: string,
    PipelineId: string,
    PipelineRunId: string,
    ActivityName: string,
    ActivityType: string,
    ActivityRunId: string,
    Status: string,
    StartTimeUtc: datetime,
    EndTimeUtc: datetime,
    DurationSeconds: real,
    LinkedItemId: string,
    LinkedItemType: string,
    ErrorMessage: string,
    IngestedAt: datetime
)
\`\`\`

### 4. Dashboard
Show activity-level breakdown in incident timeline view.

## Acceptance Criteria

- [ ] \`getPipelineActivityRuns()\` added to fabric-client.ts with pagination support
- [ ] Correlation engine uses activity data when available, falls back to time-window
- [ ] \`PipelineActivityRuns\` KQL table created
- [ ] CLI dashboard shows activity breakdown for pipeline runs
- [ ] Tests for activity run parsing and correlation building
- [ ] Rate limiting: batch requests to avoid 429s on workspaces with many pipelines

## Priority: High

## References
- [Fabric REST API - Query Activity Runs](https://learn.microsoft.com/en-us/rest/api/fabric/datapipeline/items/query-activity-runs)
- See \`docs/fabric-api-reference.md\` for our API research notes"

echo "Created issue: Pipeline Activity Runs API"

echo ""
echo "=== Step 3: Create Roadmap Issue ==="
echo ""

# Check if Discussions are enabled (try, but fall back to issue)
DISCUSSIONS_ENABLED=false
gh api "repos/${REPO}/discussions" --silent 2>/dev/null && DISCUSSIONS_ENABLED=true || true

if [ "$DISCUSSIONS_ENABLED" = true ]; then
  echo "Discussions are enabled. Creating a discussion..."
  gh api "repos/${REPO}/discussions" \
    --method POST \
    -f title="Roadmap & Feature Requests" \
    -f body="$(cat <<'ROADMAP_BODY'
# Observability Workbench -- Roadmap & Feature Requests

Welcome! This thread tracks the product roadmap and is the place to suggest new features.

---

## Current Focus: Observability Workbench v1.0

The Observability Workbench is the first product in our Fabric Operations Suite. It solves the critical observability gaps in Microsoft Fabric.

### Now (In Progress)
- Deduplication materialized view for FabricEvents
- Connect workload dashboard to live Eventhouse data
- Pipeline Activity Runs API integration for richer correlation
- CI/CD pipeline with automated testing

### Next (Planned)
- HTML export for SLO reports
- Slack / Teams webhook alert notifications
- Scanner API integration for lineage-based correlation
- Admin API integration (with tenant admin consent flow)
- Custom KQL query builder in dashboard

### Later (Backlog)
- Anomaly detection for duration regressions (ML-based)
- Capacity unit (CU) cost attribution per pipeline/notebook
- Multi-tenant support (manage multiple Fabric tenants)
- Terraform / Bicep provisioning templates
- Power BI embedded report templates

---

## Future Products

| Product | Target | Status |
|---------|--------|--------|
| **Observability Workbench** | Data engineers, IT admins | Active development |
| **Release Orchestrator** | BI developers, release managers | Design phase |
| **FinOps Guardrails** | IT admins, FinOps teams | Research |
| **Schema Drift Gate** | Data engineers, analytics engineers | Research |

### Release Orchestrator (Next Product)
Dependency-aware, test-gated deployments for Fabric items. Deploy changes safely with automated impact analysis and rollback.

### FinOps Guardrails
Cost transparency, chargeback, and budget controls for Fabric capacities. Know what costs what, who is responsible, and stop surprises.

### Schema Drift Gate
Data contracts, drift detection, and promotion gates. Catch breaking schema changes before they cascade through your data platform.

---

## Request a Feature

Comment below with your feature request. Please include:
1. **What problem** are you trying to solve?
2. **Who** is affected? (role, team size, Fabric SKU)
3. **How** do you work around it today?
4. **How important** is it? (nice-to-have / important / blocking)

We review all requests and prioritize based on community demand and alignment with the roadmap.
ROADMAP_BODY
)" \
    -f category="Ideas" 2>/dev/null || {
    echo "Discussion creation failed (may need specific category). Falling back to issue..."
    DISCUSSIONS_ENABLED=false
  }
fi

if [ "$DISCUSSIONS_ENABLED" = false ]; then
  echo "Creating roadmap as a pinned issue..."
  ROADMAP_URL=$(gh issue create --repo "$REPO" \
    --title "Roadmap & Feature Requests" \
    --label "epic" \
    --body '# Observability Workbench -- Roadmap & Feature Requests

Welcome! This issue tracks the product roadmap and is the place to suggest new features.

---

## Current Focus: Observability Workbench v1.0

The Observability Workbench is the first product in our Fabric Operations Suite. It solves the critical observability gaps in Microsoft Fabric.

### Now (In Progress)
- [ ] Deduplication materialized view for FabricEvents (#1)
- [ ] Connect workload dashboard to live Eventhouse data (#2)
- [ ] Pipeline Activity Runs API integration for richer correlation (#5)
- [ ] CI/CD pipeline with automated testing

### Next (Planned)
- [ ] HTML export for SLO reports (#3)
- [ ] Publish to Fabric Workload Hub (#4)
- [ ] Slack / Teams webhook alert notifications
- [ ] Scanner API integration for lineage-based correlation
- [ ] Admin API integration (with tenant admin consent flow)
- [ ] Custom KQL query builder in dashboard

### Later (Backlog)
- [ ] Anomaly detection for duration regressions (ML-based)
- [ ] Capacity unit (CU) cost attribution per pipeline/notebook
- [ ] Multi-tenant support (manage multiple Fabric tenants)
- [ ] Terraform / Bicep provisioning templates
- [ ] Power BI embedded report templates

---

## Future Products

| Product | Target | Status |
|---------|--------|--------|
| **Observability Workbench** | Data engineers, IT admins | Active development |
| **Release Orchestrator** | BI developers, release managers | Design phase |
| **FinOps Guardrails** | IT admins, FinOps teams | Research |
| **Schema Drift Gate** | Data engineers, analytics engineers | Research |

### Release Orchestrator (Next Product)
Dependency-aware, test-gated deployments for Fabric items. Deploy changes safely with automated impact analysis and rollback.

### FinOps Guardrails
Cost transparency, chargeback, and budget controls for Fabric capacities. Know what costs what, who is responsible, and stop surprises.

### Schema Drift Gate
Data contracts, drift detection, and promotion gates. Catch breaking schema changes before they cascade through your data platform.

---

## Request a Feature

Comment below with your feature request. Please include:
1. **What problem** are you trying to solve?
2. **Who** is affected? (role, team size, Fabric SKU)
3. **How** do you work around it today?
4. **How important** is it? (nice-to-have / important / blocking)

We review all requests and prioritize based on community demand and alignment with the roadmap.')

  echo "Created roadmap issue: $ROADMAP_URL"

  # Pin the issue
  ISSUE_NUM=$(echo "$ROADMAP_URL" | grep -oP '\d+$')
  if [ -n "$ISSUE_NUM" ]; then
    echo "Pinning issue #${ISSUE_NUM}..."
    gh issue pin "$ISSUE_NUM" --repo "$REPO" 2>/dev/null || echo "Note: Pinning may require additional permissions."
  fi
fi

echo ""
echo "=== Step 4: Enable Discussions ==="
echo ""

# Try to enable discussions via API
echo "Attempting to enable Discussions..."
gh api "repos/${REPO}" \
  --method PATCH \
  -f has_discussions=true 2>/dev/null && echo "Discussions enabled!" || echo "Note: Could not enable Discussions via API. Enable manually in repo Settings > General > Features > Discussions."

echo ""
echo "============================================================"
echo "  GitHub presence setup complete!"
echo "============================================================"
echo ""
echo "Summary of changes:"
echo "  - Repo description updated"
echo "  - 8 topics added (microsoft-fabric, observability, data-engineering, slo, finops, fabric-workload, monitoring, kql)"
echo "  - 5 sprint issues created with detailed specs"
echo "  - 1 roadmap issue created and pinned"
echo "  - Discussions enabled (if permissions allow)"
echo ""
echo "Next steps for star growth:"
echo "  1. Share repo link in Reddit r/MicrosoftFabric and r/dataengineering"
echo "  2. Post on LinkedIn with the landing page URL"
echo "  3. Submit to awesome-fabric lists on GitHub"
echo "  4. Cross-reference in blog posts on dev.to"
echo ""
