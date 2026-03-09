# Sprint 04 Plan -- Observability Workbench

> **Sprint**: 04
> **Duration**: 2 weeks (2026-03-24 to 2026-04-06)
> **Product**: Observability Workbench v0.3.0
> **Repository**: github.com/tenfingerseddy/FabricWorkloads
> **Status**: In Progress (Mar 10 update)
> **Budget**: 80 hours of agent work

---

## Progress Tracker (Updated Mar 10, session 2)

| Task | Status | Notes |
|------|--------|-------|
| B1: Incident Timeline | DONE | IncidentTimeline.tsx + TimelineNode.tsx + SCSS. Wired into dashboard. |
| C1: Event Search | DONE | EventSearch.tsx + SCSS. Wired into dashboard with toolbar search button. |
| F1: KQL Integration Tests | DONE | 268 tests in 10 files (added auth + store tests). Coverage: 57.84% stmts, 80.79% branches, 86.36% functions. |
| F2: Node v20 pinning | DONE | .nvmrc + Volta config. |
| H3: Hardcoded URLs (security) | DONE | 19 files remediated. Last hardcoded URL in config.ts also fixed. |
| H7: Stack traces (security) | DONE | errors.ts utility, sanitized responses in all controllers/hooks. |
| escapeKql hardening | DONE | Backtick, `<\|` marker, control char sanitization in src/kql-client.ts. |
| CI pipeline fix | DONE | Fixed package-lock.json missing @vitest/coverage-v8. All 5 CI jobs green (Node 20, 22, Security, Notebooks, Bundle). |
| D1: Blog publishing | IN PROGRESS | 6 blog posts being updated with current metrics (268 tests, 25 queries). Publishing checklist in progress. |
| Design partner outreach | DONE | Email templates, one-pager, community post templates committed. Pitch deck + demo script + agreement template in progress. |
| D2: README polish | DONE | Full rewrite with problem statement, quickstart, architecture diagram, badges. |
| E1: Landing page | DONE | Complete redesign: dark theme, responsive, signup form, feature grid, SEO meta tags. |
| A1: DevGateway | IN PROGRESS | Scripts copied, getting-started guide written. Interactive setup needed (Node v20, DevGateway binary, developer mode). |
| A2: Live KQL in iframe | NOT STARTED | kqlQueryService.ts ready. Blocked on A1 interactive steps. |
| Sprint 05 planning | DONE | Sprint 05 plan created (12 tasks, 80hr budget, design partner hardening focus). |
| Code quality audit | DONE | A+ rating, zero issues. 35 TypeScript errors in workload frontend fixed. |
| Demo data generator | IN PROGRESS | Agent building scripts/generate-demo-data.mjs for realistic Eventhouse sample data. |
| Competitive analysis | IN PROGRESS | Agent researching March 2026 competitive landscape (Monte Carlo, Atlan, Purview, new entrants). |
| KQL query pack enhancement | IN PROGRESS | Agent creating standalone README, quickstart guide, and improved documentation. |

---

## Sprint Goal

**Deliver a demo-ready workload that can run inside Fabric via DevGateway, complete with live data, polished UI, and enough content to start design partner conversations.**

Sprint 04 takes the product from "functional backend + scaffolded frontend" to "something we can screen-share with a potential design partner and they say yes." That means: DevGateway integration working end-to-end, the dashboard rendering real Eventhouse data inside Fabric's iframe, the incident timeline view built (our most differentiated visual), and the open-source launch content published. Every task is judged by one question: does this move us closer to our first paying customer?

---

## Sprint 03 Exit State (What We Have)

| Component | State | Notes |
|-----------|-------|-------|
| CLI Tool | Working | Auth, collector, KQL ingestion, dashboard, alerts, scheduler, waste score |
| Tests | 268 passing (10 files) | Unit tests via Vitest; CI green. Auth + store tests added Mar 10 session 2 |
| KQL Tables | 6 tables | FabricEvents (137 events), SloSnapshots (88), AlertRules (52 alerts), EventCorrelations (8), SloDefinitions, WorkspaceInventory |
| Fabric Notebooks | 3 running | NB_ObsIngestion, NB_ObsCorrelation, NB_ObsAlerts -- autonomous on schedule |
| Workload Frontend | Wired to KQL | KQL query service built, React hooks (useObservabilityData, useSloData, useAlertData), typed responses |
| Item Editors | 3 items | WorkbenchDashboard, AlertRule, SLODefinition -- editors with DefaultView, EmptyView, Ribbon |
| Extensibility Toolkit | Phase 1-2 complete | Manifest (XML + JSON + XSD + nuspec), .env files, devServer directory, 21 clients + 13 controllers |
| Content | 6 blogs written | Blogs 01-06 written (5 in market-research, 1 in content), 5+ weeks social posts, growth playbook, HN launch post |
| KQL Community Pack | 20 queries | Referenced in growth playbook |
| Landing Page | Static | index.html at landing-page/ |
| CI/CD | Green | GitHub Actions: typecheck + test on PR/push to main |

