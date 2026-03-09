# Observability Workbench -- Implementation Plan

> **Product**: Observability Workbench (Fabric Custom Workload)
> **Owner**: AI Agency
> **Created**: 2026-03-09
> **Timeline**: 26 weeks (Sprint 0 through Phase 5)
> **Status**: Pre-Sprint 0

---

## Table of Contents

1. [Sprint 0 -- Immediate Actions](#sprint-0--immediate-actions-today--this-week)
2. [Phase 0 -- Foundation (Week 1-2)](#phase-0--foundation-week-1-2)
3. [Phase 1 -- Core Product (Week 3-6)](#phase-1--core-product-week-3-6)
4. [Phase 2 -- Web Dashboard (Week 7-10)](#phase-2--web-dashboard-week-7-10)
5. [Phase 3 -- Fabric Workload Integration (Week 11-16)](#phase-3--fabric-workload-integration-week-11-16)
6. [Phase 4 -- Beta & GTM (Week 17-22)](#phase-4--beta--gtm-week-17-22)
7. [Phase 5 -- Launch (Week 23-26)](#phase-5--launch-week-23-26)
8. [Agent Activation Matrix](#agent-activation-matrix)
9. [Risk Register](#risk-register)
10. [Dependency Graph](#dependency-graph)

---

## Environment Inventory (Known State)

Before diving into tasks, here is the confirmed state of the development environment:

| Asset | Status | Notes |
|-------|--------|-------|
| Fabric capacity | Active | F-SKU available |
| Workspaces | 3 confirmed | Testing, Production, Personal |
| Items present | Confirmed | Pipelines, notebooks, lakehouses, eventhouses (KQL), semantic models, reports, copy jobs |
| Jobs API | Validated | Returns execution history for job instances |
| Eventhouse / KQL | Available | Query endpoints confirmed; will serve as telemetry store |
| Node.js runtime | Available | Primary runtime for Phase 0-2 |
| .NET SDK | NOT available | Must install for Phase 3 (Fabric workload requirement) |
| Azure CLI | NOT available | Must install for Phase 3+ |
| Agency-agents framework | Installed | 61 agents across 9 divisions, NEXUS strategy operational |
| GitHub | Available | CI/CD target |
| Entra ID (Azure AD) | To be configured | Required for app registration and auth |

---

## Sprint 0 -- Immediate Actions (Today / This Week)

Sprint 0 is a pre-phase burst to unblock everything else. Every task here must be complete before Phase 0 formally begins.

### S0-1: Create GitHub Repository

- **Deliverable**: Private GitHub repo `observability-workbench` with branch protection on `main`, issue templates, and project board (Kanban).
- **Agent(s)**: DevOps Automator
- **Dependencies**: None
- **Effort**: 2 hours
- **Success criteria**: Repo exists. `main` branch is protected (require PR review). Project board has columns: Backlog, Sprint, In Progress, Review, Done. README has project description, architecture placeholder, and license (proprietary for now).

### S0-2: Enumerate All Fabric REST API Endpoints Needed

- **Deliverable**: Markdown file `docs/fabric-api-inventory.md` listing every REST API endpoint the product will call, grouped by function (jobs, items, workspaces, admin, eventhouse), with confirmed HTTP method, required scopes, pagination behavior, rate limits, and sample response shapes.
- **Agent(s)**: Backend Architect, API Tester
- **Dependencies**: None (uses existing confirmed API access)
- **Effort**: 4 hours
- **Success criteria**: File covers at minimum these endpoint families:
  - `GET /v1/workspaces` -- list workspaces
  - `GET /v1/workspaces/{id}/items` -- list items per workspace
  - `GET /v1/workspaces/{id}/items/{itemId}/jobs/instances` -- job execution history
  - `GET /v1/workspaces/{id}/items/{itemId}/jobs/instances/{instanceId}` -- single job detail
  - `POST /v1/workspaces/{id}/items/{itemId}/jobs/instances/{instanceId}/cancel` -- cancel job
  - `GET /v1/workspaces/{id}/eventhouses` -- eventhouse listing
  - `POST /v1/workspaces/{id}/items/{itemId}/executeQueries` -- KQL query execution
  - Admin APIs for capacity and tenant-level monitoring
  - Each endpoint has a tested curl/fetch example with real response.

### S0-3: Scaffold Node.js Project

- **Deliverable**: Initialized Node.js project in `src/` with TypeScript, ESLint, Prettier, Jest, and a `src/lib/fabric-client.ts` stub that authenticates and calls one endpoint.
- **Agent(s)**: Rapid Prototyper, Backend Architect
- **Dependencies**: S0-1 (repo must exist)
- **Effort**: 3 hours
- **Success criteria**: `npm test` passes. `npm run lint` passes. `ts-node src/lib/fabric-client.ts` authenticates to Fabric using a service principal or delegated token and prints the list of workspaces to stdout.

### S0-4: Validate KQL Ingestion Path

- **Deliverable**: Working script `scripts/test-kql-ingest.ts` that writes 100 sample event rows to an Eventhouse table and reads them back with a KQL query.
- **Agent(s)**: Backend Architect, API Tester
- **Dependencies**: S0-3 (needs fabric-client)
- **Effort**: 3 hours
- **Success criteria**: Script runs end-to-end. Table `ObservabilityEvents_Test` exists in Eventhouse in the Testing workspace. 100 rows ingested and queryable within 30 seconds of ingestion.

### S0-5: Register Entra ID Application

- **Deliverable**: Entra ID app registration (`ObservabilityWorkbench-Dev`) with:
  - Client ID and secret stored in `.env` (gitignored)
  - API permissions: `Fabric.Read.All`, `Fabric.ReadWrite.All` (or scoped equivalents)
  - Redirect URIs for localhost development
  - Service principal consent granted in the Fabric tenant
- **Agent(s)**: Security Engineer
- **Dependencies**: None (manual portal step, but agent documents the process)
- **Effort**: 2 hours
- **Success criteria**: `fabric-client.ts` authenticates using client credentials flow. Token has correct audience (`https://api.fabric.microsoft.com`).

### S0-6: Write the "State of Fabric Observability" Blog Outline

- **Deliverable**: Blog series outline (5 posts) in `content/blog/observability-series-outline.md`. Each post has a title, 3-5 section headings, target keyword, and estimated word count.
- **Agent(s)**: Content Creator, Growth Hacker
- **Dependencies**: None
- **Effort**: 2 hours
- **Success criteria**: Outline covers: (1) why Fabric monitoring hub falls short, (2) cross-item correlation gap, (3) SLO-driven operations for data platforms, (4) building long-retention event stores with Eventhouse, (5) introducing Observability Workbench. Each post targets a specific long-tail keyword with estimated monthly search volume > 100.

**Sprint 0 total effort: ~16 hours**

---

## Phase 0 -- Foundation (Week 1-2)

**Goal**: A working data collection MVP that polls Fabric APIs, writes events to Eventhouse, and proves the entire ingestion pipeline.

### P0-1: Build Fabric API Client Library

- **Deliverable**: `src/lib/fabric-client.ts` -- typed client wrapping all Fabric REST endpoints from S0-2. Handles token refresh, pagination, throttling (429 retry with exponential backoff), and error classification.
- **Agent(s)**: Backend Architect
- **Dependencies**: S0-2, S0-3, S0-5
- **Effort**: 12 hours
- **Success criteria**:
  - All endpoint families from S0-2 have typed methods.
  - Pagination: automatically follows `continuationToken` to retrieve all pages.
  - Rate limiting: respects `Retry-After` header, exponential backoff up to 5 retries.
  - Unit tests mock HTTP responses; integration test hits live Fabric API.
  - Code coverage > 80% for this module.

### P0-2: Build Event Poller Service

- **Deliverable**: `src/services/event-poller.ts` -- a scheduled service that:
  1. Lists all workspaces the service principal can access.
  2. For each workspace, lists all items.
  3. For each item, fetches recent job instances (since last poll).
  4. Normalizes events into a canonical `ObservabilityEvent` schema.
  5. Batches and writes events to Eventhouse via KQL ingestion.
- **Agent(s)**: Backend Architect, Rapid Prototyper
- **Dependencies**: P0-1, S0-4
- **Effort**: 16 hours
- **Success criteria**:
  - Polls every 60 seconds (configurable).
  - Deduplicates events by `(workspaceId, itemId, jobInstanceId)`.
  - Handles API errors gracefully -- logs and continues to next item.
  - Writes batches of up to 1000 events per ingestion call.
  - After 10 minutes of running, Eventhouse contains accurate event data matching Fabric monitoring hub.

### P0-3: Define Canonical Event Schema

- **Deliverable**: `src/schemas/observability-event.ts` (TypeScript interface) and `docs/event-schema.md` (documentation). Also a KQL `.create table` command in `scripts/setup-eventhouse.kql`.
- **Agent(s)**: Backend Architect
- **Dependencies**: S0-2 (need to know API response shapes)
- **Effort**: 6 hours
- **Success criteria**: Schema includes at minimum:
  - `eventId` (string, GUID)
  - `workspaceId`, `workspaceName` (string)
  - `itemId`, `itemName`, `itemType` (string -- pipeline, notebook, dataflow, lakehouse, semanticmodel, report, copyjob)
  - `jobInstanceId` (string)
  - `jobType` (string -- e.g., Pipeline, RunNotebook, ScheduledRefresh)
  - `status` (string -- InProgress, Completed, Failed, Cancelled, Dequeued)
  - `startTimeUtc`, `endTimeUtc` (datetime)
  - `durationMs` (long)
  - `invokeType` (string -- Manual, Scheduled, API)
  - `failureReason` (string, nullable)
  - `rootActivityId` (string -- for correlation)
  - `parentJobInstanceId` (string, nullable -- for parent-child linking)
  - `ingestedAtUtc` (datetime)
  - Schema is versioned (v1) with migration notes.

### P0-4: Set Up Eventhouse Tables and Retention Policies

- **Deliverable**: KQL script `scripts/setup-eventhouse.kql` that creates:
  - `ObservabilityEvents` table with the canonical schema
  - `ObservabilityEvents_Staging` for ingestion buffering
  - Retention policy: 365 days
  - Ingestion batching policy: 10 seconds / 1000 records / 10 MB (whichever first)
  - Materialized views for common queries (events per workspace per hour, failure rates)
- **Agent(s)**: Backend Architect
- **Dependencies**: P0-3, S0-4
- **Effort**: 6 hours
- **Success criteria**: Script executes without errors against Testing workspace Eventhouse. Tables are queryable. Retention policy confirmed via `.show table ObservabilityEvents policy retention`.

### P0-5: CI/CD Pipeline (GitHub Actions)

- **Deliverable**: `.github/workflows/ci.yml` with:
  - Trigger: push to `main` and PRs
  - Steps: install deps, lint, type-check, unit tests, build
  - Secrets: `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`, `FABRIC_TENANT_ID` stored in GitHub repo secrets
  - Separate workflow `deploy.yml` for deploying the poller to a long-running process (initially a simple PM2/systemd on a dev VM, or Azure Container App)
- **Agent(s)**: DevOps Automator
- **Dependencies**: S0-1, S0-3
- **Effort**: 6 hours
- **Success criteria**: PR checks pass/fail correctly. Push to `main` triggers deploy. Linting failure blocks merge.

### P0-6: Validate All Remaining API Endpoints

- **Deliverable**: Updated `docs/fabric-api-inventory.md` with test results for every endpoint. Any endpoints that return errors or unexpected shapes are flagged with workarounds.
- **Agent(s)**: API Tester
- **Dependencies**: P0-1
- **Effort**: 6 hours
- **Success criteria**: Every endpoint in the inventory has a "Tested" status. Endpoints with issues have documented workarounds or are flagged as "blocked" with Microsoft support ticket reference.

### P0-7: Publish Blog Post #1 -- "State of Fabric Observability"

- **Deliverable**: Published blog post (2000-2500 words) covering Fabric monitoring limitations with data from our own testing.
- **Agent(s)**: Content Creator, Growth Hacker
- **Dependencies**: S0-6
- **Effort**: 8 hours
- **Success criteria**: Post published on company blog/Medium. Shared to LinkedIn, r/PowerBI, Fabric Community forum. Includes at least 3 screenshots from Fabric monitoring hub showing limitations. Ends with CTA to join waitlist.

**Phase 0 total effort: ~60 hours**

---

## Phase 1 -- Core Product (Week 3-6)

**Goal**: A working observability engine with event ingestion, correlation, SLOs, alerting, and a CLI dashboard for internal validation.

### P1-1: Event Ingestion Engine (Production-Grade)

- **Deliverable**: Hardened `src/services/event-poller.ts` upgraded to production quality:
  - Polls across all 3 workspaces in parallel (configurable concurrency).
  - Incremental polling: tracks high-watermark per (workspace, item) in Eventhouse.
  - Dead letter handling: failed ingestion batches are written to a `_DeadLetter` table with error details.
  - Health endpoint: `GET /health` returns poller status, last poll time, event counts.
  - Metrics: tracks events_ingested, poll_duration_ms, errors_total as counters.
- **Agent(s)**: Backend Architect, Rapid Prototyper
- **Dependencies**: P0-2, P0-4
- **Effort**: 20 hours
- **Success criteria**:
  - Runs continuously for 24 hours without crash or memory leak.
  - Processes 10,000+ events/hour across 3 workspaces.
  - Zero duplicate events in Eventhouse (validated by KQL `summarize count() by eventId | where count_ > 1`).
  - Health endpoint returns 200 with accurate state.

### P1-2: Correlation Engine

- **Deliverable**: `src/services/correlation-engine.ts` -- service that links related job executions into execution trees:
  - Pipeline run triggers notebook run --> linked as parent-child.
  - Pipeline run triggers dataflow refresh --> linked.
  - Scheduled refresh of semantic model --> linked to upstream data source refresh.
  - Correlation uses `rootActivityId` where available, falls back to temporal proximity + workspace co-location heuristic (within 60 seconds of parent completion).
  - Stores correlation edges in `CorrelationEdges` Eventhouse table.
- **Agent(s)**: Backend Architect, AI Engineer
- **Dependencies**: P0-3, P1-1
- **Effort**: 24 hours
- **Success criteria**:
  - For a test pipeline that triggers 2 notebooks and 1 dataflow: all 4 executions are correctly linked in a tree with the pipeline as root.
  - Correlation accuracy > 95% on known test scenarios (measured by running 20 known pipeline chains and verifying all links).
  - KQL query `CorrelationEdges | where rootJobInstanceId == "<id>" | project childItemName, childStatus` returns correct tree.

### P1-3: KQL Materialized Views for Operational Queries

- **Deliverable**: KQL script `scripts/materialized-views.kql` creating:
  - `mv_EventsByWorkspaceHour`: events aggregated by workspace, hour, status.
  - `mv_FailuresByItemDay`: failure count and rate per item per day.
  - `mv_DurationPercentiles`: P50, P90, P95, P99 duration per item per day.
  - `mv_CorrelationTrees`: flattened tree view of correlated executions.
  - `fn_GetExecutionTree(rootId)`: KQL function returning full tree for a given root.
- **Agent(s)**: Backend Architect
- **Dependencies**: P0-4, P1-2
- **Effort**: 10 hours
- **Success criteria**: All materialized views create successfully. Queries against views return results in < 2 seconds for 30 days of data. Function `fn_GetExecutionTree` returns correct tree for test pipeline.

### P1-4: SLO Engine

- **Deliverable**: `src/services/slo-engine.ts` -- service that:
  - Reads SLO definitions from a config file (`config/slos.yaml`).
  - Evaluates SLOs against Eventhouse data on a configurable schedule (default: every 5 minutes).
  - SLO types supported:
    - **Freshness**: "Item X must complete successfully within the last N hours" (e.g., lakehouse refresh < 2 hours stale).
    - **Success Rate**: "Item X must have success rate >= N% over trailing window" (e.g., pipeline success rate >= 99% over 7 days).
    - **Duration P95**: "Item X P95 duration must be < N minutes over trailing window" (e.g., notebook P95 < 30 min over 7 days).
  - Computes error budget: (budget_total - budget_consumed) / budget_total as percentage.
  - Writes SLO evaluation results to `SLOEvaluations` Eventhouse table.
- **Agent(s)**: Backend Architect, AI Engineer
- **Dependencies**: P1-1, P1-3
- **Effort**: 24 hours
- **Success criteria**:
  - Define 5 test SLOs in YAML. All evaluate correctly against test data.
  - Error budget calculation is accurate to 2 decimal places.
  - SLO breach triggers an event written to `SLOBreaches` table.
  - Evaluation completes in < 10 seconds for 30-day window across 50 items.

### P1-5: SLO Configuration Schema

- **Deliverable**: `config/slos.yaml` schema definition and documentation in `docs/slo-configuration.md`.
- **Agent(s)**: Backend Architect
- **Dependencies**: P1-4
- **Effort**: 4 hours
- **Success criteria**: Schema supports:
  ```yaml
  slos:
    - name: "Sales Pipeline Freshness"
      type: freshness
      target:
        workspaceId: "<id>"
        itemId: "<id>"
        itemType: pipeline
      threshold: 2  # hours
      window: rolling_24h
      errorBudget: 0.1  # 10% allowed breach time
      severity: critical
      notifyChannels: [email, webhook]
  ```
  Validation rejects malformed SLO definitions with clear error messages.

### P1-6: Alerting Engine

- **Deliverable**: `src/services/alerting-engine.ts` with:
  - Alert rules: SLO breach, job failure (immediate), job duration anomaly (> 2x historical P95), consecutive failures (N in a row).
  - Notification channels:
    - Email (via Microsoft Graph API or SendGrid).
    - Webhook (generic HTTP POST with JSON payload).
    - Teams channel (via incoming webhook connector).
  - Alert deduplication: same alert not sent more than once per cooldown period (default 1 hour).
  - Alert state tracking in `Alerts` Eventhouse table (firing, acknowledged, resolved).
- **Agent(s)**: Backend Architect, Rapid Prototyper
- **Dependencies**: P1-4
- **Effort**: 16 hours
- **Success criteria**:
  - Trigger a test SLO breach --> email and webhook notification sent within 60 seconds.
  - Second breach within cooldown period --> no duplicate notification.
  - Alert resolved when SLO returns to healthy --> resolution notification sent.
  - Webhook payload includes: alertId, sloName, currentValue, threshold, breachTimeUtc, affectedItems[].

### P1-7: CLI Dashboard

- **Deliverable**: `src/cli/dashboard.ts` -- terminal UI (using `blessed` or `ink` library) showing:
  - Real-time event feed (last 20 events with status coloring).
  - SLO summary table (name, status, error budget remaining, last evaluation).
  - Active alerts list.
  - Workspace summary (event counts per workspace, failure rates).
  - Refreshes every 10 seconds.
- **Agent(s)**: Rapid Prototyper
- **Dependencies**: P1-1, P1-4, P1-6
- **Effort**: 10 hours
- **Success criteria**:
  - `npx ts-node src/cli/dashboard.ts` renders a usable terminal dashboard.
  - All 4 panels display live data from Eventhouse.
  - Colors: green = healthy/success, yellow = warning, red = critical/failure.
  - Exits cleanly on Ctrl+C.

### P1-8: Integration Test Suite

- **Deliverable**: `tests/integration/` directory with end-to-end tests that:
  - Start the poller, let it ingest events for 5 minutes.
  - Verify events appear in Eventhouse.
  - Trigger a known pipeline in Testing workspace.
  - Verify correlation engine links the pipeline to its child jobs.
  - Verify SLO engine evaluates correctly.
  - Verify alerting fires for a breached SLO.
- **Agent(s)**: API Tester, Reality Checker
- **Dependencies**: P1-1 through P1-6
- **Effort**: 12 hours
- **Success criteria**: `npm run test:integration` passes. All 6 test scenarios green. Tests can run in CI (with Fabric API credentials from secrets).

### P1-9: Blog Posts #2 and #3

- **Deliverable**: Published blog posts:
  - #2: "Cross-Item Correlation in Fabric -- What the Monitoring Hub Can't Show You" (2000 words)
  - #3: "SLO-Driven Operations for Data Platforms" (2000 words)
- **Agent(s)**: Content Creator, Growth Hacker
- **Dependencies**: P1-2, P1-4 (need working features to screenshot)
- **Effort**: 12 hours
- **Success criteria**: Posts published, shared across channels. Each includes original screenshots/diagrams from the working product. #2 includes a correlation tree visualization. #3 includes an error budget burn-down chart example.

**Phase 1 total effort: ~132 hours**

---

## Phase 2 -- Web Dashboard (Week 7-10)

**Goal**: A polished web UI that replaces the CLI dashboard and serves as the product's primary interface for beta users.

### P2-1: Next.js Project Scaffolding

- **Deliverable**: `dashboard/` directory with:
  - Next.js 14+ with App Router, TypeScript, Tailwind CSS.
  - Shadcn/ui component library installed and configured.
  - ESLint, Prettier, Jest + React Testing Library.
  - Docker build for containerized deployment.
  - API routes that proxy to the backend services.
  - Environment configuration for connecting to Eventhouse.
- **Agent(s)**: Frontend Developer, Rapid Prototyper
- **Dependencies**: P0-5 (CI/CD), P1-1 (backend running)
- **Effort**: 8 hours
- **Success criteria**: `npm run dev` starts the dashboard on `localhost:3000`. Home page renders with navigation shell. `npm run build` succeeds. Docker image builds and runs.

### P2-2: Authentication (Entra ID / MSAL)

- **Deliverable**: MSAL.js integration in the Next.js app:
  - Login with Microsoft (Entra ID) via `@azure/msal-browser` and `@azure/msal-react`.
  - Protected routes: unauthenticated users redirect to login.
  - Token acquisition for Fabric API calls (delegated permissions).
  - User profile display in header (name, avatar, tenant).
  - Logout flow.
  - Role-based access: workspace-level permissions inherited from Fabric.
- **Agent(s)**: Frontend Developer, Security Engineer
- **Dependencies**: S0-5 (Entra app registration), P2-1
- **Effort**: 12 hours
- **Success criteria**: User can sign in with a Microsoft work account. After login, user sees only workspaces they have access to in Fabric. Token refresh works silently. Logout clears session completely.

### P2-3: Event Timeline Page

- **Deliverable**: `/events` page showing:
  - Chronological event feed with infinite scroll.
  - Each event shows: item name, item type icon, workspace, status badge, duration, start time.
  - Filter bar: workspace, item type, status, date range.
  - Full-text search across event properties.
  - Click event to expand inline detail panel showing all properties plus correlation tree.
  - Auto-refresh toggle (every 30 seconds).
- **Agent(s)**: Frontend Developer, UX Architect
- **Dependencies**: P2-1, P1-1
- **Effort**: 20 hours
- **Success criteria**:
  - Page loads in < 2 seconds showing last 50 events.
  - Filtering narrows results in < 500ms.
  - Search returns results matching any event field.
  - Expanded detail panel shows complete event data.
  - Tested with 10,000+ events -- no performance degradation.

### P2-4: Incident Timeline Visualization

- **Deliverable**: `/incidents/{id}` page showing:
  - Horizontal timeline of a correlated execution tree.
  - Each node shows item name, type, duration bar, and status color.
  - Parallel branches rendered as parallel tracks.
  - Failed nodes highlighted with failure reason tooltip.
  - Click node to navigate to detailed event view.
  - Timeline zoom/pan controls.
- **Agent(s)**: Frontend Developer, UI Designer
- **Dependencies**: P2-3, P1-2
- **Effort**: 24 hours
- **Success criteria**:
  - A 4-node execution tree (pipeline -> 2 notebooks + 1 dataflow) renders correctly.
  - Duration bars are proportional to actual execution time.
  - Failed nodes show red with failure reason visible on hover.
  - Works on screen widths >= 1024px.

### P2-5: SLO Dashboard

- **Deliverable**: `/slos` page showing:
  - SLO summary cards: name, current status (met/breaching/at-risk), error budget gauge.
  - Error budget burn-down chart (line chart over trailing window).
  - SLO history table: evaluation timestamps, values, pass/fail.
  - Click SLO to drill into affected items and recent breaches.
  - Create/edit SLO form (maps to `config/slos.yaml` via API).
- **Agent(s)**: Frontend Developer, UI Designer
- **Dependencies**: P2-1, P1-4
- **Effort**: 20 hours
- **Success criteria**:
  - 5 test SLOs render with correct status and error budget.
  - Error budget gauge shows green (> 50%), yellow (20-50%), red (< 20%).
  - Burn-down chart renders 7-day history with data points.
  - SLO creation form validates inputs and writes to config.

### P2-6: Dependency Graph Visualization

- **Deliverable**: `/graph` page showing:
  - Interactive DAG (directed acyclic graph) of all monitored items and their dependencies.
  - Nodes: items (pipeline, notebook, dataflow, etc.) sized by execution frequency.
  - Edges: correlation relationships (pipeline triggers notebook, etc.).
  - Color coding: green = healthy (last run succeeded), red = failing, gray = stale.
  - Click node to see item detail sidebar with recent executions.
  - Layout algorithm: Dagre or ELK for hierarchical DAG layout.
  - Library: React Flow or D3.js.
- **Agent(s)**: Frontend Developer, UI Designer, UX Architect
- **Dependencies**: P2-1, P1-2
- **Effort**: 24 hours
- **Success criteria**:
  - Graph renders all items from Testing workspace with correct edges.
  - Nodes are draggable. Graph is zoomable and pannable.
  - Clicking a node shows last 10 executions in sidebar.
  - Graph handles 100+ nodes without performance issues (< 1 second render).

### P2-7: Search and Filtering Infrastructure

- **Deliverable**: Global search component and API endpoint:
  - Search bar in top navigation, always accessible.
  - Searches across: event properties, item names, SLO names, alert messages.
  - Results grouped by type (events, items, SLOs, alerts) with count badges.
  - Keyboard shortcut: Cmd/Ctrl+K to focus search.
  - Backend: KQL full-text search against Eventhouse tables.
  - Debounced input (300ms) with loading indicator.
- **Agent(s)**: Frontend Developer, Backend Architect
- **Dependencies**: P2-1, P0-4
- **Effort**: 12 hours
- **Success criteria**:
  - Searching "fail" returns all failed events, failed SLO evaluations, and alerts containing "fail".
  - Results appear in < 1 second.
  - Clicking a result navigates to the correct detail page.
  - Empty state shows search suggestions.

### P2-8: Alerting UI

- **Deliverable**: `/alerts` page showing:
  - Active alerts list with severity badges (critical, warning, info).
  - Alert detail: triggering SLO, current value vs threshold, affected items, timeline of state changes.
  - Acknowledge button (sets state to acknowledged, stops repeat notifications).
  - Resolve button (manually resolves alert).
  - Alert history with filters by severity, status, date range.
  - Notification preferences page: configure email, webhook, Teams per alert rule.
- **Agent(s)**: Frontend Developer
- **Dependencies**: P2-1, P1-6
- **Effort**: 14 hours
- **Success criteria**:
  - Active alerts show within 30 seconds of being fired.
  - Acknowledge stops re-notification.
  - Alert history shows full lifecycle (firing -> acknowledged -> resolved).
  - Notification preferences save correctly and apply to next alert.

### P2-9: Dashboard CI/CD

- **Deliverable**: Updated `.github/workflows/ci.yml` to include dashboard build and test. New `deploy-dashboard.yml` workflow to deploy to Azure Static Web App or Vercel.
- **Agent(s)**: DevOps Automator
- **Dependencies**: P0-5, P2-1
- **Effort**: 6 hours
- **Success criteria**: PR to `main` runs dashboard lint + type-check + unit tests. Merge to `main` deploys dashboard to staging URL. Staging URL is accessible and functional.

### P2-10: Blog Posts #4 and #5 + Waitlist Landing Page

- **Deliverable**:
  - Blog post #4: "Building a Long-Retention Event Store with Fabric Eventhouse" (2000 words)
  - Blog post #5: "Introducing Observability Workbench for Microsoft Fabric" (product announcement, 1500 words)
  - Landing page at `observabilityworkbench.com` (or subdomain) with:
    - Hero section with product screenshot
    - 4 feature sections with icons
    - Pricing table (Free / Pro / Enterprise)
    - Waitlist signup form (email capture to a database or Mailchimp)
    - Social proof section (placeholder for testimonials)
- **Agent(s)**: Content Creator, Growth Hacker, Frontend Developer, UI Designer
- **Dependencies**: P2-3 through P2-6 (need screenshots)
- **Effort**: 20 hours
- **Success criteria**: Blog posts published. Landing page live with SSL. Waitlist form captures emails. Page scores > 90 on Lighthouse performance audit.

**Phase 2 total effort: ~160 hours**

---

## Phase 3 -- Fabric Workload Integration (Week 11-16)

**Goal**: Transform the standalone product into a native Fabric custom workload that installs directly in the Fabric portal.

### P3-1: Install .NET SDK and Azure CLI

- **Deliverable**: Development environment updated with:
  - .NET 8 SDK installed and verified (`dotnet --version`).
  - Azure CLI installed and authenticated (`az login`).
  - Fabric Workload Development Kit (DevKit) cloned and sample workload compiling.
  - NuGet packages for `Microsoft.Fabric.Workload.SDK` added to a new solution.
- **Agent(s)**: DevOps Automator
- **Dependencies**: None (environmental setup)
- **Effort**: 4 hours
- **Success criteria**: `dotnet build` succeeds on the DevKit sample. `az account show` returns correct tenant. `dotnet new webapi -n ObservabilityWorkbench.Backend` creates and builds successfully.

### P3-2: Workload Manifest and Item Type Definitions

- **Deliverable**: `workload-manifest.json` defining:
  - Workload identity: name, publisher, version, description, icon.
  - Item types:
    - `ObservabilityWorkbench.Monitor` -- the main monitoring configuration item (one per workspace).
    - `ObservabilityWorkbench.SLODefinition` -- individual SLO definitions stored as Fabric items.
    - `ObservabilityWorkbench.AlertRule` -- alert rule definitions.
  - Each item type has: display name, icon, editor URL, create experience.
  - Frontend endpoint URLs pointing to the micro-frontend.
  - Backend endpoint URLs for the .NET backend.
- **Agent(s)**: Backend Architect
- **Dependencies**: P3-1
- **Effort**: 10 hours
- **Success criteria**: Manifest validates against the Fabric Workload schema. Each item type has correct CRUD endpoint mappings. Manifest can be loaded into the Fabric DevKit test harness.

### P3-3: .NET Backend -- Core Services Port

- **Deliverable**: `backend/` .NET 8 Web API project reimplementing:
  - `FabricClientService` -- equivalent of `fabric-client.ts`, using Microsoft Identity Client for auth.
  - `EventPollerService` -- background hosted service that polls Fabric APIs and ingests to Eventhouse.
  - `CorrelationService` -- correlation engine logic.
  - `SLOService` -- SLO evaluation engine.
  - `AlertService` -- alerting engine.
  - All services use the Fabric Workload SDK patterns (IWorkloadClientFactory, etc.).
  - Dependency injection setup following .NET best practices.
- **Agent(s)**: Backend Architect, Senior Developer
- **Dependencies**: P3-1, P3-2, P1-1 through P1-6 (Node.js implementations as reference)
- **Effort**: 48 hours
- **Success criteria**:
  - `dotnet test` passes with > 80% code coverage.
  - Backend starts and polls events successfully from Fabric API.
  - Events appear in Eventhouse with same schema as Node.js version.
  - SLO evaluations produce identical results to Node.js engine for same data.
  - All services register correctly in DI container.

### P3-4: .NET Backend -- Workload SDK Integration

- **Deliverable**: Backend implements Fabric Workload SDK interfaces:
  - `IWorkloadOperations` -- CRUD for Monitor, SLODefinition, AlertRule items.
  - `IJobOperations` -- so Fabric scheduler can trigger SLO evaluations and alert checks.
  - Lakehouse storage adapter for persisting item metadata in OneLake.
  - Authentication middleware that validates Fabric-issued tokens.
  - Health check endpoints required by Fabric hosting.
- **Agent(s)**: Backend Architect, Security Engineer
- **Dependencies**: P3-3
- **Effort**: 32 hours
- **Success criteria**:
  - Creating a "Monitor" item via Fabric portal triggers backend `CreateItem` handler.
  - Item metadata is stored in OneLake under the workspace's lakehouse.
  - Fabric scheduler can trigger `RunJob` for SLO evaluation.
  - Token validation correctly extracts workspace context and user identity.
  - All Workload SDK interfaces are implemented (no `NotImplementedException`).

### P3-5: Fabric Micro-Frontend

- **Deliverable**: `frontend/` React micro-frontend (using Fabric Workload Frontend SDK):
  - Port of the Next.js dashboard into Fabric's micro-frontend hosting model.
  - Item editor views: Monitor editor, SLO editor, Alert Rule editor.
  - Integration with Fabric chrome: navigation pane, breadcrumbs, workspace context.
  - Uses Fabric Fluent UI components for consistent look and feel.
  - Authentication via Fabric's built-in token provider (no separate MSAL needed).
- **Agent(s)**: Frontend Developer, UX Architect
- **Dependencies**: P3-2, P2-3 through P2-8 (UI components to port)
- **Effort**: 40 hours
- **Success criteria**:
  - Micro-frontend loads in the Fabric DevKit test harness.
  - All pages from Phase 2 dashboard render within Fabric chrome.
  - Navigation between Observability Workbench items and native Fabric items works.
  - Fluent UI components replace Shadcn components where Fabric guidelines require it.
  - No console errors. Lighthouse accessibility score > 90.

### P3-6: Register Job Types in Fabric Scheduler

- **Deliverable**: Job type registrations so that:
  - `SLOEvaluation` job runs every 5 minutes (configurable).
  - `AlertCheck` job runs every 1 minute.
  - `EventIngestion` job runs every 60 seconds.
  - Jobs appear in the Fabric Monitoring Hub alongside native jobs.
  - Job history is visible in the Fabric portal.
- **Agent(s)**: Backend Architect
- **Dependencies**: P3-4
- **Effort**: 12 hours
- **Success criteria**:
  - All 3 job types appear in Fabric Monitoring Hub.
  - Jobs execute on schedule and log success/failure.
  - Failed jobs show error details in Monitoring Hub.
  - Job execution consumes reasonable CU (< 1 CU-second per evaluation cycle).

### P3-7: Monitoring Hub Integration

- **Deliverable**: Observability Workbench events appear in Fabric's native Monitoring Hub:
  - Custom workload activities are listed alongside pipeline/notebook activities.
  - Users can click an activity to open the Observability Workbench detail view.
  - Deep links from Monitoring Hub to Observability Workbench pages.
- **Agent(s)**: Backend Architect, Frontend Developer
- **Dependencies**: P3-4, P3-5, P3-6
- **Effort**: 10 hours
- **Success criteria**: In the Fabric Monitoring Hub, filtering by "Observability Workbench" shows SLO evaluations and alert checks. Clicking an activity navigates to the micro-frontend detail page.

### P3-8: Dev Capacity Deployment

- **Deliverable**: Complete deployment to a Fabric dev capacity:
  - Workload package built and uploaded.
  - Manifest registered with the dev capacity.
  - Backend deployed to Azure (App Service or Container App).
  - Frontend served from workload hosting.
  - End-to-end smoke test passes.
- **Agent(s)**: DevOps Automator, Backend Architect
- **Dependencies**: P3-3 through P3-7
- **Effort**: 16 hours
- **Success criteria**:
  - Open Fabric portal --> navigate to workspace --> "New" menu shows "Observability Workbench: Monitor".
  - Create a Monitor item --> opens editor --> starts ingesting events.
  - SLO and Alert Rule items can be created and configured.
  - All dashboard pages functional within Fabric portal.
  - No crashes or errors in Azure Application Insights for 24 hours.

### P3-9: .NET CI/CD Pipeline

- **Deliverable**: GitHub Actions workflows for the .NET backend:
  - `ci-backend.yml`: build, test, code coverage.
  - `deploy-backend.yml`: build Docker image, push to ACR, deploy to Azure Container App.
  - `deploy-workload.yml`: build workload package, upload to Fabric.
- **Agent(s)**: DevOps Automator
- **Dependencies**: P3-1, P0-5
- **Effort**: 10 hours
- **Success criteria**: PR checks run backend tests. Merge to `main` deploys backend and workload to dev capacity automatically. Deployment takes < 10 minutes.

### P3-10: Security Audit

- **Deliverable**: Security review document `docs/security-audit-phase3.md` covering:
  - Token handling and validation.
  - Data encryption at rest (OneLake) and in transit (HTTPS).
  - RBAC: workspace permissions correctly enforced.
  - Secrets management (no secrets in code, all in Key Vault or GitHub Secrets).
  - Vulnerability scan results (dependency check, container scan).
  - Threat model for the workload (STRIDE analysis).
- **Agent(s)**: Security Engineer
- **Dependencies**: P3-3 through P3-8
- **Effort**: 10 hours
- **Success criteria**: Zero critical vulnerabilities. Zero high vulnerabilities. All medium vulnerabilities have remediation plan. Threat model covers all data flows.

**Phase 3 total effort: ~192 hours**

---

## Phase 4 -- Beta & GTM (Week 17-22)

**Goal**: Private beta with real users, marketplace preparation, content marketing, and pricing implementation.

### P4-1: Private Beta Program Setup

- **Deliverable**: Beta program infrastructure:
  - Beta signup form on landing page (with company name, Fabric SKU, workspace count).
  - Onboarding documentation: `docs/beta-onboarding.md` with step-by-step setup guide.
  - Beta-specific Fabric capacity or tenant configuration for isolating beta workloads.
  - Feedback collection: embedded feedback widget in the dashboard (e.g., Canny, or custom form).
  - Beta Slack/Teams channel for direct communication.
  - Telemetry: anonymous usage analytics (page views, feature usage, error rates).
- **Agent(s)**: Growth Hacker, Project Shepherd, Support Responder
- **Dependencies**: P3-8 (workload deployed)
- **Effort**: 16 hours
- **Success criteria**: 20 beta applications received within first week of outreach. Onboarding doc enables self-serve setup in < 30 minutes. Feedback widget captures structured feedback (feature request, bug, general).

### P4-2: Beta User Recruitment

- **Deliverable**: 10-20 active beta users from:
  - Waitlist signups from blog posts and landing page.
  - Direct outreach to Fabric Community forum power users.
  - LinkedIn outreach to "Data Engineer" and "Fabric Admin" titles.
  - Reddit r/PowerBI and r/MicrosoftFabric posts offering free beta access.
  - Microsoft MVP network contacts.
- **Agent(s)**: Growth Hacker, Reddit Community Builder, Twitter Engager, Content Creator
- **Dependencies**: P4-1
- **Effort**: 20 hours
- **Success criteria**: 15+ beta users actively using the product (defined as: logged in at least 3 times in first 2 weeks). At least 5 different companies represented. NPS survey sent at week 2.

### P4-3: Beta Monitoring and Support

- **Deliverable**: Operational support for beta period:
  - Daily monitoring of Application Insights for errors and performance.
  - Triage and fix critical bugs within 24 hours.
  - Weekly beta check-in email with product updates and feature requests status.
  - Bug tracker (GitHub Issues) with beta-specific labels.
  - SLA for beta: critical bugs fixed in 24h, high in 72h, medium in sprint.
- **Agent(s)**: Support Responder, Infrastructure Maintainer, Project Shepherd
- **Dependencies**: P4-1, P4-2
- **Effort**: 40 hours (ongoing, ~7 hrs/week for 6 weeks)
- **Success criteria**: Zero unresolved critical bugs at any time. Response time for beta user questions < 4 hours during business hours. Weekly email sent every week. At least 80% of critical+high bugs resolved within SLA.

### P4-4: Azure Marketplace Listing Preparation

- **Deliverable**: Complete Azure Marketplace submission package:
  - Offer creation in Partner Center.
  - Listing content: description (short + long), screenshots (5+), video demo (2-3 min).
  - Technical configuration: SaaS offer or Fabric workload offer type.
  - Plans: Free, Professional ($499/mo), Enterprise ($1,499/mo).
  - Lead management: configure lead destination (CRM or email).
  - Legal: EULA, privacy policy, support policy documents.
  - Certification requirements checklist completed.
- **Agent(s)**: Growth Hacker, Content Creator, Legal Compliance Checker, UI Designer
- **Dependencies**: P3-8, P4-1
- **Effort**: 24 hours
- **Success criteria**: Offer submitted to Partner Center for review. All required fields populated. Screenshots show real product UI. Video demo recorded and uploaded. Legal documents reviewed and approved.

### P4-5: AppSource Listing Preparation

- **Deliverable**: AppSource-specific listing (separate from Azure Marketplace):
  - AppSource offer in Partner Center linked to the Fabric workload.
  - Category: "Analytics" > "Data Governance & Quality" or "Operations Management".
  - Industry tags: applicable verticals.
  - AppSource-specific screenshots and descriptions.
  - Validation against AppSource certification requirements for Fabric workloads.
- **Agent(s)**: Growth Hacker, App Store Optimizer, Legal Compliance Checker
- **Dependencies**: P4-4
- **Effort**: 12 hours
- **Success criteria**: AppSource offer submitted alongside Marketplace offer. All AppSource-specific requirements met. Listing optimized for discoverability (keywords, categories).

### P4-6: Pricing Implementation

- **Deliverable**: Licensing and metering system:
  - License tier check on login: Free (1 workspace, 7-day retention, 5 SLOs), Pro (5 workspaces, 90-day, unlimited SLOs), Enterprise (unlimited).
  - Feature gates in the UI: locked features show upgrade prompt.
  - Usage metering: track workspace count, retention days used, SLO count per tenant.
  - Billing integration: Azure Marketplace SaaS fulfillment API or Fabric commerce APIs.
  - Trial: 14-day free trial of Professional tier.
- **Agent(s)**: Backend Architect, Frontend Developer, Finance Tracker
- **Dependencies**: P4-4 (pricing plans defined)
- **Effort**: 24 hours
- **Success criteria**:
  - Free user creating 6th SLO sees "Upgrade to Professional" prompt.
  - Professional user accessing 6th workspace sees "Upgrade to Enterprise" prompt.
  - Metering data matches actual usage (verified for 5 test accounts).
  - Trial expires correctly after 14 days and reverts to Free tier.

### P4-7: Content Marketing Execution

- **Deliverable**: Content produced and published:
  - 4 additional blog posts (deep-dive technical content + use cases).
  - 2 YouTube/Loom video tutorials (setup guide + feature walkthrough).
  - 1 "Fabric Observability Toolkit" GitHub repo (free KQL queries, monitoring templates -- lead magnet).
  - 10 LinkedIn posts over 6 weeks (2/week cadence).
  - 5 Fabric Community forum answers (genuinely helpful, with subtle product mentions).
  - 1 guest post on a data engineering blog (e.g., Medium publication, Towards Data Science).
- **Agent(s)**: Content Creator, Growth Hacker, Twitter Engager, Reddit Community Builder, Social Media Strategist
- **Dependencies**: P3-8 (need working product for content)
- **Effort**: 40 hours
- **Success criteria**:
  - Blog posts average > 500 views each within first month.
  - GitHub toolkit repo gets > 50 stars.
  - LinkedIn posts average > 100 impressions each.
  - Waitlist grows by 200+ emails during Phase 4.
  - At least 3 inbound inquiries from content.

### P4-8: Beta Feedback Analysis and Iteration

- **Deliverable**: Structured feedback analysis:
  - Categorized feedback report (feature requests, bugs, UX issues, performance issues).
  - Prioritized backlog of improvements based on frequency and impact.
  - Top 5 feature requests with implementation estimates.
  - Top 5 UX issues with proposed fixes.
  - Implemented: at least 10 improvements based on beta feedback.
  - Updated product roadmap based on learnings.
- **Agent(s)**: Feedback Synthesizer, Sprint Prioritizer, UX Researcher
- **Dependencies**: P4-2, P4-3
- **Effort**: 20 hours
- **Success criteria**: All beta feedback categorized and responded to. Top 10 improvements implemented. Beta user satisfaction survey shows > 7/10 average score. At least 3 beta users provide written testimonials.

### P4-9: Performance Optimization

- **Deliverable**: Performance tuning based on real usage:
  - Dashboard page load times < 2 seconds (P95).
  - KQL query optimization: all dashboard queries < 3 seconds.
  - Event ingestion latency: events appear in dashboard < 2 minutes after Fabric completion.
  - CU consumption audit: document CU usage per feature, optimize hotspots.
  - Load test: simulate 50 concurrent users with realistic browsing patterns.
- **Agent(s)**: Performance Benchmarker, Backend Architect
- **Dependencies**: P4-2 (need real usage patterns)
- **Effort**: 16 hours
- **Success criteria**: All performance targets met. Load test passes for 50 concurrent users without errors. CU consumption documented per operation with optimization recommendations.

### P4-10: Microsoft Partner Application

- **Deliverable**: Application to Microsoft Fabric ISV Partner Program:
  - Partner Center registration completed.
  - ISV Connect program application submitted.
  - Co-sell ready status requirements documented.
  - Initial contact with Fabric partner team established.
- **Agent(s)**: Growth Hacker, Legal Compliance Checker
- **Dependencies**: P4-4
- **Effort**: 8 hours
- **Success criteria**: Application submitted. Confirmation email received. Requirements for co-sell ready status documented with timeline.

**Phase 4 total effort: ~220 hours**

---

## Phase 5 -- Launch (Week 23-26)

**Goal**: Public launch on Azure Marketplace and AppSource, enterprise sales pipeline, and growth engine running.

### P5-1: Marketplace Certification and Go-Live

- **Deliverable**: Azure Marketplace and AppSource listings live and purchasable.
- **Agent(s)**: DevOps Automator, Legal Compliance Checker
- **Dependencies**: P4-4, P4-5 (submissions approved)
- **Effort**: 12 hours
- **Success criteria**:
  - Marketplace offer status: "Live".
  - AppSource listing status: "Live".
  - Free tier downloadable by anyone.
  - Professional and Enterprise tiers purchasable with correct billing.
  - Test purchase flow end-to-end: buy -> provision -> access product.

### P5-2: Public Launch Campaign

- **Deliverable**: Coordinated launch across all channels:
  - Launch blog post: "Observability Workbench is Now Available for Microsoft Fabric" (announcement + call to action).
  - Product Hunt launch (if applicable to B2B SaaS audience).
  - LinkedIn launch post (from founder and company accounts).
  - Twitter/X launch thread (5-tweet thread with screenshots).
  - Reddit posts: r/PowerBI, r/MicrosoftFabric, r/dataengineering.
  - Email blast to entire waitlist with launch offer (30% off first 3 months for early signups).
  - Fabric Community forum announcement.
- **Agent(s)**: Content Creator, Growth Hacker, Twitter Engager, Reddit Community Builder, Social Media Strategist
- **Dependencies**: P5-1 (marketplace live)
- **Effort**: 16 hours
- **Success criteria**: Launch day metrics:
  - 500+ landing page visits.
  - 50+ free tier signups.
  - 5+ Professional tier trials started.
  - Waitlist conversion rate > 20%.

### P5-3: Documentation Site

- **Deliverable**: Public documentation at `docs.observabilityworkbench.com`:
  - Getting started guide (< 10 minutes to first value).
  - Installation/setup for each tier.
  - Feature guides: events, correlation, SLOs, alerts, dashboard.
  - API reference (if we expose a public API).
  - KQL query cookbook: 20 useful queries for common scenarios.
  - Troubleshooting guide.
  - FAQ.
  - Built with Docusaurus, Nextra, or similar static site generator.
- **Agent(s)**: Content Creator, Frontend Developer
- **Dependencies**: P3-5 (features finalized)
- **Effort**: 24 hours
- **Success criteria**: Docs site live with SSL. All sections populated. Getting started guide tested by someone unfamiliar with the product (completes in < 15 minutes). Search works across all docs.

### P5-4: Enterprise Sales Pipeline Setup

- **Deliverable**: Sales infrastructure:
  - CRM setup (HubSpot free tier or similar): pipeline stages defined.
  - Lead qualification criteria: company size, Fabric SKU, workspace count, pain points.
  - Sales collateral: 1-page product overview PDF, ROI calculator spreadsheet, comparison vs. manual monitoring.
  - Demo environment: dedicated Fabric workspace with realistic data for live demos.
  - Outbound sequence: 3-email cadence template for enterprise data engineering leads.
  - Discovery call script: questions to qualify Fabric operational maturity.
- **Agent(s)**: Growth Hacker, Content Creator, Executive Summary Generator
- **Dependencies**: P5-1 (product live)
- **Effort**: 20 hours
- **Success criteria**: CRM has 50+ leads imported from waitlist and beta. 5 discovery calls scheduled in first 2 weeks post-launch. Sales collateral reviewed and polished. Demo environment runs reliably for live presentations.

### P5-5: Customer Onboarding Automation

- **Deliverable**: Automated onboarding flow for new customers:
  - Welcome email sequence (3 emails over first week): setup guide, feature highlights, "need help?" touchpoint.
  - In-app onboarding checklist: "Set up your first Monitor", "Create your first SLO", "Configure alerting".
  - Automated health check: detect if customer hasn't completed onboarding after 48 hours, trigger support outreach.
  - Usage analytics dashboard: track activation metrics (time to first event ingested, time to first SLO created).
- **Agent(s)**: Growth Hacker, Frontend Developer, Support Responder
- **Dependencies**: P5-1
- **Effort**: 16 hours
- **Success criteria**: New signups receive welcome email within 5 minutes. In-app checklist appears on first login. 70% of new users complete at least 2 of 3 checklist items within first week. Health check correctly identifies stuck users.

### P5-6: Monitoring and Operations for Production

- **Deliverable**: Production-grade operational setup:
  - Azure Application Insights for backend APM.
  - Uptime monitoring (Azure Monitor or external service) with 1-minute checks.
  - Alerting for: backend errors > 1%, latency P95 > 5s, ingestion failures, certificate expiry.
  - Incident response runbook: `docs/runbooks/incident-response.md`.
  - Daily automated backup of Eventhouse configuration data.
  - Cost monitoring: Azure Cost Management alerts at 80% and 100% of monthly budget.
  - Status page (e.g., Statuspage.io or Instatus) for public uptime reporting.
- **Agent(s)**: Infrastructure Maintainer, DevOps Automator
- **Dependencies**: P3-8
- **Effort**: 14 hours
- **Success criteria**: All monitoring active. Status page live. Incident runbook covers: detection, triage, communication, resolution, post-mortem template. Backup verified by restore test. Cost alerts configured.

### P5-7: Post-Launch Iteration Sprint

- **Deliverable**: Reserve capacity for rapid iteration based on launch feedback:
  - Bug fix SLA: critical in 4 hours, high in 24 hours.
  - 2 feature improvements based on most-requested items from first 2 weeks.
  - Performance hotfix buffer.
  - Weekly release cadence established.
- **Agent(s)**: Sprint Prioritizer, Backend Architect, Frontend Developer
- **Dependencies**: P5-2 (launch generates feedback)
- **Effort**: 32 hours (buffer)
- **Success criteria**: Zero critical bugs unresolved for > 4 hours. At least 2 improvements shipped within first 2 weeks post-launch. Weekly release cadence achieved (at least 2 releases in Phase 5).

### P5-8: Revenue and Metrics Tracking

- **Deliverable**: Business metrics dashboard:
  - MRR tracking: total, by tier, growth rate.
  - User metrics: signups, activations, DAU, WAU, retention (week 1, week 4).
  - Funnel: visit -> signup -> activated -> paid conversion rates.
  - Churn tracking: cancellations with reason codes.
  - Unit economics: CAC, LTV, LTV/CAC ratio (will have limited data initially, but structure in place).
- **Agent(s)**: Analytics Reporter, Finance Tracker
- **Dependencies**: P5-1, P4-6
- **Effort**: 10 hours
- **Success criteria**: Dashboard auto-updates daily. All metrics defined and populating (even if values are small in early days). Week 4 targets: 200 free users, 10 paid users, $5K MRR.

**Phase 5 total effort: ~144 hours**

---

## Agent Activation Matrix

This matrix maps every phase to the specific agents that should be activated, with their role in that phase.

### Phase 0 -- Foundation

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Backend Architect | Fabric API client, event schema, Eventhouse setup | Sprint start |
| Rapid Prototyper | Quick scaffolding, validate ingestion path | Sprint start |
| DevOps Automator | CI/CD pipeline, repo setup | Sprint start |
| API Tester | Validate all Fabric API endpoints | After P0-1 complete |
| Security Engineer | Entra ID app registration, auth config | Sprint start |
| Content Creator | Blog post #1 | Mid-sprint |
| Growth Hacker | Blog distribution, waitlist setup | After blog published |

### Phase 1 -- Core Product

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Backend Architect | Correlation engine, SLO engine, alerting engine | Sprint start |
| AI Engineer | Correlation heuristics, anomaly detection logic | When P1-2 begins |
| Rapid Prototyper | CLI dashboard | After P1-4 complete |
| API Tester | Integration test suite | After P1-6 complete |
| Reality Checker | End-to-end validation of all features | End of phase |
| Content Creator | Blog posts #2 and #3 | When features demo-ready |
| Growth Hacker | Content distribution | After blog posts |

### Phase 2 -- Web Dashboard

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Frontend Developer | All dashboard pages, components, auth | Sprint start |
| UX Architect | Page layouts, navigation, information architecture | Sprint start |
| UI Designer | Visual design, component styling, visualization design | Sprint start |
| Backend Architect | Search API, KQL query endpoints | When P2-7 begins |
| DevOps Automator | Dashboard CI/CD | After P2-1 complete |
| Content Creator | Blog posts #4, #5, landing page copy | Mid-phase |
| Growth Hacker | Landing page, waitlist optimization | After landing page |

### Phase 3 -- Fabric Workload

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Backend Architect | .NET port, Workload SDK integration | Sprint start |
| Senior Developer | Complex .NET patterns, DI, middleware | Sprint start |
| Frontend Developer | Micro-frontend port, Fabric chrome integration | After P3-2 |
| Security Engineer | Security audit, token validation, RBAC | After P3-4 |
| DevOps Automator | .NET CI/CD, workload deployment | After P3-3 |
| UX Architect | Fabric UX compliance, micro-frontend layout | After P3-5 |

### Phase 4 -- Beta & GTM

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Growth Hacker | Beta recruitment, marketplace listings, partner app | Sprint start |
| Content Creator | 4 blog posts, 2 videos, community posts | Sprint start |
| Support Responder | Beta user support | When beta users onboard |
| Feedback Synthesizer | Analyze beta feedback | After 2 weeks of beta |
| Sprint Prioritizer | Prioritize improvements | After feedback analysis |
| UX Researcher | Beta user interviews, usability findings | After 2 weeks |
| Performance Benchmarker | Load testing, optimization | Mid-phase |
| Finance Tracker | Pricing validation, billing testing | When P4-6 begins |
| Legal Compliance Checker | Marketplace legal requirements | When P4-4 begins |
| App Store Optimizer | AppSource listing optimization | When P4-5 begins |
| Twitter Engager | Social media presence | Ongoing |
| Reddit Community Builder | Community engagement | Ongoing |
| Social Media Strategist | Cross-channel strategy | Sprint start |
| Infrastructure Maintainer | Beta operational support | Ongoing |
| Project Shepherd | Beta program coordination | Sprint start |

### Phase 5 -- Launch

| Agent | Role | Activation Trigger |
|-------|------|-------------------|
| Growth Hacker | Launch campaign, sales pipeline | Launch day |
| Content Creator | Launch blog, docs site, sales collateral | Pre-launch |
| Twitter Engager | Launch thread, ongoing engagement | Launch day |
| Reddit Community Builder | Launch posts, community answers | Launch day |
| Social Media Strategist | Cross-channel launch coordination | Launch day |
| Frontend Developer | Onboarding flow, docs site | Pre-launch |
| DevOps Automator | Production monitoring, status page | Pre-launch |
| Infrastructure Maintainer | Production operations | Launch day |
| Support Responder | Customer support | Launch day |
| Analytics Reporter | Metrics dashboard | Pre-launch |
| Finance Tracker | Revenue tracking, unit economics | Launch day |
| Executive Summary Generator | Investor/stakeholder updates | Post-launch week 2 |
| Sprint Prioritizer | Post-launch iteration | Post-launch |
| Backend Architect | Bug fixes, performance hotfixes | Post-launch |

---

## Risk Register

| ID | Risk | Phase | Probability | Impact | Mitigation | Owner |
|----|------|-------|-------------|--------|------------|-------|
| R1 | Fabric REST API rate limits block polling at scale | P0-P1 | Medium | High | Implement aggressive caching, poll only delta since last run, request rate limit increase from Microsoft | Backend Architect |
| R2 | Correlation accuracy is too low (< 90%) | P1 | Medium | High | Fall back to temporal-proximity heuristic with configurable window; allow manual correlation override; add user feedback loop | AI Engineer |
| R3 | .NET port takes longer than estimated | P3 | High | Medium | Keep Node.js version running as fallback; prioritize core services first; defer non-essential services | Backend Architect |
| R4 | Fabric Workload SDK has breaking changes | P3 | Medium | High | Pin SDK version; monitor Microsoft DevKit repo for changes; maintain abstraction layer between SDK and business logic | DevOps Automator |
| R5 | Beta recruitment falls short (< 10 users) | P4 | Medium | Medium | Expand outreach to Microsoft MVP network; offer incentives (free 6-month Pro tier); present at local user groups | Growth Hacker |
| R6 | Marketplace certification rejected | P5 | Low | High | Pre-validate all requirements in Phase 4; engage Microsoft partner support before submission; allocate 2-week buffer | Legal Compliance Checker |
| R7 | CU consumption of workload is too high | P3-P4 | Medium | High | Profile all operations early; set CU budgets per operation; optimize KQL queries; implement sampling at scale | Performance Benchmarker |
| R8 | Eventhouse ingestion latency unacceptable (> 5 min) | P0-P1 | Low | Medium | Tune batching policy (reduce to 5s); use streaming ingestion if available; implement client-side aggregation | Backend Architect |
| R9 | No .NET expertise available (solo developer) | P3 | Medium | High | Use AI agents for .NET code generation; keep reference Node.js implementation; engage contract .NET developer if blocked > 1 week | Senior Developer |
| R10 | Competitor launches similar Fabric-native tool | P4-P5 | Low | Medium | Accelerate differentiation (correlation engine, SLOs); emphasize community relationships and content authority; consider open-sourcing core components | Growth Hacker |

---

## Dependency Graph

```
Sprint 0
  S0-1 (GitHub repo)
    └── S0-3 (Scaffold Node.js)
         ├── S0-4 (Validate KQL ingestion)
         │    └── P0-4 (Eventhouse tables)
         └── P0-1 (Fabric API client)
              ├── P0-2 (Event poller)
              │    └── P1-1 (Production poller)
              │         ├── P1-2 (Correlation engine)
              │         │    ├── P1-3 (KQL materialized views)
              │         │    ├── P2-4 (Incident timeline)
              │         │    └── P2-6 (Dependency graph)
              │         ├── P1-4 (SLO engine)
              │         │    ├── P1-5 (SLO config schema)
              │         │    ├── P1-6 (Alerting engine)
              │         │    │    ├── P1-7 (CLI dashboard)
              │         │    │    └── P2-8 (Alerting UI)
              │         │    └── P2-5 (SLO dashboard)
              │         └── P1-8 (Integration tests)
              └── P0-6 (API validation)

  S0-2 (API inventory)
    └── P0-3 (Event schema)
         └── P0-4 (Eventhouse tables)

  S0-5 (Entra ID app)
    └── P2-2 (Dashboard auth)

  S0-6 (Blog outline)
    └── P0-7 (Blog post #1)
         └── P1-9 (Blog posts #2, #3)
              └── P2-10 (Blog posts #4, #5 + landing page)

Phase 2
  P2-1 (Next.js scaffold)
    ├── P2-2 (Auth)
    ├── P2-3 (Event timeline page)
    ├── P2-5 (SLO dashboard)
    ├── P2-6 (Dependency graph)
    ├── P2-7 (Search)
    ├── P2-8 (Alerting UI)
    └── P2-9 (Dashboard CI/CD)

Phase 3
  P3-1 (.NET + Azure CLI install)
    ├── P3-2 (Workload manifest)
    │    ├── P3-3 (.NET backend port)
    │    │    ├── P3-4 (Workload SDK integration)
    │    │    │    ├── P3-6 (Job types in scheduler)
    │    │    │    │    └── P3-7 (Monitoring hub integration)
    │    │    │    └── P3-8 (Dev capacity deployment)
    │    │    └── P3-9 (.NET CI/CD)
    │    └── P3-5 (Micro-frontend)
    │         └── P3-7 (Monitoring hub integration)
    └── P3-10 (Security audit) ← depends on P3-3 through P3-8

Phase 4
  P3-8 (Dev capacity deployed)
    ├── P4-1 (Beta program setup)
    │    ├── P4-2 (Beta recruitment)
    │    │    ├── P4-3 (Beta monitoring + support)
    │    │    ├── P4-8 (Feedback analysis)
    │    │    └── P4-9 (Performance optimization)
    │    └── P4-4 (Marketplace listing)
    │         ├── P4-5 (AppSource listing)
    │         ├── P4-6 (Pricing implementation)
    │         └── P4-10 (Microsoft partner app)
    └── P4-7 (Content marketing) ← independent, starts at phase start

Phase 5
  P4-4 + P4-5 (Marketplace approved)
    └── P5-1 (Marketplace go-live)
         ├── P5-2 (Launch campaign)
         │    └── P5-7 (Post-launch iteration)
         ├── P5-4 (Enterprise sales pipeline)
         ├── P5-5 (Onboarding automation)
         └── P5-8 (Revenue metrics)
  P3-5 (Features finalized)
    └── P5-3 (Documentation site)
  P3-8 (Production deployed)
    └── P5-6 (Production monitoring)
```

---

## Effort Summary

| Phase | Duration | Estimated Effort | Key Deliverable |
|-------|----------|-----------------|-----------------|
| Sprint 0 | 2-3 days | 16 hours | Repo, API inventory, scaffolding, Entra app |
| Phase 0 | Week 1-2 | 60 hours | Working ingestion pipeline, events in Eventhouse |
| Phase 1 | Week 3-6 | 132 hours | Correlation, SLOs, alerting, CLI dashboard |
| Phase 2 | Week 7-10 | 160 hours | Web dashboard with all features |
| Phase 3 | Week 11-16 | 192 hours | Native Fabric workload deployed to dev capacity |
| Phase 4 | Week 17-22 | 220 hours | 15+ beta users, marketplace submitted, pricing live |
| Phase 5 | Week 23-26 | 144 hours | Public launch, marketplace live, sales pipeline |
| **Total** | **26 weeks** | **924 hours** | **Production Fabric workload on Azure Marketplace** |

At ~35 hours/week of focused execution (leveraging AI agents for acceleration), this is achievable in the 26-week timeline. AI agents reduce research, boilerplate, and content creation time by an estimated 40-60%, making the hourly estimates realistic for a solo founder + agent team.

---

## Weekly Milestones

| Week | Milestone | Verification |
|------|-----------|-------------|
| 0 | Sprint 0 complete: repo, API inventory, scaffold, Entra app | `npm test` passes, API inventory has 10+ endpoints documented |
| 1 | Fabric API client library complete with tests | Integration test calls live API successfully |
| 2 | Event poller ingesting to Eventhouse continuously | KQL query returns events from last hour |
| 3 | Correlation engine linking pipeline -> notebook chains | Test pipeline chain appears as tree in KQL |
| 4 | SLO engine evaluating 5 test SLOs | SLO evaluations table shows pass/fail results |
| 5 | Alerting engine sending notifications | Test SLO breach triggers email and webhook |
| 6 | CLI dashboard showing live data, integration tests pass | `npm run test:integration` all green |
| 7 | Next.js dashboard scaffold with auth | Login with Microsoft, see workspace list |
| 8 | Event timeline and SLO dashboard pages functional | Pages render real data from Eventhouse |
| 9 | Incident timeline and dependency graph visualizations | 4-node tree renders correctly, graph shows all items |
| 10 | Search, alerts UI, landing page, blog series complete | All Phase 2 features demo-ready |
| 11 | .NET SDK installed, workload manifest defined | `dotnet build` succeeds, manifest validates |
| 12-13 | .NET backend core services ported | Backend polls events and evaluates SLOs |
| 14 | Workload SDK integration complete | Create item via Fabric portal works |
| 15 | Micro-frontend rendering in Fabric | Dashboard pages load inside Fabric chrome |
| 16 | Dev capacity deployment complete, security audit done | End-to-end smoke test passes in Fabric portal |
| 17 | Beta program launched, first users onboarding | 10+ beta applications received |
| 18-19 | Beta active, feedback flowing in | 15+ active beta users |
| 20 | Marketplace listings submitted, pricing live | Partner Center shows "In review" status |
| 21-22 | Beta feedback incorporated, performance optimized | NPS > 7/10, P95 latency < 2s |
| 23 | Marketplace live, launch campaign executed | Listings show "Live" in Partner Center |
| 24 | Documentation site live, enterprise outreach started | 50+ free signups, 5+ trial starts |
| 25 | Onboarding automation running, metrics tracking | 70% activation rate for new users |
| 26 | Week 26 review: hit $5K MRR target or document gap | Revenue dashboard shows actual MRR |

---

## Success Metrics -- Overall

| Metric | Target at Week 26 | How Measured |
|--------|-------------------|-------------|
| Free tier users | 200 | Signup count in database |
| Paid users (Pro + Enterprise) | 10 | Marketplace subscription count |
| MRR | $5,000 | Marketplace revenue report |
| Event ingestion uptime | > 99.5% | Application Insights availability |
| Mean ingestion latency | < 2 minutes | Eventhouse timestamp delta |
| Correlation accuracy | > 95% | Sampled manual verification |
| Beta NPS | > 40 | NPS survey |
| Waitlist signups | 500+ | Email list count |
| Blog total views | 10,000+ | Analytics across all posts |
| GitHub toolkit stars | 100+ | GitHub repo metrics |

---

## Appendix A: Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Phase 0-2 Backend | Node.js + TypeScript | Available now; fast iteration |
| Phase 3+ Backend | .NET 8 (C#) | Fabric Workload SDK requirement |
| Phase 2 Frontend | Next.js 14 + React + Tailwind + Shadcn/ui | Modern, performant, great DX |
| Phase 3 Frontend | React micro-frontend + Fabric Frontend SDK + Fluent UI | Fabric workload requirement |
| Data Store | Fabric Eventhouse (KQL) | Native to Fabric, zero egress, long retention |
| Authentication | Entra ID (MSAL) | Fabric-native identity |
| CI/CD | GitHub Actions | Already available |
| Hosting (Phase 0-2) | Azure Container App or local | Simple, cost-effective |
| Hosting (Phase 3+) | Fabric workload hosting + Azure Container App | Fabric-native deployment |
| Monitoring | Azure Application Insights | Native to Azure, free tier available |
| CRM | HubSpot (free) | Sufficient for early-stage |
| Email | SendGrid or Microsoft Graph | Transactional and marketing email |
| Content | Medium / custom blog | SEO and community reach |

---

## Appendix B: KQL Query Templates (for Phase 0-1 Development)

These queries will be used by the ingestion and SLO engines. Documenting them here for reference during development.

### Recent Events by Workspace
```kql
ObservabilityEvents
| where ingestedAtUtc > ago(1h)
| summarize eventCount = count(), failureCount = countif(status == "Failed") by workspaceName
| extend failureRate = round(todouble(failureCount) / todouble(eventCount) * 100, 2)
| order by eventCount desc
```

### SLO Freshness Check
```kql
let targetItemId = "<item-id>";
let freshnessHours = 2;
ObservabilityEvents
| where itemId == targetItemId and status == "Completed"
| summarize lastSuccess = max(endTimeUtc)
| extend hoursStale = datetime_diff('hour', now(), lastSuccess)
| extend isFresh = hoursStale <= freshnessHours
```

### SLO Success Rate (7-Day Window)
```kql
let targetItemId = "<item-id>";
let windowDays = 7;
ObservabilityEvents
| where itemId == targetItemId and startTimeUtc > ago(windowDays * 1d)
| summarize total = count(), succeeded = countif(status == "Completed")
| extend successRate = round(todouble(succeeded) / todouble(total) * 100, 2)
```

### Duration P95 (7-Day Window)
```kql
let targetItemId = "<item-id>";
let windowDays = 7;
ObservabilityEvents
| where itemId == targetItemId and startTimeUtc > ago(windowDays * 1d) and status == "Completed"
| summarize p95_duration_ms = percentile(durationMs, 95)
```

### Correlation Tree
```kql
CorrelationEdges
| where rootJobInstanceId == "<root-id>"
| join kind=inner ObservabilityEvents on $left.childJobInstanceId == $right.jobInstanceId
| project childItemName, childItemType, childStatus = status, childDurationMs = durationMs, depth
| order by depth asc
```
