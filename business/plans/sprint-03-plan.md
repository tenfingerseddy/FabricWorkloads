# Sprint 03 Plan -- Observability Workbench

> **Sprint**: 03
> **Duration**: 2 weeks (2026-03-10 to 2026-03-23)
> **Product**: Observability Workbench v0.2.0
> **Repository**: github.com/tenfingerseddy/FabricWorkloads
> **Status**: Planning

---

## Sprint Goal

**Fix broken data pipelines, connect the workload frontend to live KQL data, and ship a usable web experience for early adopters.**

Sprint 03 bridges the gap between "working CLI tool with backend data" and "something early adopters can actually use in their browser." We fix the two data-quality issues that undermine trust (broken correlations, dirty SloSnapshots), wire the scaffolded workload frontend to live Eventhouse queries, and deliver a functional dashboard that proves value without requiring the CLI.

---

## Sprint 02 Exit State (What We Have)

| Component | State | Notes |
|-----------|-------|-------|
| CLI Tool | Working | Auth, collector, KQL ingestion, dashboard, alerts, scheduler, waste score |
| Tests | 164 passing | Unit tests via Vitest (collector, alerts, fabric-client, waste-score) |
| KQL Tables | 6 tables | FabricEvents, SloDefinitions, AlertRules, EventCorrelations, SloSnapshots, WorkspaceInventory |
| Fabric Notebooks | 3 deployed | NB_ObsIngestion, NB_ObsCorrelation, NB_ObsAlerts |
| Landing Page | Live | Static HTML at landing-page/index.html |
| CI/CD | Working | GitHub Actions: typecheck + test on PR/push to main |
| Workload Frontend | Scaffolded | React/TypeScript shell, WorkbenchDashboard + AlertRule + SLODefinition items defined, sample data only |
| Content | 5 blogs | Published with social posts and content calendar |

## Known Issues Entering Sprint 03

| # | Issue | Impact | Root Cause |
|---|-------|--------|------------|
| 1 | EventCorrelations produces broken data | Correlation chains in Eventhouse are unreliable | NB_ObsCorrelation uses EventId values from FabricEvents (which are job instance GUIDs with dashes), but the EventCorrelations table expects `guid` type columns -- inline ingestion of dash-formatted GUIDs vs. raw format causes parse failures |
| 2 | SloSnapshots may have extra columns | Queries may return unexpected column structure | Old `.create-merge` commands added columns that are not populated; schema drift between notebook assumptions and actual table |
| 3 | Frontend uses sample data | Zero value for end users | Workload frontend scaffolded but never connected to KQL |
| 4 | No Pipeline Activity Runs in NB_ObsCorrelation | Weaker correlation quality in Fabric notebooks | CLI collector already uses Activity Runs API; notebook version still relies only on rootActivityId + time-window strategies |
| 5 | No automated notebook testing | Notebooks could break silently | No validation outside manual Fabric runs |
| 6 | Admin API access blocked | Cannot enumerate tenant-level data | SP needs admin consent; out of scope for Sprint 03 |

---

## Task Breakdown

### Theme A: Data Quality Fixes (P0 -- Must Ship)

These tasks fix the two trust-killing data issues. Without clean data in Eventhouse, the frontend has nothing reliable to display. Both are blockers for every other sprint goal.

---

#### A1: Fix EventCorrelations GUID format and ingestion

**Priority**: P0
**Effort**: 3 hours
**Assignee**: Backend
**Dependencies**: None

**Description**: The NB_ObsCorrelation notebook ingests UpstreamEventId and DownstreamEventId into `guid`-typed columns using pipe-delimited inline ingestion. When the source FabricEvents.EventId values contain dashes (standard GUID format like `a1b2c3d4-e5f6-...`), KQL inline ingestion can reject or silently mangle them depending on delimiter parsing.

Fix the notebook to:
1. Strip or properly format GUIDs before inline ingestion (use raw hex or let KQL auto-parse).
2. Switch the delimiter to pipe (`|`) with `format=psv` hint (consistent with how NB_ObsAlerts already does SloSnapshots).
3. Validate that ingested rows are queryable with a post-ingestion verification query.