### Known Issues Entering Sprint 04

| # | Issue | Impact | Root Cause |
|---|-------|--------|------------|
| 1 | Local build blocked on Node v24 | Cannot test workload build locally | Node v24 compatibility issue; CI uses v20 and works fine |
| 2 | DevGateway not yet tested end-to-end | Cannot demo inside Fabric portal | Scripts copied but DevGateway binary not downloaded, developer mode not enabled |
| 3 | No incident timeline view | Missing our most differentiated feature | Deferred from Sprint 03; correlation data now clean enough to build it |
| 4 | No event search UI | Users cannot explore historical events | KQL service has getEventSearch() but no component consumes it |
| 5 | Admin API access blocked | Cannot enumerate tenant-level data | SP needs admin consent; tracked but not actionable |
| 6 | Content not published | Zero community awareness | 6 blogs and social content written but not posted anywhere |
| 7 | Landing page stale | No screenshots, no demo section, no signup form | Static HTML from Sprint 01, never updated |

---

## Definition of "Demo-Ready"

A design partner demo is successful when we can show the following in a 15-minute screen-share:

1. **Open Fabric portal, navigate to our workload** -- proves it is a real Fabric workload, not an external tool
2. **Create a WorkbenchDashboard item** -- shows item lifecycle works
3. **Dashboard loads live SLO data from Eventhouse** -- SLO cards with real success rates, freshness metrics, health status colors
4. **Click into an incident timeline** -- shows cross-item correlation: pipeline triggered notebooks, one failed, downstream semantic model refresh was affected
5. **Show AlertRule editor** -- create/edit alert rules against live data
6. **Show event search** -- full-text search across 137+ historical events with filters
7. **Exit Fabric, show the CLI** -- `npm start` produces the same data from the command line (open-source hook)

The partner should walk away thinking: "This solves a real problem I have, and it's already further along than I expected."

---

## Task Breakdown

### Theme A: DevGateway End-to-End (P0 -- Sprint Fails Without This)

Without DevGateway working, we cannot demo inside Fabric. This is the single highest priority.

---

#### A1: Complete DevGateway integration and first Fabric test

**Priority**: P0
**Effort**: 6 hours
**Assignee**: Backend / DevOps
**Dependencies**: None (devServer files already copied from toolkit)
**ID**: S04-A1

**Description**: The devServer directory, env files, PowerShell scripts, and manifest files are all in place from Sprint 03 (Extensibility Toolkit Phase 1-2). What remains is:

1. Pin local Node to v20 (nvm or volta) to resolve the Node v24 build blocker.
2. Run `scripts/Setup/DownloadDevGateway.ps1` to get the DevGateway binary.
3. Enable Fabric Developer Mode in the tenant admin settings.
4. Run `npm run build` to produce the frontend bundle.
5. Run `scripts/Run/StartDevServer.ps1` to start the local dev server.
6. Run `scripts/Run/StartDevGateway.ps1` to register with Fabric.
7. Navigate to the ObservabilityWorkbench-Dev workspace in Fabric portal.
8. Verify all 3 item types appear in the "New" menu.
9. Create one item of each type and verify the editor loads in the iframe.
10. Document any issues encountered in a troubleshooting section of the getting-started guide.

**Files to modify**:
- `products/observability-workbench/docs/getting-started.md` (add DevGateway section)
- `.nvmrc` or `volta` config (pin Node v20)
- Potentially `workload/webpack.config.js` if build issues arise

**Acceptance Criteria**:
- [ ] `npm run build` succeeds locally with Node v20
- [ ] DevGateway registers with Fabric tenant (no errors in console)
- [ ] All 3 item types appear in the workspace "New" dropdown
- [ ] WorkbenchDashboard editor loads in the Fabric iframe without blank screen
- [ ] AlertRule editor loads
- [ ] SLODefinition editor loads
- [ ] Getting-started docs updated with DevGateway instructions

---

#### A2: Wire dashboard to live KQL data inside DevGateway iframe

**Priority**: P0
**Effort**: 5 hours
**Assignee**: Frontend
**Dependencies**: A1
**ID**: S04-A2

**Description**: The KQL query service (`workload/app/services/kqlQueryService.ts`) and React hooks (`useObservabilityData`, `useSloData`, `useAlertData`) exist but have not been validated running inside the Fabric iframe via DevGateway. The auth flow inside the iframe uses the workload SDK's OBO token, which may behave differently from standalone dev mode.

Tasks:
1. Test that `FabricAuthenticationService.acquireAccessToken()` correctly obtains a Kusto-scoped token inside the iframe.
2. If OBO token fails for Kusto, implement fallback: use the workload backend proxy pattern (frontend calls workload API, workload exchanges token via OBO for Kusto token).
3. Verify `getSLODashboardData()` returns real data from EH_Observability.
4. Verify the WorkbenchDashboard DefaultView renders SLO cards, alert panel, and waste score with live data.
5. Test auto-refresh (60-second polling) works in the iframe context.
6. Handle the "first-time setup" case: when no Eventhouse is configured, show a setup wizard instead of errors.

**Files to modify**:
- `workload/app/services/kqlQueryService.ts` (iframe auth adjustments)
- `workload/app/items/WorkbenchDashboard/WorkbenchDashboardDefaultView.tsx` (setup wizard)
- `workload/app/hooks/useObservabilityData.ts` (error handling)

**Acceptance Criteria**:
- [ ] Dashboard displays live SLO data inside Fabric iframe (not sample data)
- [ ] Auth token acquisition works via OBO flow inside iframe
- [ ] If Eventhouse is unreachable, shows setup guidance (not a crash)
- [ ] Auto-refresh works without memory leaks in the iframe
- [ ] Workspace selector filters data correctly

---

### Theme B: Incident Timeline (P0 -- Demo Differentiator)

The incident timeline is our most differentiated feature. No competitor shows cross-item correlation visually inside Fabric. This is what makes the demo memorable.

---

#### B1: Build Incident Timeline component

**Priority**: P0
**Effort**: 8 hours
**Assignee**: Frontend
**Dependencies**: A2 (needs live KQL connection verified)
**ID**: S04-B1

**Description**: Build the Incident Timeline view (Product Spec Feature F5). This is the component a user sees when they click on a failed event and want to understand what happened.

The timeline shows:
1. **Trigger chain** (upstream): what initiated this item's execution (e.g., a pipeline triggered a notebook)
2. **Impact chain** (downstream): what depends on this item (e.g., a semantic model refresh that is now stale)
3. **Timeline visualization**: horizontal timeline with each event as a node, colored by status (green = success, red = failed, yellow = in progress, gray = skipped)
4. **Event detail panel**: click any node to see full details (start time, end time, duration, error message, item type, workspace)
5. **Correlation confidence**: show the confidence score and correlation type (activityRun / rootActivityId / timeWindow) for each link

Data source: `getCorrelationChains()` from KQL query service, which reads EventCorrelations + FabricEvents.

Use Fluent UI v9 components for the layout. The timeline itself can use a simple CSS-based horizontal track (no need for a charting library).

**Files to create**:
- `workload/app/items/WorkbenchDashboard/IncidentTimeline.tsx`
- `workload/app/items/WorkbenchDashboard/IncidentTimeline.scss`
- `workload/app/items/WorkbenchDashboard/TimelineNode.tsx` (individual event node)

**Files to modify**:
- `workload/app/items/WorkbenchDashboard/WorkbenchDashboardDefaultView.tsx` (add "View Timeline" action on failed events)
- `workload/app/services/kqlQueryService.ts` (if additional queries needed for timeline detail)

**Acceptance Criteria**:
- [ ] Clicking a failed SLO card opens the incident timeline
- [ ] Timeline shows upstream trigger chain (at least 1 level: pipeline -> notebook)
- [ ] Timeline shows downstream impact (semantic model refresh delayed/failed)
- [ ] Each node shows status color, item name, and duration
- [ ] Clicking a node shows full event details in a side panel
- [ ] Correlation confidence displayed per link
- [ ] Works with the 8 correlations currently in Eventhouse
- [ ] Empty state when no correlations exist for the selected event

---

### Theme C: Event Search UI (P1 -- Completes the Demo)