**Files to modify**:
- `products/observability-workbench/notebooks/NB_ObsCorrelation.py` -- Cell 5 (ingestion logic)

**Acceptance Criteria**:
- [ ] EventCorrelations rows are ingested without parse errors
- [ ] `EventCorrelations | take 10` returns rows with valid GUID values in UpstreamEventId and DownstreamEventId
- [ ] Post-ingestion verification query runs within the notebook and prints success/failure count
- [ ] Existing broken rows do not interfere (use `.drop extents` or filter by CreatedAt)

---

#### A2: Clean up SloSnapshots table schema

**Priority**: P0
**Effort**: 2 hours
**Assignee**: Backend
**Dependencies**: None

**Description**: The SloSnapshots table may have extra columns from prior `.create-merge` commands that added `ItemName`, `SloType`, or other columns not populated by the current NB_ObsAlerts ingestion logic. This causes column count mismatches and confusing query results.

Fix by:
1. Query the current schema (`.show table SloSnapshots`).
2. Drop and recreate the table with the canonical 9-column schema if extra columns exist: SnapshotId, SloId, ItemId, MetricType, CurrentValue, TargetValue, IsBreaching, ErrorBudgetRemaining, ComputedAt.
3. Update NB_ObsAlerts Cell 4.5 to use column-name mapping in the ingestion hint so it is resilient to future schema changes.
4. Document the canonical schema in a comment block at the top of the ingestion cell.

**Files to modify**:
- `products/observability-workbench/notebooks/NB_ObsAlerts.py` -- Cell 4.5
- KQL management commands (run via notebook or script)

**Acceptance Criteria**:
- [ ] `.show table SloSnapshots` returns exactly 9 columns with correct types
- [ ] NB_ObsAlerts ingests snapshots cleanly after the fix
- [ ] `SloSnapshots | take 10` returns properly populated rows with no NULL columns (except ErrorBudgetRemaining where budget is exhausted)

---

#### A3: Integrate Pipeline Activity Runs API into NB_ObsCorrelation

**Priority**: P1
**Effort**: 5 hours
**Assignee**: Backend
**Dependencies**: A1

**Description**: The CLI collector (`src/collector.ts`, lines 89-117) already calls `POST /v1/workspaces/{id}/datapipelines/pipelineruns/{jobId}/queryactivityruns` and uses activity-to-item name matching as correlation Strategy 1. The NB_ObsCorrelation notebook lacks this, relying only on rootActivityId matching and time-window overlap.

Port the activity runs logic to the notebook:
1. After querying pipeline events from FabricEvents, call the Pipeline Activity Runs API for each pipeline job.
2. Match activity names to child item names (same logic as `buildCorrelationMap` Strategy 1 in collector.ts).
3. Use activity run data as the highest-confidence correlation signal (confidence 0.98), with rootActivityId (0.95) and time-window (0.70) as fallbacks.
4. Record the correlation type in the CorrelationType field.

**Files to modify**:
- `products/observability-workbench/notebooks/NB_ObsCorrelation.py` -- New Cell 3.5 (Activity Runs API call), Cell 4 (updated correlation logic)

**Acceptance Criteria**:
- [ ] Notebook calls Activity Runs API for each pipeline event in the lookback window
- [ ] Activity run results are used as primary correlation signal
- [ ] Correlation output includes `activityRun` as a CorrelationType value
- [ ] Graceful fallback when Activity Runs API returns 403/404 (some pipelines may not support it)
- [ ] Summary cell reports activity-run-based correlations separately from rootActivityId and time-window matches

---

### Theme B: Frontend -- Live KQL Connection (P0 -- Must Ship)

The scaffolded workload frontend currently renders sample/mock data. These tasks connect it to the real Eventhouse so early adopters can see their actual Fabric health status in a browser.

---

#### B1: Create KQL query service for the frontend