---

#### C1: Build Event Search component

**Priority**: P1
**Effort**: 5 hours
**Assignee**: Frontend
**Dependencies**: A2
**ID**: S04-C1

**Description**: Build the search interface for Feature F6 from the product spec. The KQL query service already has `getEventSearch(filters)` implemented. This task builds the UI.

The search view provides:
1. **Search bar**: full-text search across event metadata, error messages, item names
2. **Filter panel**: item type (multi-select), status (multi-select), time range (preset + custom), workspace
3. **Results table**: sortable columns -- item name, item type, status, start time, duration, error message (truncated)
4. **Detail flyout**: click a row to see full event details
5. **Pagination**: load 50 results at a time, "load more" button (KQL skip/take)
6. **Quick stats**: "X results in Y ms" above results

**Files to create**:
- `workload/app/items/WorkbenchDashboard/EventSearch.tsx`
- `workload/app/items/WorkbenchDashboard/EventSearch.scss`

**Files to modify**:
- `workload/app/items/WorkbenchDashboard/WorkbenchDashboardDefaultView.tsx` (add Search tab/view)
- `workload/app/items/WorkbenchDashboard/WorkbenchDashboardRibbon.tsx` (add Search button)

**Acceptance Criteria**:
- [ ] Search returns results from FabricEvents table in Eventhouse
- [ ] Filters narrow results correctly (item type, status, time range)
- [ ] Results table is sortable by any column
- [ ] Clicking a row shows full event detail in a flyout
- [ ] "No results" state when search returns empty
- [ ] Search executes in under 5 seconds for 90-day range
- [ ] 137+ events in Eventhouse are all searchable

---

### Theme D: Open-Source Launch (P0 -- Critical for Pipeline to First Customer)

No community awareness exists. Zero GitHub stars, zero npm installs, zero blog views. Until content is published, there is no pipeline to design partners. This is as critical as the product work.

---

#### D1: Publish blog posts 01 and 02 on dev.to

**Priority**: P0
**Effort**: 3 hours
**Assignee**: Content
**Dependencies**: None
**ID**: S04-D1

**Description**: Blogs 01 ("State of Fabric Observability in 2026") and 02 ("Cross-Item Correlation in Fabric") are written and have dev.to versions ready. Publish them.

Tasks:
1. Review blog-01-devto.md and blog-02-devto.md for accuracy against current product state.
2. Update any outdated references (test count is now 269, not 164; events are 137, not 40).
3. Ensure GitHub repo link points to the correct URL.
4. Verify frontmatter tags: `microsoft-fabric`, `dataengineering`, `observability`, `opensource`.
5. Publish Blog 01 on dev.to.
6. Wait 2 days, then publish Blog 02.
7. Post accompanying LinkedIn content from `week-01-social-posts.md`.
8. Post Reddit thread in r/MicrosoftFabric from week-01 content.

**Files to review/update**:
- `business/market-research/blog-01-devto.md`
- `business/market-research/blog-02-devto.md`
- `business/content/week-01-social-posts.md`

**Acceptance Criteria**:
- [ ] Blog 01 live on dev.to with correct tags and canonical URL
- [ ] Blog 02 live on dev.to 2 days after Blog 01
- [ ] Both posts link to GitHub repo
- [ ] LinkedIn posts published (2 posts from week-01 batch)
- [ ] Reddit thread posted in r/MicrosoftFabric
- [ ] Statistics captured at end of sprint: view count, reactions, comments

---

#### D2: Polish GitHub README for open-source launch

**Priority**: P0
**Effort**: 3 hours
**Assignee**: Content / Frontend
**Dependencies**: A2 (need screenshots from working dashboard)
**ID**: S04-D2

**Description**: The README is the storefront. Before publishing blog posts that link to the repo, the README must sell the project in 30 seconds.

Following the growth playbook requirements:
1. Clear problem statement (3 bullet points on Fabric monitoring limitations).
2. 30-second quickstart (`npm install`, configure, `npm start`, see output).
3. Architecture diagram (text-based, showing Eventhouse + notebooks + CLI + workload).
4. Screenshot or GIF of the CLI dashboard output.
5. Screenshot of the Fabric workload dashboard (from A2).
6. Badges: CI status, license (MIT), npm version, test count.
7. Feature list with checkmarks for what is working.
8. Roadmap section linking to product spec.
9. Contributing guide link.
10. "Star us on GitHub" call-to-action.