**Priority**: P0
**Effort**: 6 hours
**Assignee**: Frontend
**Dependencies**: None

**Description**: Build a TypeScript service module that the React frontend components call to query KQL data from the EH_Observability Eventhouse. This is the data layer for all dashboard views.

The service should:
1. Authenticate using the token provided by the Fabric workload SDK host (via `acquireAccessToken` from the workload client API) or fall back to a configured service principal for standalone dev mode.
2. Execute KQL queries against the Eventhouse REST API (`/v2/rest/query`).
3. Parse the v2 frame response into typed TypeScript objects.
4. Provide query functions for each dashboard view:
   - `getSLODashboardData()` -- current SLO status for all items (from SloSnapshots + FabricEvents)
   - `getAlertHistory(hours: number)` -- recent alerts from AlertLog table
   - `getCorrelationChains(workspaceId?: string)` -- from EventCorrelations + FabricEvents
   - `getWasteMetrics()` -- compute waste from FabricEvents (reuse KQL version of waste score logic)
   - `getEventSearch(filters)` -- full-text search across FabricEvents with time/type/status filters

**Files to create**:
- `products/observability-workbench/src/frontend/services/kql-query-service.ts`
- `products/observability-workbench/src/frontend/services/auth-provider.ts`

**Acceptance Criteria**:
- [ ] Each query function returns typed data matching the React component props
- [ ] Token acquisition works in both Fabric-hosted mode and standalone dev mode
- [ ] KQL queries are parameterized (no string interpolation of user input -- prevent injection)
- [ ] Error handling returns typed errors that the UI can display as user-friendly messages
- [ ] Unit tests mock the HTTP layer and validate response parsing

---

#### B2: Wire WorkbenchDashboard to live SLO data

**Priority**: P0
**Effort**: 5 hours
**Assignee**: Frontend
**Dependencies**: B1

**Description**: Replace the sample data in the WorkbenchDashboard component with live data from the KQL query service. The dashboard should show:

1. **SLO Status Grid**: Each monitored item with current SLO status (healthy/warning/breached), success rate, freshness, and P95 duration -- sourced from the latest SloSnapshots rows and live FabricEvents queries.
2. **Active Alerts Panel**: Current alerts from AlertLog, with severity coloring and sort.
3. **CU Waste Score Summary**: Aggregate waste score computed from FabricEvents job data.
4. **Workspace Selector**: Dropdown to filter by workspace (from WorkspaceInventory).

Use polling (60-second interval) to refresh data, with a manual refresh button.

**Files to modify**:
- WorkbenchDashboard component (create if only scaffolded as a stub)
- Wire up KQL query service calls with React state management

**Acceptance Criteria**:
- [ ] Dashboard displays real SLO data from Eventhouse when KQL is configured
- [ ] Falls back to "No data available" state (not sample data) when Eventhouse is unreachable
- [ ] Workspace selector filters all panels
- [ ] Auto-refresh every 60 seconds with visual indicator
- [ ] Loading states shown during data fetches
- [ ] Error states displayed for failed KQL queries

---

#### B3: Wire AlertRule editor to live KQL data

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Frontend
**Dependencies**: B1

**Description**: Connect the AlertRule item type to the AlertRules KQL table for CRUD operations. Users should be able to:
1. View existing alert rules (from AlertRules table).
2. Create new alert rules (insert into AlertRules table via management command).
3. Edit thresholds on existing rules.
4. Enable/disable rules.

The UI should present a form with fields for: item selector (from WorkspaceInventory), metric type (success_rate, freshness, duration_p95, consecutive_failures), target value, warning threshold, and enabled toggle.

**Files to modify**:
- AlertRule editor component
- KQL query service (add CRUD functions for AlertRules table)

**Acceptance Criteria**:
- [ ] Alert rules list loads from AlertRules KQL table
- [ ] Create form validates input (target between 0-1 for rates, positive for durations)
- [ ] Saved rules appear in the list immediately after creation
- [ ] Disable/enable toggle updates the IsActive field in KQL
- [ ] NB_ObsAlerts respects rules written through this UI (they query the same AlertRules table)