**Files to modify**:
- Repository README.md (at products/observability-workbench/ or repo root)

**Files to create**:
- `products/observability-workbench/docs/CONTRIBUTING.md`
- Screenshot files in `docs/images/`

**Acceptance Criteria**:
- [ ] README has all 10 elements listed above
- [ ] Screenshots are current (taken from Sprint 04 working product)
- [ ] `npm install && npm start` works for a new user following the README
- [ ] CONTRIBUTING.md has clear setup instructions and PR guidelines
- [ ] At least 3 "good first issue" labels on GitHub issues

---

#### D3: Publish Hacker News Show HN post

**Priority**: P1
**Effort**: 2 hours
**Assignee**: Content
**Dependencies**: D1, D2 (repo must be polished, blogs must be live)
**ID**: S04-D3

**Description**: Execute the Show HN launch from `business/content/launch-post-hackernews.md`. Target Tuesday or Wednesday of Sprint 04 Week 2 (March 31 or April 1), 10:00-11:00 AM US Eastern.

Tasks:
1. Review and finalize the HN post text.
2. Prepare FAQ responses for predictable questions (Why not Purview? Why TypeScript? Monte Carlo comparison?).
3. Post at optimal time.
4. Monitor and respond to every comment within 2 hours.
5. Track karma and engagement.

**Files to reference**:
- `business/content/launch-post-hackernews.md`

**Acceptance Criteria**:
- [ ] Show HN post published at optimal time
- [ ] Every comment receives a substantive response within 4 hours
- [ ] Post reaches at least 10 upvotes (minimum viable visibility)
- [ ] GitHub star count tracked before and after post

---

### Theme E: Landing Page and Signup (P1)

---

#### E1: Update landing page with demo section and early access signup

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Frontend
**Dependencies**: A2 (screenshots), B1 (timeline screenshot)
**ID**: S04-E1

**Description**: The landing page is stale static HTML from Sprint 01. Update it per Sprint 03 plan item E2 (carried forward) plus the growth playbook requirements.

Add:
1. "See It In Action" section with 3-4 screenshots: CLI dashboard, Fabric workload dashboard, incident timeline, SLO cards.
2. Updated feature list including CU Waste Score and cross-item correlation.
3. Early Access signup form (embed Tally.so or Google Forms -- collects email + company name + Fabric workspace count).
4. Social proof section: link to blog posts, GitHub star count badge, test count badge.
5. "Built for Fabric" section emphasizing zero-egress, permission-inherited, Fabric-native.
6. Responsive design (test on mobile).

**Files to modify**:
- `products/observability-workbench/landing-page/index.html`

**Acceptance Criteria**:
- [ ] Landing page loads without errors
- [ ] "See It In Action" section has at least 3 visual assets
- [ ] Early access form is functional and collects submissions
- [ ] Feature list includes CU Waste Score, incident timeline, cross-item correlation
- [ ] Page is mobile-responsive (test at 375px and 768px)
- [ ] Load time under 3 seconds

---

### Theme F: Testing and Stability (P1)

---

#### F1: Integration test suite for KQL queries

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Backend
**Dependencies**: None
**ID**: S04-F1

**Description**: Carried forward from Sprint 03 C1. Create an integration test suite that validates KQL query correctness against the live Eventhouse. These tests run outside CI (require Fabric credentials) but provide a safety net for query changes.

Tests should cover:
1. FabricEvents query returns expected columns and types (137+ rows).
2. SloSnapshots query correctly joins with SloDefinitions.
3. EventCorrelations query returns valid GUIDs.
4. AlertRules CRUD: insert a test rule, query it, delete it.
5. WorkspaceInventory dedup query works correctly.
6. KQL query service functions match the types consumed by React hooks.

**Files to create**:
- `products/observability-workbench/src/__tests__/kql-integration.test.ts`
- Update `package.json` with `test:integration` script

**Acceptance Criteria**:
- [ ] `npm run test:integration` runs all KQL tests when credentials are available
- [ ] Tests skip gracefully (not fail) when credentials are missing
- [ ] Each test validates response schema (column names and types)
- [ ] At least 6 integration tests covering the scenarios above
- [ ] README documents how to run integration tests

---

#### F2: Fix Node v24 local build compatibility

**Priority**: P1
**Effort**: 2 hours
**Assignee**: DevOps
**Dependencies**: None
**ID**: S04-F2

**Description**: The workload build fails on Node v24 locally. CI uses Node v20 and passes. This task resolves the incompatibility so developers on Node v24 can also build.

Options (in priority order):
1. Add `.nvmrc` with `20` and document `nvm use` in getting-started.
2. Add `volta` config to `package.json` to pin Node version.
3. Investigate and fix the actual v24 incompatibility (likely webpack or dependency issue).

**Files to modify**:
- `.nvmrc` or `package.json` (volta section)
- `products/observability-workbench/docs/getting-started.md`

**Acceptance Criteria**:
- [ ] A documented, reliable way to build the project locally
- [ ] Getting-started guide includes Node version requirements
- [ ] CI continues to pass

---

### Theme G: Content Pipeline (P2)

---

#### G1: Publish blogs 03-04 on dev.to

**Priority**: P2
**Effort**: 2 hours
**Assignee**: Content
**Dependencies**: D1 (blogs 01-02 should be published first)
**ID**: S04-G1

**Description**: Continue the content cadence. Publish Blog 03 ("Hidden Cost of Bad Data in Fabric") and Blog 04 ("FabCon Observability Gap"). Both have dev.to versions ready.

Spacing: one post per week. If D1 publishes blogs 01-02 in Week 1, publish 03 in Week 2 and 04 the following week (may slip to Sprint 05).

**Files to review/update**:
- `business/market-research/blog-03-devto.md` or `business/content/blog-03-devto.md`
- `business/market-research/blog-04-devto.md`

**Acceptance Criteria**:
- [ ] At least Blog 03 published on dev.to during Sprint 04
- [ ] Accompanying LinkedIn post published
- [ ] View counts tracked

---

#### G2: Publish weeks 02-03 social content

**Priority**: P2
**Effort**: 1.5 hours
**Assignee**: Content
**Dependencies**: D1
**ID**: S04-G2

**Description**: Post the pre-written LinkedIn and Reddit content from weeks 02-03. Follow the growth playbook cadence: 2 LinkedIn posts per week, 1 Reddit post per week.

**Files to reference**:
- `business/content/week-02-social-posts.md`
- `business/content/week-02-linkedin-thought-leadership.md`
- `business/content/week-03-fabcon-social-posts.md`

**Acceptance Criteria**:
- [ ] 4 LinkedIn posts published across 2 weeks
- [ ] 2 Reddit posts published (r/MicrosoftFabric, r/dataengineering)
- [ ] Engagement tracked (impressions, comments, karma)

---

## Sprint Capacity and Schedule

### Effort Summary by Theme

| Theme | Tasks | Total Hours | Priority |
|-------|-------|-------------|----------|
| A: DevGateway End-to-End | A1, A2 | 11h | P0 |
| B: Incident Timeline | B1 | 8h | P0 |
| C: Event Search | C1 | 5h | P1 |
| D: Open-Source Launch | D1, D2, D3 | 8h | P0 + P1 |
| E: Landing Page | E1 | 4h | P1 |
| F: Testing & Stability | F1, F2 | 6h | P1 |
| G: Content Pipeline | G1, G2 | 3.5h | P2 |
| **Total** | **11 tasks** | **45.5h** | |
| **Buffer (30%)** | | **13.5h** | |
| **Total with buffer** | **11 tasks** | **59h** | |

Note: Intentionally planned at 59h against 80h budget. Sprint 03 taught us that integration work (DevGateway + Fabric iframe) always takes longer than estimated. The remaining 21h is reserved for:
- Debugging DevGateway auth/iframe issues (historically the hardest part)
- Fixing regressions from Sprint 03 tasks
- Responding to community feedback once blogs are published
- Unplanned work from early design partner conversations

### Effort Summary by Priority

| Priority | Tasks | Hours | Mandate |
|----------|-------|-------|---------|
| P0 (must ship) | A1, A2, B1, D1, D2 | 25h | Sprint fails without these |
| P1 (should ship) | C1, D3, E1, F1, F2 | 17h | High value, drop if blocked |
| P2 (stretch) | G1, G2 | 5.5h | Carry to Sprint 05 if needed |

### Effort Summary by Assignee Category

| Category | Tasks | Hours |
|----------|-------|-------|
| Frontend | A2, B1, C1, E1 | 22h |
| Backend / DevOps | A1, F1, F2 | 12h |
| Content | D1, D2, D3, G1, G2 | 11.5h |

---

## Dependency Graph