---

#### B4: Wire SLODefinition editor to live KQL data

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Frontend
**Dependencies**: B1

**Description**: Connect the SLODefinition item type to the SloDefinitions KQL table. Users should be able to:
1. View existing SLO definitions.
2. Create new SLOs (item selector, metric type, target value, evaluation window).
3. Edit SLO targets.
4. View current status inline (pull latest SloSnapshots for each SLO).

**Files to modify**:
- SLODefinition editor component
- KQL query service (add CRUD functions for SloDefinitions table)

**Acceptance Criteria**:
- [ ] SLO list loads from SloDefinitions KQL table
- [ ] Each SLO shows current status (from latest SloSnapshot for that SloId)
- [ ] Create form includes item picker populated from WorkspaceInventory
- [ ] Error budget bar visualization for each SLO
- [ ] Changes made here are reflected in NB_ObsAlerts evaluations (shared data store)

---

### Theme C: Developer Experience and Testing (P1)

---

#### C1: Add integration test harness for KQL queries

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Backend
**Dependencies**: None

**Description**: Create an integration test suite that validates KQL query correctness against a live Eventhouse. These tests run outside CI (they require Fabric credentials) but provide a safety net for query changes.

Tests should cover:
1. FabricEvents query returns expected columns and types.
2. SloSnapshots query correctly joins with SloDefinitions.
3. EventCorrelations query returns valid GUIDs (validates A1 fix).
4. AlertLog query returns alerts within a time window.
5. WorkspaceInventory dedup query works correctly.

Use a test runner flag (`npm run test:integration`) to isolate from unit tests.

**Files to create**:
- `products/observability-workbench/src/__tests__/kql-integration.test.ts`
- Update `package.json` with `test:integration` script

**Acceptance Criteria**:
- [ ] `npm run test:integration` runs all KQL tests when credentials are available
- [ ] Tests skip gracefully (not fail) when credentials are missing
- [ ] Each test validates response schema (column names and types), not just HTTP 200
- [ ] At least 5 integration tests covering the 5 scenarios above
- [ ] README documents how to run integration tests

---

#### C2: Add notebook validation script

**Priority**: P1
**Effort**: 3 hours
**Assignee**: DevOps
**Dependencies**: None

**Description**: Create a validation script that performs static analysis on the three Fabric notebooks to catch common errors before deploying to Fabric. This is not full execution testing (which requires Spark), but catches structural issues.

Validate:
1. Python syntax is valid (AST parse).
2. All KQL table names referenced in queries match the known schema.
3. Column names in `.ingest inline` commands match table schema definitions.
4. No hardcoded secrets (scan for patterns like client_secret, password, token).
5. Delimiter consistency (pipe vs. comma vs. semicolon in inline ingestion).

**Files to create**:
- `products/observability-workbench/scripts/validate-notebooks.py`

**Acceptance Criteria**:
- [ ] Script runs against all 3 notebooks and reports pass/fail per check
- [ ] Catches the GUID format issue from A1 if it were reintroduced
- [ ] Catches delimiter mismatches between table schema and ingestion commands
- [ ] Exit code 0 on success, 1 on any validation failure
- [ ] Can be added to CI pipeline as a pre-deploy check

---

#### C3: Expand unit test coverage for collector correlation logic

**Priority**: P1
**Effort**: 3 hours
**Assignee**: Backend
**Dependencies**: None

**Description**: The `buildCorrelationMap` method in `collector.ts` has three correlation strategies (activity runs, rootActivityId, time-window) but the existing test suite may not cover edge cases for all three strategies.

Add tests for:
1. Activity run name matching: exact match, partial match (activity name contains item name), and no match.
2. rootActivityId matching: same workspace only, cross-workspace exclusion.
3. Time-window fallback: overlap detection, tolerance boundary (exactly 30s), non-overlapping exclusion.
4. Mixed strategy: when activity runs claim some children and rootActivityId claims others.
5. Empty inputs: no pipeline jobs, no non-pipeline jobs, no jobs at all.

**Files to modify**:
- `products/observability-workbench/src/__tests__/collector.test.ts`

**Acceptance Criteria**:
- [ ] At least 10 new test cases covering the scenarios above
- [ ] All existing 164 tests still pass
- [ ] `npm test` runs in under 10 seconds
- [ ] Coverage of `buildCorrelationMap` method is above 90% (line coverage)

---

### Theme D: Extensibility Toolkit Migration Prep (P2)

---

#### D1: Analyze Extensibility Toolkit patterns and document migration path

**Priority**: P2
**Effort**: 4 hours
**Assignee**: Backend
**Dependencies**: None

**Description**: The Microsoft Fabric Extensibility Toolkit (cloned to `fabric-extensibility-toolkit/`) is the target workload framework. It is TypeScript-first and does not require a .NET backend, which aligns with our existing TypeScript codebase.

Produce a migration analysis document that covers:
1. **Toolkit structure**: Map the `fabric-extensibility-toolkit/Workload/` directory structure against our current code.
2. **Item type registration**: How to register WorkbenchDashboard, AlertRule, and SLODefinition as workload items using the toolkit's Manifest system.
3. **Authentication**: How the toolkit handles token acquisition vs. our current `auth.ts`.
4. **Frontend hosting**: How the toolkit's micro-frontend iframe model works (webpack config, index.html, App.tsx entry point).
5. **Data plane**: How our KQL query service maps to the toolkit's controller/client patterns.
6. **Migration steps**: Ordered list of changes needed to convert our current code to run inside the toolkit, with effort estimates per step.
7. **Risks**: What breaks during migration, what the toolkit does not support that we need.

**Files to create**:
- `products/observability-workbench/docs/extensibility-toolkit-migration.md`

**Acceptance Criteria**:
- [ ] Document covers all 7 sections above
- [ ] Each migration step has an effort estimate (hours)
- [ ] Total estimated migration effort is summed
- [ ] Risks section identifies at least 3 concrete risks with mitigations
- [ ] Document references specific files in both our codebase and the toolkit

---

#### D2: Scaffold workload Manifest for Extensibility Toolkit

**Priority**: P2
**Effort**: 3 hours
**Assignee**: Frontend
**Dependencies**: D1

**Description**: Create the initial workload Manifest files that register our three item types with the Extensibility Toolkit. This does not require the full migration, but establishes the registration structure.

Using the toolkit's `fabric-extensibility-toolkit/Workload/Manifest/` directory as reference, create:
1. Workload manifest JSON declaring `ObservabilityWorkbench` as a workload.
2. Item type definitions for WorkbenchDashboard, AlertRule, and SLODefinition.
3. Editor registration pointing to the component entry points.
4. Icon assets (placeholder SVGs acceptable for now).

**Files to create**:
- `products/observability-workbench/workload/Manifest/` directory with manifest files
- Placeholder icon SVGs

**Acceptance Criteria**:
- [ ] Manifest JSON validates against the Extensibility Toolkit schema
- [ ] Three item types are declared with display names, descriptions, and icon references
- [ ] Editor entry points reference component paths that exist (or will exist after B2-B4)
- [ ] Document notes in the manifest about what is placeholder vs. final

---

### Theme E: Content and GTM (P2)

---

#### E1: Write blog post: "Building a CU Waste Score for Microsoft Fabric"

**Priority**: P2
**Effort**: 3 hours
**Assignee**: Content
**Dependencies**: None

**Description**: The CU Waste Score is a differentiated feature (no competitor does this). Write a technical blog post that:
1. Explains the three waste dimensions (retry, duration regression, duplicate runs).
2. Shows the cost model (F64 SKU at $11.52/hour).
3. Walks through a real example with numbers from our Fabric environment.
4. Positions Observability Workbench as the solution.
5. Includes code snippets from `waste-score.ts` (open source, MIT licensed).