```
A1 (DevGateway end-to-end)
  |
  v
A2 (Dashboard live KQL in iframe) -----> B1 (Incident Timeline)
  |                                        |
  +-----> C1 (Event Search UI)             +-----> E1 (Landing page -- needs timeline screenshot)
  |
  +-----> D2 (README polish -- needs dashboard screenshot)

D1 (Publish blogs 01-02) -----> D3 (Show HN post)
                           |
                           +-----> G1 (Publish blogs 03-04)
                           |
                           +-----> G2 (Social content weeks 02-03)

F1 (Integration tests) -----------> [independent]
F2 (Node v24 fix) ----------------> [independent, but accelerates A1]
```

### Critical Path

```
F2 (fix Node) --> A1 (DevGateway) --> A2 (live KQL in iframe) --> B1 (Incident Timeline)
```

This is the path to demo-ready. If any task on this path slips, the sprint goal is at risk. Everything else can slip to Sprint 05 without derailing the business.

### Recommended Execution Order (Week 1: March 24-28)

| Day | Backend / DevOps | Frontend | Content |
|-----|-----------------|----------|---------|
| Mon | F2 (Node v24 fix), A1 start (DevGateway download + setup) | -- blocked on A1 -- | D1 (review + publish Blog 01) |
| Tue | A1 continue (DevGateway registration + testing) | -- blocked on A1 -- | D2 (README polish -- text, badges, quickstart) |
| Wed | A1 completion | A2 start (iframe auth + KQL wiring) | D1 (publish Blog 02, LinkedIn posts) |
| Thu | F1 (integration tests) | A2 continue | D2 (add screenshots after A2 works) |
| Fri | F1 completion | A2 completion | D2 completion, push to GitHub |

### Recommended Execution Order (Week 2: March 31 - April 4)

| Day | Backend / DevOps | Frontend | Content |
|-----|-----------------|----------|---------|
| Mon | Bug fixes from Week 1 | B1 start (Incident Timeline) | D3 prep (review HN post, prepare FAQ) |
| Tue | Bug fixes, support Frontend | B1 continue | D3 (post Show HN -- Tue 10am ET) |
| Wed | Buffer | B1 completion, C1 start (Event Search) | D3 (HN comment monitoring), G1 (publish Blog 03) |
| Thu | Buffer | C1 continue, E1 (Landing page) | G2 (social posts weeks 02-03) |
| Fri | Sprint review, retro | E1 completion, sprint review | Sprint review, metrics capture |

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | DevGateway fails to register with Fabric tenant | Medium | Critical | Start A1 on Day 1. If DevGateway fails, fall back to standalone dev server for demo (less impressive but still shows the product). Document workaround. |
| 2 | OBO token for Kusto fails inside Fabric iframe | Medium | High | A2 has fallback plan: proxy through workload backend. Also test with direct Kusto REST endpoint + managed identity if available. |
| 3 | Node v24 fix is non-trivial | Low | Medium | F2 is scheduled first. Worst case: mandate Node v20 via .nvmrc and move on. |
| 4 | Show HN gets zero traction | Medium | Low | HN is one channel. Reddit and dev.to may be higher value for this niche (per growth playbook). Success is not dependent on HN. |
| 5 | Blog posts get no engagement | Low | Medium | 6 posts ready gives us sustained cadence. If first 2 underperform, adjust titles/CTAs before publishing 3-4. |
| 6 | Incident timeline data is too sparse for good demo | Medium | Medium | We have 8 correlations, 137 events. If not enough, run the CLI collector to generate more real data before the demo. Can also use a "demo workspace" with scripted pipeline runs. |
| 7 | Fabric trial capacity expires or pauses | Low | Critical | Verify capacity status at sprint start. Kanes Trial capacity has been active; set a calendar reminder to check weekly. |
| 8 | Sprint 03 bugs surface in integration testing | Medium | Medium | 21h buffer allocated. Integration tests (F1) will catch issues early in Week 1. |

---

## Metrics to Track

### Product Metrics

| Metric | Current (Sprint 03 Exit) | Sprint 04 Target | How to Measure |
|--------|-------------------------|-----------------|----------------|
| Test count | 268 passing (10 files) | 225+ | `npm test` output |
| CI pass rate | 100% | 100% | GitHub Actions history |
| Eventhouse events | 137 | 200+ | `FabricEvents \| count` |
| SLO snapshots | 88 | 150+ | `SloSnapshots \| count` |
| Correlations | 8 | 20+ | `EventCorrelations \| count` |
| Dashboard load time (iframe) | N/A (not tested) | < 3 seconds | Browser devtools in Fabric |
| Item types working in DevGateway | 0 | 3 | Manual verification |

### Community Metrics

| Metric | Current | Sprint 04 Target | How to Measure |
|--------|---------|-----------------|----------------|
| GitHub stars | 0 | 25+ | GitHub repo page |
| npm installs | 0 | 15+ | npm stats |
| Blog post views (total) | 0 | 500+ | dev.to analytics |
| LinkedIn post impressions | 0 | 1,000+ | LinkedIn analytics |
| Reddit post karma | 0 | 20+ | Reddit |
| Design partner conversations started | 0 | 2+ | Inbound DMs / emails |
| Email signups (early access) | 0 | 10+ | Signup form submissions |

### Business Metrics

| Metric | Current | Sprint 04 Target | How to Measure |
|--------|---------|-----------------|----------------|
| Design partners signed | 0 | 0 (conversations started) | Tracker doc |
| Revenue | $0 | $0 | N/A yet |
| Weeks to first paid customer | Unknown | Estimate: 12-16 weeks | Business plan projection |

---

## Resource Allocation by Agent

| Agent Type | Tasks | Hours | Priority |
|-----------|-------|-------|----------|
| **Backend Architect** | A1 (DevGateway), F1 (integration tests) | 10h | P0 + P1 |
| **DevOps Automator** | F2 (Node fix), A1 (DevGateway scripts) | 4h | P1 + P0 |
| **Frontend Developer** | A2 (iframe KQL), B1 (timeline), C1 (search), E1 (landing) | 22h | P0 + P1 |
| **Content Creator** | D1 (publish blogs), D2 (README), D3 (HN), G1-G2 (ongoing content) | 11.5h | P0 + P1 + P2 |

Frontend is the bottleneck this sprint (22h of the critical path). If the Backend Architect finishes A1 and F1 early, they should assist with B1 (the timeline component data layer).

---

## Carry-Forward to Sprint 05

Items explicitly deferred from Sprint 04:

1. **Admin API access** -- Still requires tenant admin consent. Track but do not block on it.
2. **Lakehouse cold archive** -- Product spec v0.2+ feature. Not needed for demo or early adopters.
3. **Teams webhook notifications** -- NB_ObsAlerts scaffolded. Needs a configured webhook. Deferred until design partners provide their Teams environments.
4. **Full Extensibility Toolkit Phase 3-7** -- DevGateway end-to-end (A1) covers Phase 5. Remaining phases (NuGet packaging, CI/CD integration, Azure deployment) are Sprint 05+.
5. **SLO template library** -- Growth playbook item. Build after design partners tell us which SLOs they care about.
6. **Discord / community infrastructure** -- Growth playbook Week 5-6. Not needed until we have community members to serve.
7. **Saved searches and shared views** -- Product spec F6 secondary features. Search basics (C1) ship first.
8. **KQL query interface for advanced users** -- Product spec F6. Build when power users request it.
9. **npx fabric-health-check standalone tool** -- Growth playbook viral loop. Build when blog content drives enough interest to justify the investment.

---

## Sprint 04 Definition of Done

The sprint is **done** when:

1. **P0 tasks A1, A2, B1, D1, D2 are merged to main and passing CI.**
2. All 3 item types load in Fabric via DevGateway.
3. WorkbenchDashboard displays live Eventhouse data inside the Fabric iframe.
4. Incident Timeline shows at least one cross-item correlation chain visually.
5. Blog posts 01 and 02 are live on dev.to.
6. README is polished with screenshots, quickstart, and badges.
7. All 269+ tests continue to pass.
8. No regressions in CLI tool functionality.

### Per-Task Definition of Done

Every task is done when:
- [ ] Code is committed to a feature branch and PR is opened
- [ ] CI pipeline passes (typecheck + tests)
- [ ] Merged to main
- [ ] Verified working against live Fabric environment (for DevGateway/KQL tasks)
- [ ] Any new UI components have at least a loading state, error state, and empty state

---

## Sprint 04 Success = Design Partner Confidence

If we complete the P0 tasks, we can conduct a design partner demo that shows:

- A Fabric-native workload (not a toy, not an external tool)
- Live SLO monitoring with real data
- Cross-item incident correlation that no one else offers
- An open-source project with active development and published thought leadership

That is enough to start conversations. The revenue clock starts when design partners say yes. Everything in this sprint is in service of that moment.