Target: 1,500-2,000 words. Publish to dev.to and GitHub repo blog directory.

**Files to create**:
- `business/market-research/blog-06-cu-waste-score.md`
- `business/market-research/blog-06-cu-waste-score-devto.md`

**Acceptance Criteria**:
- [ ] Technical accuracy: waste score formula matches `waste-score.ts` implementation
- [ ] Includes at least one worked example with real-looking numbers
- [ ] CTA links to GitHub repo and landing page
- [ ] dev.to version has proper frontmatter (title, tags, canonical_url)

---

#### E2: Update landing page with live demo section

**Priority**: P2
**Effort**: 3 hours
**Assignee**: Frontend
**Dependencies**: None

**Description**: Update the static landing page (`landing-page/index.html`) to include:
1. A "See It In Action" section with screenshots or animated GIFs of the CLI dashboard and the new web dashboard (after B2 is done, take screenshots).
2. Updated feature list that includes CU Waste Score.
3. "Early Access" signup form (can be a Tally.so or Google Forms embed).
4. Updated testimonials/social proof section (link to blog posts, GitHub stars).

**Files to modify**:
- `products/observability-workbench/landing-page/index.html`

**Acceptance Criteria**:
- [ ] Landing page loads without errors
- [ ] "See It In Action" section has at least 2 visual assets
- [ ] Early access form is functional and collects email + company name
- [ ] Feature list includes CU Waste Score with brief description
- [ ] Page is mobile-responsive

---

## Sprint Capacity and Schedule

### Effort Summary by Theme

| Theme | Tasks | Total Hours | Priority |
|-------|-------|-------------|----------|
| A: Data Quality Fixes | A1, A2, A3 | 10h | P0 + P1 |
| B: Frontend Live KQL | B1, B2, B3, B4 | 19h | P0 + P1 |
| C: Testing & DX | C1, C2, C3 | 10h | P1 |
| D: Extensibility Toolkit | D1, D2 | 7h | P2 |
| E: Content & GTM | E1, E2 | 6h | P2 |
| **Total** | **13 tasks** | **52h** | |

### Effort Summary by Priority

| Priority | Tasks | Hours | Mandate |
|----------|-------|-------|---------|
| P0 (must ship) | A1, A2, B1, B2 | 16h | Sprint fails without these |
| P1 (should ship) | A3, B3, B4, C1, C2, C3 | 23h | High value, drop if blocked |
| P2 (stretch) | D1, D2, E1, E2 | 13h | Nice to have, carry to Sprint 04 if needed |

### Effort Summary by Assignee Category

| Category | Tasks | Hours |
|----------|-------|-------|
| Backend | A1, A2, A3, C1, C3, D1 | 21h |
| Frontend | B1, B2, B3, B4, D2, E2 | 25h |
| DevOps | C2 | 3h |
| Content | E1 | 3h |

---

## Dependency Graph

```
A1 (Fix EventCorrelations GUID)
  |
  v
A3 (Activity Runs in notebook) -----> [depends on clean correlation ingestion]

A2 (Clean SloSnapshots) -----------> [independent, can run in parallel with A1]

B1 (KQL query service)
  |
  +---> B2 (Dashboard live data)     [P0 critical path]
  +---> B3 (AlertRule editor)
  +---> B4 (SLO editor)

C1 (Integration tests) ------------> [independent]
C2 (Notebook validation) ----------> [independent]
C3 (Collector test coverage) -------> [independent]

D1 (Migration analysis)
  |
  v
D2 (Scaffold Manifest)

E1 (Blog post) --------------------> [independent]
E2 (Landing page update) ----------> [independent, screenshots after B2]
```

### Recommended Execution Order (Week 1)

| Day | Backend | Frontend | DevOps/Content |
|-----|---------|----------|----------------|
| Mon | A1 (GUID fix), A2 (SloSnapshots) | B1 (KQL query service) | C2 (notebook validation) |
| Tue | A1/A2 completion, C3 (collector tests) | B1 continued | E1 (blog post) |
| Wed | A3 (Activity Runs in notebook) | B2 (Dashboard live data) | C2 completion |
| Thu | A3 completion, C1 (integration tests) | B2 continued | E2 (landing page) |
| Fri | C1 completion | B2 completion, review | Buffer / review |

### Recommended Execution Order (Week 2)

| Day | Backend | Frontend | DevOps/Content |
|-----|---------|----------|----------------|
| Mon | D1 (migration analysis) | B3 (AlertRule editor) | E2 completion |
| Tue | D1 completion | B3 completion | Buffer |
| Wed | Bug fixes from testing | B4 (SLO editor) | D2 (scaffold Manifest) |
| Thu | Bug fixes, review | B4 completion | D2 completion |
| Fri | Sprint review, retro | Sprint review, retro | Sprint review, retro |

---

## Definition of Done (Sprint Level)

The sprint is **done** when:

1. **P0 tasks A1, A2, B1, B2 are merged to main and passing CI.**
2. EventCorrelations table contains valid, queryable correlation rows with correct GUIDs.
3. SloSnapshots table has a clean 9-column schema with no orphan columns.
4. The web dashboard displays live SLO data from the Eventhouse (not sample data).
5. All existing 164+ tests pass, plus new tests from C3.
6. No regressions in CLI tool functionality (`npm start` still works end-to-end).

### Per-Task Definition of Done

Every task is done when:
- [ ] Code is committed to a feature branch and PR is opened
- [ ] CI pipeline passes (typecheck + tests)
- [ ] PR is reviewed (self-review acceptable for solo sprint)
- [ ] Merged to main
- [ ] Verified working against live Fabric environment (for KQL-dependent tasks)

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| KQL inline ingestion continues to fail on GUIDs even after fix | Medium | High | Test with `guid()` KQL function wrapping; if inline ingestion is fundamentally unreliable for GUIDs, switch to streaming ingestion API |
| Fabric workload SDK token acquisition differs from standalone auth | Medium | Medium | B1 designs auth-provider with interface abstraction; standalone dev mode uses service principal, Fabric-hosted mode uses SDK callback |
| Extensibility Toolkit has breaking changes or incomplete docs | Low | Low | D1/D2 are P2 analysis tasks only, not production code; migration is Sprint 04+ |
| Early adopter feedback requires UI changes mid-sprint | Medium | Low | B2 dashboard uses component architecture; individual panels can be swapped without rewriting the data layer |
| Pipeline Activity Runs API returns 403 for service principal | Medium | Medium | A3 already handles 403 gracefully; correlation falls back to rootActivityId + time-window strategies |

---

## Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| EventCorrelations valid rows | > 90% of correlations are queryable | KQL: `EventCorrelations \| where isnotempty(UpstreamEventId) \| count` vs total |
| Dashboard load time | < 3 seconds | Browser devtools network tab |
| Test count | > 175 (up from 164) | `npm test` output |
| CI pass rate | 100% on main | GitHub Actions history |
| Blog post published | 1 new post | dev.to publication |

---

## Carry-Forward to Sprint 04

Items explicitly deferred from Sprint 03:

1. **Admin API access** (issue #6) -- Requires tenant admin to grant consent to the service principal. Out of our control. Track as a dependency for multi-tenant features.
2. **Lakehouse cold archive** -- Product spec lists this for v0.2+. Not needed for early adopter value.
3. **Teams webhook notifications** -- NB_ObsAlerts has the code scaffolded but needs a configured webhook. Deferred until we have early adopter tenants to test against.
4. **Full Extensibility Toolkit migration** -- D1/D2 produce the analysis; actual migration is Sprint 04-05.
5. **Event search UI** -- B1 includes `getEventSearch()` in the query service, but the search UI component is Sprint 04.
6. **Incident timeline view** -- Product spec feature F5. Requires solid correlation data (fixed in A1/A3) to be useful. Build the UI in Sprint 04.
