# Sprint 05 Plan -- Observability Workbench

> **Sprint**: 05
> **Duration**: 2 weeks (2026-04-07 to 2026-04-20)
> **Product**: Observability Workbench v0.4.0
> **Repository**: github.com/tenfingerseddy/FabricWorkloads
> **Status**: Planning
> **Budget**: 80 hours of agent work

---

## Progress Tracker (Initialized Apr 7)

| Task | Status | Notes |
|------|--------|-------|
| A1: Landing page update | NOT STARTED | Carried from S04-E1 |
| B1: Community infrastructure (Discussions + Discord) | NOT STARTED | |
| C1: Lakehouse cold archive notebook | NOT STARTED | |
| D1: Teams webhook alert delivery | NOT STARTED | |
| E1: Saved searches for Event Search | NOT STARTED | |
| F1: Show HN post | NOT STARTED | Carried from S04-D3 |
| F2: Blogs 03-04 + social content | NOT STARTED | Carried from S04-G1, S04-G2 |
| G1: NuGet packaging (Extensibility Toolkit Phase 3) | NOT STARTED | |
| G2: CI/CD for workload package (Phase 4) | NOT STARTED | |
| H1: Design partner onboarding guide | NOT STARTED | |
| I1: Release Orchestrator market research | NOT STARTED | |
| J1: DevGateway completion (conditional) | NOT STARTED | Only if S04-A1 incomplete |

---

## Sprint Goal

**Harden the product for design partner use, build community infrastructure, begin Lakehouse archiving, and start research on the second product (Release Orchestrator).**

Sprint 05 transitions the business from "demo-ready prototype" to "design-partner-ready product." Sprint 04 delivered the demo: incident timeline, event search, DevGateway integration (partial), initial content publishing, and security hardening. Now we need to make the product reliable enough that a design partner can run it against their workspace for two weeks without hand-holding. That means: cold archive so Eventhouse does not bloat, saved searches so users can build workflows, Teams notifications so alerts reach people where they work, and community infrastructure so design partners have a place to ask questions. In parallel, we begin preliminary research on Release Orchestrator to keep the product roadmap moving.

Sprint 04 taught us two lessons: (1) integration work takes longer than estimated -- DevGateway and blog publishing both slipped; (2) P2 items rarely get touched. This sprint is planned more conservatively as a result, with 30% buffer and only 2 P2 tasks.

Every task is judged by one question: does this make a design partner say "I want to keep using this"?

---

## Sprint 04 Exit State (What We Have)

| Component | State | Notes |
|-----------|-------|-------|
| CLI Tool | Working | Auth, collector, KQL ingestion, dashboard, alerts, scheduler, waste score |
| Tests | 243 passing (8 files) | Unit + KQL integration tests via Vitest; CI green |
| KQL Tables | 6 tables | FabricEvents, SloSnapshots, AlertRules, EventCorrelations, SloDefinitions, WorkspaceInventory |
| Fabric Notebooks | 3 running | NB_ObsIngestion (5min), NB_ObsCorrelation (15min), NB_ObsAlerts (15min) -- all on schedule |
| Incident Timeline | Built | IncidentTimeline.tsx + TimelineNode.tsx + SCSS. Wired into dashboard. |
| Event Search | Built | EventSearch.tsx + SCSS. Wired into dashboard with toolbar search button. |
| Security | Hardened | escapeKql backtick/control char sanitization, errors.ts with typed errors and sanitized responses, hardcoded URLs replaced with env vars, stack traces redacted in production |
| DevGateway | In Progress | S04-A1 was in progress. Node v20 pinned. Exact completion status TBD at sprint start. |
| Content | Blogs 01-02 published (or publishing) | D1 in progress at S04 end. Design partner outreach materials created. |
| Community | Zero infrastructure | No Discord, no GitHub Discussions, no newsletter |
| Landing Page | Stale | S04-E1 not started. Static HTML from Sprint 01, no screenshots, no signup form. |
| Extensibility Toolkit | Phase 1-2 complete, Phase 5 partial | Manifest files, devServer directory, DevGateway tested. NuGet packaging and CI/CD remain. |

### What Completed in Sprint 04

- B1: Incident Timeline component (IncidentTimeline.tsx, TimelineNode.tsx, SCSS, wired to dashboard)
- C1: Event Search component (EventSearch.tsx, SCSS, wired to dashboard with toolbar)
- F1: KQL integration tests (18 tests in kql-client.test.ts, total 243 tests)
- F2: Node v20 pinned for local builds
- H3: Hardcoded Eventhouse URLs replaced with env vars
- H7: Stack traces sanitized (errors.ts utility)
- escapeKql hardening: backtick, `<|` marker, control char sanitization
- Blog fixes and design partner outreach materials

### What Carries Forward from Sprint 04

- A1 (DevGateway): In progress, not confirmed complete
- D1 (Blog publishing): In progress, blogs 01-02 being published
- D3 (Show HN): Not started, blocked on D1/D2
- E1 (Landing page): Not started
- G1-G2 (Content pipeline): Not started
- D2 (README polish): Partial, needs screenshots

### Known Issues Entering Sprint 05

| # | Issue | Impact | Root Cause |
|---|-------|--------|------------|
| 1 | DevGateway may not be fully end-to-end | Cannot demo inside Fabric portal if S04-A1 did not complete | Integration work took longer than estimated |
| 2 | Landing page is stale | No visual assets, no signup form, poor first impression for inbound traffic | S04-E1 never started, blocked on screenshots |
| 3 | No cold archive | Eventhouse will grow unbounded; cost risk for design partners | Deferred since Sprint 03 |
| 4 | No Teams notifications | Alerts only exist in KQL tables; design partners need alerts where they work | Scaffolded in NB_ObsAlerts but no webhook configured |
| 5 | Show HN not posted | Missed Sprint 04 content launch window | Blocked on blog publishing and README polish |
| 6 | Content pipeline stalled | Blogs 03-06 unpublished; social posts not flowing | G1/G2 not started in Sprint 04 |
| 7 | No community infrastructure | Design partners have no channel for questions/feedback | Deferred from Sprint 04 |
| 8 | No saved searches | Power users cannot save and reuse search queries | Product spec F6 secondary feature, not yet built |

---

## Definition of "Design-Partner-Ready"

A design partner onboarding is successful when we can:

1. **Send them a getting-started guide** -- install, configure, first data in under 10 minutes
2. **They see real data from their workspace** -- SLO dashboard populated within one ingestion cycle (5 min)
3. **They receive a Teams alert** -- a test alert fires and arrives in their Teams channel
4. **They can search historical events** -- event search works with filters, and they can save a useful query
5. **Eventhouse stays healthy** -- cold archive prevents unbounded growth, Eventhouse size stays predictable
6. **They can ask questions** -- GitHub Discussions or Discord available with response SLA under 24 hours
7. **The landing page sells the product** -- when they share the link internally, colleagues understand what it does

The partner should feel: "This is a real tool that I can rely on, built by people who respond quickly."

---

## Task Breakdown

### Theme A: Landing Page and Signup (P0 -- Carried Forward)

Inbound traffic from published blog posts lands on a stale page with no screenshots, no signup form, and no credibility signals. This is the single highest-impact marketing fix. Every blog post and outreach email links here.

---

#### A1: Update landing page with demo section and early access signup

**Priority**: P0
**Effort**: 5 hours
**Assignee**: Frontend
**Dependencies**: None (use incident timeline and event search screenshots from Sprint 04; use CLI screenshots as fallback if DevGateway screenshots unavailable)
**ID**: S05-A1
**Carried from**: S04-E1

**Description**: The landing page at `landing-page/index.html` is static HTML from Sprint 01. It has no screenshots, no signup form, and no updated feature list. Every blog post and social post links here. This is the storefront for the product.

Update to include:
1. "See It In Action" section with 3-4 screenshots: CLI dashboard output, incident timeline (from S04-B1), event search (from S04-C1), SLO card grid. Use actual product screenshots, not mockups.
2. Updated feature list: cross-item correlation, incident timeline, event search, SLO tracking, CU waste score, long-retention event store (90-day hot + 365-day cold archive).
3. Early access signup form -- embed Tally.so or Google Forms. Collect: email, company name, number of Fabric workspaces, biggest monitoring pain point (dropdown: retention limits, no correlation, no SLOs, alert fatigue, other).
4. Social proof section: link to published blog posts on dev.to, GitHub star count badge, test count badge (243), MIT license badge, "actively maintained" badge.
5. "Built for Fabric" section: zero egress, permission-inherited, Fabric-native, runs inside the portal, respects workspace roles.
6. Link to existing `pricing.html`.
7. Mobile-responsive layout (test at 375px and 768px).

**Files to modify**:
- `landing-page/index.html`

**Files to create**:
- Screenshot image files in `landing-page/images/` or `docs/images/`

**Acceptance Criteria**:
- [ ] Landing page loads without errors
- [ ] "See It In Action" section has at least 3 visual assets (screenshots or GIFs)
- [ ] Early access form is functional and collects submissions
- [ ] Feature list includes incident timeline, event search, cross-item correlation, CU waste score
- [ ] Page is mobile-responsive (test at 375px and 768px)
- [ ] Load time under 3 seconds
- [ ] Social proof section has at least 2 badges and links to live blog posts
- [ ] Images use approved sources only (Unsplash, picsum.photos) for any stock imagery -- NO Pexels (403 errors)

---

### Theme B: Community Infrastructure (P0 -- Required for Design Partners)

Design partners need a place to ask questions, report issues, and provide feedback. Without this, every question becomes a direct email that does not scale. The growth playbook (Weeks 5-6) calls for community infrastructure.

---

#### B1: Set up GitHub Discussions, Discord, and issue templates

**Priority**: P0
**Effort**: 3 hours
**Assignee**: DevOps / Content
**Dependencies**: None
**ID**: S05-B1

**Description**: GitHub Discussions is lower-friction than Discord for a developer audience already on GitHub. Set up Discussions as the primary community channel and Discord as a secondary real-time channel.

Tasks:
1. Enable GitHub Discussions on the tenfingerseddy/FabricWorkloads repository.
2. Create discussion categories: Announcements, Q&A, Ideas, Show Your Setup.
3. Write and pin a welcome Announcement post: what the project is, how to get started, where to report bugs vs. ask questions vs. request features.
4. Create issue templates:
   - **Bug Report**: reproduction steps, environment details (Node version, OS, Fabric capacity SKU), expected vs. actual behavior, error logs.
   - **Feature Request**: use case description, proposed solution, priority justification.
5. Create a SECURITY.md with responsible disclosure process (required by growth playbook).
6. Set up a Discord server with channels: #general, #help, #feature-requests, #show-your-setup, #design-partners (restricted). Keep it low-maintenance initially.
7. Add a "Community" section to the README with links to Discussions, Discord invite, and issue templates.
8. Pin 3-5 "good first issue" labels on existing or newly created GitHub issues (growth playbook contributor flywheel).

**Files to create**:
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `SECURITY.md`

**Files to modify**:
- `README.md` (add Community section)

**Acceptance Criteria**:
- [ ] GitHub Discussions enabled with at least 3 categories
- [ ] Welcome announcement posted and pinned
- [ ] Bug Report and Feature Request issue templates created and functional
- [ ] SECURITY.md exists in repo root with disclosure process
- [ ] README links to Discussions and Discord
- [ ] Discord server created with 4+ channels and invite link working
- [ ] At least 3 issues labeled "good first issue"

---

### Theme C: Lakehouse Cold Archive (P0 -- Data Sustainability)

Without cold archiving, Eventhouse grows indefinitely. For a design partner running ingestion every 5 minutes across multiple workspaces, this becomes a cost problem within weeks. The product spec (Feature F1) specifies 90-day hot / 365-day cold. This has been deferred since Sprint 03 and is now blocking design partner readiness.

---

#### C1: Implement Lakehouse cold archive notebook

**Priority**: P0
**Effort**: 8 hours
**Assignee**: Backend
**Dependencies**: None (LH_ObsArchive Lakehouse already exists at item ID 89359a4a in ObservabilityWorkbench-Dev workspace)
**ID**: S05-C1

**Description**: Build the daily archive job that moves aged data from EH_Observability Eventhouse to LH_ObsArchive Lakehouse. This implements the `Archive` job type from the product spec.

The archive process:
1. Query FabricEvents for records older than 90 days (configurable via a `RETENTION_DAYS` variable, default 90).
2. Export those records to Parquet format using PySpark.
3. Write Parquet files to the LH_ObsArchive Lakehouse at path `Tables/FabricEvents_Archive/year=YYYY/month=MM/`.
4. After successful write confirmation, delete the archived records from Eventhouse using `.delete` management command with a time filter.
5. Log the archive operation: records moved, time range, file size, success/failure.
6. Repeat for SloSnapshots (archive records older than 90 days).
7. AlertLog and EventCorrelations: archive records older than 180 days (longer retention for audit trail).
8. Handle edge cases: no records to archive (log and exit cleanly), partial failure (log which tables succeeded/failed), Lakehouse write timeout.

Implementation approach:
- New notebook `NB_ObsArchive` using PySpark.
- Read from Eventhouse via the Kusto Spark connector or KQL REST API.
- Write to Lakehouse via the OneLake file path (standard PySpark write to Delta/Parquet).
- Schedule: daily at 02:00 UTC via Fabric pipeline schedule.

**Files to create**:
- `notebooks/NB_ObsArchive.py` (new notebook)

**Files to modify**:
- `scripts/deploy-to-fabric.sh` (add NB_ObsArchive deployment)
- `scripts/upload-notebooks.mjs` (add NB_ObsArchive to upload list)
- `products/observability-workbench/docs/getting-started.md` (document archive configuration)

**Acceptance Criteria**:
- [ ] Notebook reads FabricEvents records older than configurable retention threshold from Eventhouse
- [ ] Records are written to LH_ObsArchive as Parquet files with year/month partitioning
- [ ] After successful write, archived records are deleted from Eventhouse
- [ ] Archive notebook logs: record count, time range covered, file sizes, execution duration
- [ ] SloSnapshots older than 90 days are also archived
- [ ] Notebook handles "no records to archive" gracefully (log and exit, no errors)
- [ ] Retention threshold is configurable (default 90 days for events/snapshots, 180 days for alerts/correlations)
- [ ] Notebook deploys via existing upload scripts
- [ ] Manual test: run notebook against live Eventhouse, verify records appear in Lakehouse, verify they are removed from Eventhouse
- [ ] Notebook validation (`npm run validate:notebooks`) passes with 0 errors

---

### Theme D: Teams Webhook Notifications (P1 -- Design Partner Essential)

Design partners need alerts in Teams, not just in a KQL table. This is the most commonly requested integration for enterprise Fabric users. The NB_ObsAlerts notebook has scaffolded webhook code that needs completion.

---

#### D1: Implement Teams webhook alert delivery

**Priority**: P1
**Effort**: 5 hours
**Assignee**: Backend
**Dependencies**: None (NB_ObsAlerts scaffolding exists)
**ID**: S05-D1

**Description**: Complete the Teams webhook integration in NB_ObsAlerts. When an alert fires (SLO breach, trend degradation, error spike), send an Adaptive Card to a configured Teams channel.

Tasks:
1. Add webhook URL configuration to the alert system. Option A: add a `WebhookUrl` column to the AlertRules table so each rule can target a different channel. Option B: add a workspace-level `WebhookConfig` table with a single webhook URL per workspace. Choose the simpler option (B) for MVP.
2. In NB_ObsAlerts, after alert evaluation and AlertLog ingestion, check if a webhook URL is configured.
3. Format the alert as a Microsoft Teams Adaptive Card:
   - Title: `[SEVERITY] Alert: [ItemName] - [MetricType]`
   - Body: metric type, current value, target value, breach status, timestamp
   - Color coding: red for breach, yellow for warning
   - Action button: "View Item in Fabric" (deep link to the item in Fabric portal using workspace ID + item ID)
4. POST the Adaptive Card JSON to the webhook URL using Python `requests` library.
5. Handle failures gracefully: log webhook delivery failures to AlertLog but do not block alert processing or raise exceptions.
6. Implement cooldown logic: do not send the same alert (same rule + same item) more than once per 30 minutes. Track last notification time in AlertLog or a new `NotificationLog` KQL table.
7. Write documentation for design partners on how to create an incoming webhook in their Teams channel.

**Files to modify**:
- `notebooks/NB_ObsAlerts.py` (add webhook delivery cells after alert evaluation)

**Files to create**:
- `products/observability-workbench/docs/teams-webhook-setup.md` (step-by-step guide)

**Acceptance Criteria**:
- [ ] Alert fires and Adaptive Card appears in a configured Teams channel within 5 minutes of SLO breach
- [ ] Card shows: alert severity, item name, metric type, current value vs. target, timestamp
- [ ] Card includes at least one action button (link to Fabric portal)
- [ ] Cooldown prevents duplicate notifications for the same alert within 30 minutes
- [ ] Webhook delivery failure does not block alert processing (logged, not raised)
- [ ] Setup guide documents how to create a Teams incoming webhook (or Workflows connector)
- [ ] Notebook validation passes after changes

---

### Theme E: Saved Searches (P1 -- Power User Feature)

Event search was built in Sprint 04 (S04-C1). Power users need to save frequently-used searches and share them with teammates. This is product spec Feature F6 secondary scope and directly improves design partner experience.

---

#### E1: Implement saved searches for Event Search

**Priority**: P1
**Effort**: 5 hours
**Assignee**: Frontend
**Dependencies**: Event Search component from Sprint 04 (S04-C1) must be working
**ID**: S05-E1

**Description**: Add the ability to save, load, and share search configurations in the Event Search component.

Implementation:
1. Add a `SavedSearches` KQL table: SearchId (guid), SearchName (string), Filters (dynamic -- stores the full filter object as JSON), CreatedBy (string), CreatedAt (datetime), IsShared (bool).
2. Add KQL management commands to create the table (add to notebook or standalone script).
3. In the Event Search UI, add a "Save Search" button next to the search bar that captures the current filter state (search text, item type filters, status filters, time range) as a JSON object.
4. Add a "Saved Searches" dropdown or sidebar panel that lists the user's saved searches plus shared searches.
5. Clicking a saved search loads its filters into the search form and re-executes the query.
6. Add a "Share" toggle on each saved search to make it visible to other workspace users.
7. Add a "Delete" action for saved searches owned by the current user.
8. Add CRUD functions to `kqlQueryService.ts`: `getSavedSearches()`, `createSavedSearch()`, `updateSavedSearch()`, `deleteSavedSearch()`.

**Files to modify**:
- `workload/app/items/WorkbenchDashboard/EventSearch.tsx` (add save/load UI elements)
- `workload/app/items/WorkbenchDashboard/EventSearch.scss` (styling for saved searches panel)
- `workload/app/services/kqlQueryService.ts` (add SavedSearches CRUD functions)

**Files to create**:
- KQL table creation command in `kql/` directory or as a cell in NB_ObsIngestion

**Acceptance Criteria**:
- [ ] User can save the current search configuration with a custom name
- [ ] Saved searches appear in a list/dropdown in the Event Search UI
- [ ] Loading a saved search populates all filters and executes the query
- [ ] Shared searches are visible to other users querying the same Eventhouse
- [ ] User can delete their own saved searches
- [ ] Empty state shown when no saved searches exist ("No saved searches yet. Save your first search above.")
- [ ] Saving a search with a duplicate name prompts for overwrite confirmation

---

### Theme F: Content and Open-Source Launch (P1 -- Carried Forward)

Sprint 04 started content publishing but did not complete the full launch sequence. The Show HN post, blogs 03-04, and ongoing social content all carry forward. Content is the pipeline to design partners -- without visibility, there are no inbound conversations.

---

#### F1: Publish Show HN post

**Priority**: P1
**Effort**: 2 hours
**Assignee**: Content
**Dependencies**: A1 (landing page should be updated first), B1 (community infrastructure should exist for inbound questions)
**ID**: S05-F1
**Carried from**: S04-D3

**Description**: Execute the Show HN launch from `business/content/launch-post-hackernews.md`. By Sprint 05, blogs 01-02 should be live on dev.to, the README should be presentable, and the landing page should be updated (A1). This is the right time to launch on HN.

Target: Tuesday or Wednesday of Sprint 05 Week 1 (April 7 or 8), 10:00-11:00 AM US Eastern (peak HN traffic window per growth playbook).

Tasks:
1. Review and finalize the HN post text. Update any metrics: test count (243), event count, feature list (now includes incident timeline and event search).
2. Prepare FAQ responses for predictable questions: Why not just use Purview? Why TypeScript? How does this compare to Monte Carlo? What about Fabric's native monitoring improvements?
3. Post at optimal time.
4. Monitor and respond to every comment within 2 hours for the first 6 hours.
5. Track: karma score, GitHub star delta, npm install delta, landing page traffic spike, signup form submissions.

**Files to reference**:
- `business/content/launch-post-hackernews.md`

**Acceptance Criteria**:
- [ ] Show HN post published at optimal time
- [ ] Every comment receives a substantive response within 4 hours
- [ ] Post reaches at least 10 upvotes (minimum viable visibility)
- [ ] GitHub star count tracked before and after post (delta measured)
- [ ] Landing page traffic spike measured via analytics or server logs

---

#### F2: Publish blogs 03-04 and social content weeks 02-04

**Priority**: P1
**Effort**: 4 hours
**Assignee**: Content
**Dependencies**: None
**ID**: S05-F2
**Carried from**: S04-G1, S04-G2

**Description**: Continue the content cadence that stalled in Sprint 04. Publish blogs 03 ("Hidden Cost of Bad Data in Fabric") and 04 ("FabCon Observability Gap") on dev.to. Post the pre-written social content from weeks 02-04.

Content spacing: one blog post per week. Social cadence: 2 LinkedIn posts per week, 1 Reddit post per week (per growth playbook).

Tasks:
1. Review `blog-03-devto.md` and `blog-04-devto.md` for accuracy against current product state (test count 243, features now include incident timeline and event search, KQL integration tests).
2. Update any outdated references, fix links, ensure GitHub repo URL is correct.
3. Publish Blog 03 in Sprint 05 Week 1.
4. Publish Blog 04 in Sprint 05 Week 2 (at least 5 days after Blog 03).
5. Post LinkedIn content from `week-02-social-posts.md`, `week-02-linkedin-thought-leadership.md`, and `week-03-fabcon-social-posts.md`.
6. Post Reddit threads in r/MicrosoftFabric and r/dataengineering from pre-written content.
7. Track engagement metrics for all published content at sprint end.

**Files to review/update**:
- `business/market-research/blog-03-devto.md`
- `business/market-research/blog-04-devto.md`
- `business/content/week-02-social-posts.md`
- `business/content/week-02-linkedin-thought-leadership.md`
- `business/content/week-03-fabcon-social-posts.md`

**Acceptance Criteria**:
- [ ] Blog 03 published on dev.to with correct tags (microsoft-fabric, dataengineering, observability, opensource)
- [ ] Blog 04 published on dev.to at least 5 days after Blog 03
- [ ] 4+ LinkedIn posts published across 2 weeks
- [ ] 2+ Reddit posts published (r/MicrosoftFabric and/or r/dataengineering)
- [ ] All posts link to GitHub repo and landing page
- [ ] Engagement metrics tracked at sprint end: view count, reactions, comments, LinkedIn impressions

---

### Theme G: Extensibility Toolkit Phases 3-4 (P1 / P2 -- Platform Maturity)

Phases 1-2 (manifest files, devServer directory) were completed in Sprint 03. Phase 5 (DevGateway end-to-end) was partially completed in Sprint 04. Phases 3-4 cover NuGet packaging and CI/CD integration, which are prerequisites for Phases 6-7 (Azure deployment, production hosting) in future sprints.

---

#### G1: Extensibility Toolkit Phase 3 -- NuGet packaging

**Priority**: P1
**Effort**: 4 hours
**Assignee**: DevOps
**Dependencies**: None (nuspec file and manifest files already exist from Sprint 03)
**ID**: S05-G1

**Description**: Produce a distributable workload package following the Extensibility Toolkit's NuGet packaging pattern. The migration analysis document (`products/observability-workbench/docs/extensibility-toolkit-migration.md`) identified this as a ~4 hour task with low risk.

Tasks:
1. Validate the existing `.nuspec` file against the Extensibility Toolkit's expected schema (compare with `fabric-extensibility-toolkit/Workload/` sample).
2. Ensure `npm run build` output (webpack bundle) is correctly referenced in the NuGet package layout.
3. Add manifest files (Product.json, item type JSONs/XMLs) to the NuGet package.
4. Create a `scripts/package-workload.sh` script that:
   - Runs `npm run build` (produces webpack bundle)
   - Copies build output + manifests to a staging directory matching the toolkit's NuGet layout
   - Runs `nuget pack` or `dotnet pack` to produce a `.nupkg` file
5. Add an `npm run package` script to `package.json` that invokes the packaging script.
6. Test: extract the `.nupkg` and verify the directory structure matches what DevGateway expects.

**Files to create**:
- `scripts/package-workload.sh`

**Files to modify**:
- `.nuspec` file (if corrections needed based on toolkit comparison)
- `package.json` (add `"package"` script)

**Acceptance Criteria**:
- [ ] `npm run package` produces a `.nupkg` file without errors
- [ ] NuGet package contains: webpack bundle, all manifest files, icon assets
- [ ] Package can be extracted and directory structure matches Extensibility Toolkit expectations
- [ ] Package version is derived from `package.json` version
- [ ] Script is documented in getting-started guide or a new packaging doc

---

#### G2: Extensibility Toolkit Phase 4 -- CI/CD integration for workload package

**Priority**: P2
**Effort**: 4 hours
**Assignee**: DevOps
**Dependencies**: G1 (NuGet packaging must work first)
**ID**: S05-G2

**Description**: Extend the existing GitHub Actions CI pipeline to automatically build and archive the workload NuGet package.

Tasks:
1. Add a `package` job to `.github/workflows/ci.yml` that runs after the existing test job passes.
2. The package job should:
   - Check out code and install dependencies
   - Run `npm run build`
   - Run `npm run package` (from G1)
   - Upload the `.nupkg` as a GitHub Actions artifact (retained for 30 days)
3. In `.github/workflows/release.yml`, add a step to attach the `.nupkg` to GitHub Release assets when a tag is pushed.
4. Add a badge to README: "Latest Release" linking to the latest GitHub Release (which now includes the workload package).

**Files to modify**:
- `.github/workflows/ci.yml` (add package job)
- `.github/workflows/release.yml` (add nupkg to release assets)
- `README.md` (add release/package badge)

**Acceptance Criteria**:
- [ ] CI pipeline builds NuGet package on every push to main (after tests pass)
- [ ] Package is uploaded as a GitHub Actions artifact on every CI run
- [ ] Release workflow attaches `.nupkg` to GitHub Releases on tag push
- [ ] Existing test and typecheck jobs are not affected (no regressions)
- [ ] Full pipeline (test + package) completes in under 5 minutes

---

### Theme H: Design Partner Onboarding (P1 -- Revenue Path)

By Sprint 05, design partner outreach materials from Sprint 04 should have generated initial conversations. This theme ensures we can onboard partners smoothly with a comprehensive self-service guide.

---

#### H1: Create design partner onboarding guide

**Priority**: P1
**Effort**: 3 hours
**Assignee**: Content / Backend
**Dependencies**: D1 (Teams webhook guide), B1 (community channels exist)
**ID**: S05-H1

**Description**: Write a comprehensive onboarding document for design partners. This is the "Day 1" guide they receive after agreeing to participate in the 4-week evaluation.

The guide should cover:
1. **Day 1 Checklist**: Quick-reference box at the top with the 5 steps to get running.
2. **Prerequisites**: Fabric capacity (F64+ recommended, F2 minimum for testing), workspace with at least 3 scheduled items (pipelines, notebooks, dataflows), Node.js v20 installed.
3. **Installation**: `npm install @kane-ai/observability-workbench`, credential configuration (service principal setup, environment variables).
4. **First data collection**: Run the collector once (`npm start`), verify data appears in Eventhouse within 5 minutes.
5. **Workload dashboard** (if DevGateway works): How to register the workload in their tenant, navigate to the dashboard, create a WorkbenchDashboard item.
6. **CLI fallback**: If DevGateway is not available in their environment, how to use the CLI dashboard for the same data.
7. **Teams alerts setup**: Link to the Teams webhook setup guide (from D1), walk through creating their first alert rule.
8. **SLO configuration**: How to define their first SLO, what metric types are available, recommended starting thresholds.
9. **Getting help**: GitHub Discussions for questions, Discord for real-time chat, GitHub Issues for bugs, direct email for urgent blockers.
10. **What we need from them**: 15-minute weekly check-in (async is fine -- a Loom video or written update), report bugs via GitHub Issues, share what is valuable and what is not, permission to use anonymized quotes as testimonials.
11. **Timeline**: 4-week evaluation period, then conversation about Professional tier transition (3-month 50% discount for design partners per growth playbook).

**Files to create**:
- `products/observability-workbench/docs/design-partner-onboarding.md`

**Acceptance Criteria**:
- [ ] Guide covers all 11 sections listed above
- [ ] A new user following the guide can go from zero to seeing data in under 15 minutes
- [ ] Day 1 Checklist at the top is scannable (5-7 items, each one sentence)
- [ ] Links to Teams webhook setup guide, community channels, and getting-started guide all work
- [ ] Includes expected timelines: "5 min to install, 5 min for first data, 15 min for SLO + alert"
- [ ] Reviewed for accuracy against current product state and installation flow

---

### Theme I: Release Orchestrator Preliminary Research (P2 -- Next Product)

The business plan sequences Release Orchestrator as Product 2 (Q2 follow-up). Starting research now means we have a spec outline ready by the time Observability Workbench enters private beta, giving a 2-month head start on the second revenue stream.

---

#### I1: Release Orchestrator market research and preliminary spec outline

**Priority**: P2
**Effort**: 6 hours
**Assignee**: Fabric GTM Strategist / Fabric Workload Architect
**Dependencies**: None (research task, no code dependencies)
**ID**: S05-I1

**Description**: Conduct preliminary research on the Release Orchestrator product concept. Per the business plan: "dependency-aware, test-gated deployments for Microsoft Fabric." Target persona: BI developers and release managers.

Research deliverables:
1. **Pain point validation**: Search Fabric Community forums, Reddit (r/MicrosoftFabric, r/PowerBI), Stack Overflow, and Microsoft Q&A for deployment-related pain points. Document the top 5 pain points with evidence: direct quotes, thread URLs, vote counts, frequency of complaints.
2. **Competitive landscape**: What deployment tools exist for Fabric today?
   - Fabric native: Git integration, deployment pipelines, Fabric REST APIs
   - External: Azure DevOps pipelines, GitHub Actions, Octopus Deploy, custom PowerShell scripts
   - For each: strengths, weaknesses, what they cannot do for Fabric specifically
3. **Fabric deployment capabilities and gaps**: What does Fabric's native Git integration and deployment pipelines offer today? What does it lack? Key gaps to investigate: dependency ordering, test gates, rollback, multi-workspace promotion, environment parameterization, approval workflows, cross-item impact analysis.
4. **Target persona refinement**: Who is the primary buyer? BI developer doing releases? DevOps/platform engineer managing the Fabric estate? Analytics engineering lead? Validate against community discussion patterns.
5. **Preliminary feature list**: Based on pain points and competitive gaps, draft a prioritized feature list for Release Orchestrator MVP. At least 8 features with P0/P1/P2 ranking.
6. **Spec outline**: Write a 1-2 page spec outline (NOT a full product spec) with: problem statement, target users, 5-6 core capabilities, architecture sketch (how it would work as a Fabric workload), estimated MVP scope, and key risks.
7. **Synergy analysis**: How does Release Orchestrator integrate with Observability Workbench? (e.g., post-deployment SLO monitoring, rollback triggers based on SLO breach, deployment impact on correlation chains).

**Files to create**:
- `products/release-orchestrator/docs/market-research.md` (pain points, competitive landscape, personas)
- `products/release-orchestrator/specs/product-spec-outline.md` (preliminary spec outline)

**Acceptance Criteria**:
- [ ] Top 5 deployment pain points documented with community evidence (quotes + links)
- [ ] 3+ existing tools analyzed with strengths, weaknesses, and Fabric-specific gaps
- [ ] Fabric native deployment capabilities and gaps documented
- [ ] Target persona identified with primary use case and buying trigger
- [ ] Preliminary feature list with P0/P1/P2 priority for at least 8 features
- [ ] Spec outline written: problem statement, users, capabilities, architecture sketch, MVP scope
- [ ] Synergy with Observability Workbench documented
- [ ] Research clearly distinguishes validated pain points (community evidence) from assumptions (our hypotheses)

---

### Theme J: DevGateway Completion (Conditional P0)

This task only applies if Sprint 04 A1 did not fully complete. Check status at sprint start. If DevGateway is working end-to-end, skip this task and reclaim 6 hours for buffer.

---

#### J1: Complete DevGateway end-to-end integration (conditional)

**Priority**: P0 (if Sprint 04 A1 incomplete) / SKIP (if S04-A1 is done)
**Effort**: 6 hours (reserved)
**Assignee**: Backend / DevOps
**Dependencies**: None
**ID**: S05-J1
**Carried from**: S04-A1 (if incomplete)

**Description**: Complete the DevGateway integration that was in progress at Sprint 04 end. Full task description in S04-A1.

Remaining work (assess at sprint start):
1. Pin local Node to v20 (if not already done via .nvmrc or volta) -- DONE in S04-F2.
2. Run `scripts/Setup/DownloadDevGateway.ps1` to get the DevGateway binary.
3. Enable Fabric Developer Mode in the tenant admin settings.
4. Run `npm run build`, then `scripts/Run/StartDevServer.ps1`, then `scripts/Run/StartDevGateway.ps1`.
5. Register with Fabric, verify all 3 item types appear in the "New" menu.
6. Create one item of each type and verify the editor loads in the iframe.
7. Document troubleshooting steps in getting-started guide.

**Acceptance Criteria**:
- [ ] `npm run build` succeeds locally with Node v20
- [ ] DevGateway registers with Fabric tenant (no errors in console)
- [ ] All 3 item types appear in workspace "New" dropdown
- [ ] WorkbenchDashboard editor loads in Fabric iframe without blank screen
- [ ] AlertRule and SLODefinition editors load
- [ ] Getting-started docs updated with DevGateway setup and troubleshooting

---

## Sprint Capacity and Schedule

### Effort Summary by Theme

| Theme | Tasks | Total Hours | Priority |
|-------|-------|-------------|----------|
| A: Landing Page | A1 | 5h | P0 |
| B: Community Infrastructure | B1 | 3h | P0 |
| C: Lakehouse Cold Archive | C1 | 8h | P0 |
| D: Teams Webhook | D1 | 5h | P1 |
| E: Saved Searches | E1 | 5h | P1 |
| F: Content & Launch | F1, F2 | 6h | P1 |
| G: Extensibility Toolkit | G1, G2 | 8h | P1 + P2 |
| H: Design Partner Onboarding | H1 | 3h | P1 |
| I: Release Orchestrator Research | I1 | 6h | P2 |
| J: DevGateway (conditional) | J1 | 0-6h | P0 if needed |
| **Total (J1 not needed)** | **10 tasks** | **49h** | |
| **Total (J1 needed)** | **11 tasks** | **55h** | |
| **Buffer (30%)** | | **14.7-16.5h** | |
| **Total with buffer (J1 not needed)** | | **63.7h** | |
| **Total with buffer (J1 needed)** | | **71.5h** | |

Sprint 04 lesson applied: planned at 64-72h against 80h budget. The remaining 8-16h is reserved for:
- Design partner conversations and ad-hoc support (first partners should be responding to outreach)
- Bug fixes from Sprint 04 features (incident timeline, event search may have issues under real use)
- Responding to community feedback from published blog posts and HN launch
- Unplanned work from early design partner evaluations

### Effort Summary by Priority

| Priority | Tasks | Hours | Mandate |
|----------|-------|-------|---------|
| P0 (must ship) | A1, B1, C1, J1 (conditional) | 16-22h | Sprint fails without these |
| P1 (should ship) | D1, E1, F1, F2, G1, H1 | 25h | High value, drop if blocked |
| P2 (stretch) | G2, I1 | 10h | Carry to Sprint 06 if needed |

### Effort Summary by Assignee Category

| Category | Tasks | Hours |
|----------|-------|-------|
| Frontend | A1, E1 | 10h |
| Backend | C1, D1 | 13h |
| DevOps | B1 (partial), G1, G2, J1 (conditional) | 11-17h |
| Content | B1 (partial), F1, F2, H1 | 12h |
| Fabric Specialist | I1 | 6h |

---

## Dependency Graph

```
J1 (DevGateway -- conditional, assess Day 1)
  |
  v
A1 (Landing page -- uses DevGateway screenshots if available)

B1 (Community infrastructure)
  |
  +-----> H1 (Design partner onboarding guide)
  |                |
  +-----> F1 (Show HN -- needs community + landing page ready)
           |
           +-- also depends on A1

D1 (Teams webhook) -----> H1 (onboarding guide references Teams setup)

C1 (Lakehouse cold archive) ---------> [independent -- start Day 1]

E1 (Saved searches) -----------------> [independent -- depends on S04-C1 existing]

F2 (Blogs 03-04 + social) -----------> [independent -- start Day 1]

G1 (NuGet packaging)
  |
  v
G2 (CI/CD for package)

I1 (Release Orchestrator research) --> [independent -- start anytime]
```

### Critical Path

There are three parallel critical paths this sprint:

```
Path 1 (Design Partner Readiness -- PRIMARY):
  C1 (archive, 8h) + D1 (Teams, 5h) + B1 (community, 3h) --> H1 (onboarding guide, 3h)
  Total: 19h sequential if all on one person, but C1/D1/B1 are parallelizable across agents.

Path 2 (Content Launch):
  A1 (landing page, 5h) + B1 (community, 3h) --> F1 (Show HN, 2h)
  F2 (blogs + social, 4h) runs in parallel

Path 3 (Platform Maturity):
  G1 (NuGet, 4h) --> G2 (CI/CD, 4h)
```

Path 1 is the primary critical path because the sprint goal is design partner readiness. If any P0 task on Path 1 slips, the sprint goal is at risk. Paths 2 and 3 are valuable but not sprint-defining.

### Recommended Execution Order (Week 1: April 7-11)

| Day | Backend | Frontend | DevOps | Content |
|-----|---------|----------|--------|---------|
| Mon | C1 start (archive notebook skeleton + Eventhouse query logic) | J1 assessment; if done, A1 start (landing page) | B1 (GitHub Discussions + Discord + issue templates) | F2 (review blog-03, update metrics/references) |
| Tue | C1 continue (PySpark write to Lakehouse, test with small batch) | A1 continue (screenshots, signup form, feature list) | G1 start (NuGet packaging) | F2 (publish Blog 03 on dev.to, LinkedIn posts) |
| Wed | C1 continue (delete logic, SloSnapshots archive, edge cases) | A1 completion, push to main | G1 continue | F1 prep (finalize HN post text, prepare FAQ responses) |
| Thu | D1 start (Teams Adaptive Card format, webhook POST logic) | E1 start (SavedSearches table, CRUD in kqlQueryService) | G1 completion | F1 (post Show HN -- Thursday 10am ET) |
| Fri | D1 continue (cooldown logic, error handling) | E1 continue (UI: save button, load dropdown, share toggle) | Buffer / B1 follow-up (pin good first issues) | F1 monitoring (respond to every HN comment within 2h) |

### Recommended Execution Order (Week 2: April 14-18)

| Day | Backend | Frontend | DevOps | Content |
|-----|---------|----------|--------|---------|
| Mon | D1 completion (test with real Teams channel, verify cooldown) | E1 continue (delete, overwrite confirmation, empty state) | G2 start (CI/CD pipeline for package) | H1 start (onboarding guide draft) |
| Tue | C1 final verification (run full archive cycle, check Lakehouse + Eventhouse) | E1 completion, push to main | G2 continue | H1 continue (link to Teams guide, community channels) |
| Wed | Bug fixes from C1/D1 if needed | Bug fixes from E1/A1 if needed | G2 completion | F2 (publish Blog 04 on dev.to, Reddit posts) |
| Thu | Design partner support / buffer | Design partner support / buffer | Buffer | I1 start (Release Orchestrator research -- forums, Reddit, competitive scan) |
| Fri | Sprint review, retro, metrics capture | Sprint review | Sprint review | I1 continue (spec outline draft), sprint review |

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Lakehouse write from notebook fails (OneLake permissions, Spark connector issues, format mismatch) | Medium | High | Test with a tiny batch first (10 records). LH_ObsArchive already exists and is accessible. If PySpark OneLake write fails, fall back to KQL `.export` to external table pointing at OneLake. If both fail, implement Eventhouse-only retention policy (`.alter-merge policy retention`) as a stopgap. |
| 2 | Teams webhook Adaptive Card format rejected by connector | Low | Medium | Use the official Microsoft Adaptive Card schema v1.4. Test with the Adaptive Card Designer (adaptivecards.io/designer) before integrating. If Adaptive Cards fail with "Workflows" connector, fall back to simple MessageCard (Office 365 connector) format. |
| 3 | Show HN gets zero traction | Medium | Low | HN is one channel, not the only channel. Reddit and dev.to are higher-value for the Fabric niche per growth playbook analysis. Blog posts provide sustained SEO-driven traffic regardless of HN performance. Do not measure sprint success by HN karma. |
| 4 | Design partners do not respond to Sprint 04 outreach | Medium | High | Follow up twice (1 week apart). If no response after 2 follow-ups, expand outreach to: Fabric Community forum connections, Reddit commenters who posted about monitoring pain, dev.to blog commenters, LinkedIn connections. Lower the commitment ask: "try it for 15 minutes and tell us one thing" instead of "4-week evaluation." |
| 5 | NuGet packaging layout does not match DevGateway expectations | Medium | Medium | Compare our package layout file-by-file against the Extensibility Toolkit's sample workload (`fabric-extensibility-toolkit/Workload/`). G1 is P1 not P0 -- can be deferred entirely if packaging proves complex. DevGateway works without a NuGet package during development. |
| 6 | Sprint 04 DevGateway (A1) did not complete | Medium | High | J1 is reserved as conditional P0 with 6h budget. If DevGateway is not working, J1 takes priority over E1 (saved searches) and G1/G2 (NuGet). Landing page A1 uses CLI screenshots as fallback. |
| 7 | Blog posts contain outdated information (test counts, feature lists, screenshots) | Low | Medium | Built into F2 task: review all posts against current product state before publishing. Update metrics, feature references, and links. This adds ~1h to F2 but prevents credibility damage. |
| 8 | Fabric trial capacity "Kanes Trial" expires or pauses mid-sprint | Low | Critical | Check capacity status on Day 1 of sprint. Set calendar reminder for weekly checks. If capacity pauses, prioritize renewal immediately -- all live Eventhouse/Lakehouse testing is blocked. Capacity ID: 1f61331b-db2a-4afd-9a26-e159aa338cee. |
| 9 | Saved searches feature introduces KQL injection risk via stored filters | Low | High | All saved search filters must go through the existing `escapeKql()` sanitization. The Filters column stores a dynamic/JSON object, not raw KQL. When loading a saved search, validate the JSON structure before using it to build a KQL query. Include this validation in code review and add a test case. |

---

## Metrics to Track

### Product Metrics

| Metric | Current (Sprint 04 Exit) | Sprint 05 Target | How to Measure |
|--------|-------------------------|-----------------|----------------|
| Test count | 243 | 260+ | `npm test` output |
| CI pass rate | 100% | 100% | GitHub Actions history |
| Eventhouse events | ~200 (estimated growth since Sprint 03) | 300+ | `FabricEvents \| count` |
| Eventhouse hot store size (MB) | Unknown -- establish baseline | Baselined + first archive run shrinks it | `.show database EH_Observability extents stats` |
| Lakehouse archive records | 0 | First archive batch completed | Count Parquet files in LH_ObsArchive |
| SavedSearches table | Does not exist | Created with CRUD working | `SavedSearches \| count` |
| Teams webhook delivery | N/A | First alert delivered to a real Teams channel | Manual verification + AlertLog entry |
| NuGet package | Does not exist | Builds successfully via `npm run package` | CI artifact |
| Dashboard load time (Fabric iframe) | < 3s target from S04 | < 3s maintained | Browser devtools in Fabric portal |
| Item types in DevGateway | 0-3 (depends on S04-A1 status) | 3 | Manual verification |

### Community Metrics

| Metric | Current (estimated at S04 end) | Sprint 05 Target | How to Measure |
|--------|-------------------------------|-----------------|----------------|
| GitHub stars | 0-25 (from S04 blog traffic) | 50+ | GitHub repo page |
| npm installs (cumulative) | 0-15 | 30+ | npm stats page |
| Blog post views (total across all posts) | 100-500 (blogs 01-02 live) | 2,000+ (4 posts live) | dev.to analytics |
| LinkedIn post impressions (total) | 200-1,000 | 4,000+ | LinkedIn analytics |
| Reddit post karma (total) | 0-20 | 60+ | Reddit post pages |
| GitHub Discussions threads | 0 | 5+ (including welcome post + organic questions) | GitHub Discussions tab |
| Discord members | 0 | 10+ | Discord server member count |
| HN post karma | 0 | 10+ | Hacker News post page |
| Design partner conversations active | 1-3 (from S04 outreach) | 3-5 | Tracking spreadsheet |
| Email signups (early access form) | 0-10 | 25+ | Signup form dashboard |

### Business Metrics

| Metric | Current | Sprint 05 Target | How to Measure |
|--------|---------|-----------------|----------------|
| Design partners signed (committed to evaluation) | 0 | 1-2 | Signed agreement or email commitment |
| Design partners with data flowing | 0 | 1 | Their workspace events in their Eventhouse |
| Revenue | $0 | $0 | N/A -- too early |
| Release Orchestrator research | Not started | Spec outline complete | File exists at `products/release-orchestrator/specs/product-spec-outline.md` |
| Weeks to first paid customer (estimate) | 12-16 (from S04 estimate) | Refined: 10-14 weeks | Based on design partner progress |

---

## Resource Allocation by Agent

| Agent Type | Tasks | Hours | Priority Range |
|-----------|-------|-------|----------------|
| **Backend Architect** | C1 (Lakehouse archive), D1 (Teams webhook) | 13h | P0 + P1 |
| **DevOps Automator** | B1 (community infrastructure), G1 (NuGet packaging), G2 (CI/CD), J1 (conditional DevGateway) | 11-17h | P0 + P1 + P2 |
| **Frontend Developer** | A1 (landing page), E1 (saved searches) | 10h | P0 + P1 |
| **Content Creator** | F1 (Show HN), F2 (blogs + social), H1 (onboarding guide) | 9h | P1 |
| **Fabric GTM Strategist** | I1 (Release Orchestrator market research) | 3h | P2 |
| **Fabric Workload Architect** | I1 (Release Orchestrator architecture sketch) | 3h | P2 |

**Bottleneck analysis**: Backend Architect is on the critical path with 13h across C1 and D1. These are sequential (C1 should start first since it is P0). If the DevOps agent finishes B1 and G1 early (7h total), they should assist with C1 -- the archive notebook has significant DevOps overlap (notebook deployment, scheduling, script updates).

Frontend Developer has a lighter load (10h) than Sprint 04 (22h). If A1 and E1 complete early, Frontend should assist with H1 (onboarding guide -- particularly the UX screenshots and flow documentation) or take on README polish (carried partial from S04-D2).

---

## Carry-Forward to Sprint 06

Items explicitly deferred from Sprint 05:

1. **Admin API access** -- Still requires tenant admin consent for service principal. Track but do not block on it.
2. **KQL query interface for advanced users** -- Product spec F6. Build when design partners specifically request it.
3. **Live KQL data in Fabric iframe (S04-A2)** -- If DevGateway is working but live KQL data inside the iframe is not verified, carry forward. May require OBO token debugging.
4. **Extensibility Toolkit Phases 6-7** -- Azure deployment and production hosting. These come after CI/CD (G2) proves the package works correctly.
5. **npx fabric-health-check standalone tool** -- Growth playbook viral loop mechanic. Build when blog content drives sufficient interest to justify the investment.
6. **SLO template library** -- Growth playbook Week 6-7 item. Build after design partners tell us which SLOs they actually care about.
7. **Office hours launch** -- Growth playbook Week 5-6. Schedule once community infrastructure (B1) proves there is an audience worth gathering.
8. **Newsletter setup** -- Growth playbook Week 5-6. Deferred until email signup list reaches 50+ subscribers to justify the operational overhead.
9. **README polish with screenshots** -- S04-D2 partial. Update with new screenshots once Sprint 05 features are stable and tested.
10. **Release Orchestrator full product spec** -- I1 produces the research and outline; full spec is Sprint 06 or later depending on Observability Workbench design partner feedback.
11. **Fabric Community forum presence** -- Growth playbook Phase 2. Start engaging once we have enough product stability to recommend it confidently.
12. **YouTube content** -- Growth playbook Phase 2. Deferred until the product has enough visual polish to record compelling demos.

---

## Sprint 05 Definition of Done

The sprint is **done** when:

1. **P0 tasks A1, B1, C1 (and J1 if needed) are merged to main and passing CI.**
2. Landing page is updated with screenshots, early access signup form, and current feature list.
3. GitHub Discussions is enabled with categories and a pinned welcome post.
4. Lakehouse cold archive notebook runs successfully -- at least one test run completes (even if no records are old enough to archive yet, the notebook handles that gracefully).
5. All 243 tests continue to pass.
6. No regressions in CLI tool or workload frontend functionality.

### Per-Task Definition of Done

Every task is done when:
- [ ] Code is committed to a feature branch and PR is opened
- [ ] CI pipeline passes (typecheck + tests)
- [ ] Merged to main
- [ ] Verified working against live Fabric environment (for KQL/notebook/Lakehouse tasks)
- [ ] Any new UI components have loading state, error state, and empty state
- [ ] Documentation updated if the task adds user-facing functionality
- [ ] No background processes spawned in any commands (NEVER append `&`)

---

## Lessons from Sprint 04 Applied

1. **Integration work takes 1.5-2x estimates.** Sprint 04 A1 (DevGateway) was estimated at 6h and did not fully complete. C1 (Lakehouse archive) has similar integration risk with Spark connectors and OneLake writes. Estimated at 8h with explicit mitigation strategies for each failure mode.

2. **P2 items do not get done.** Sprint 04 had 5.5h of P2 work (G1, G2) and none of it started. Sprint 05 has only 10h of P2 (G2, I1), and I1 is research that can be done in fragments without blocking anything.

3. **Content publishing is slower than writing.** Writing a blog is 2 hours. Reviewing, updating metrics, fixing links, publishing, posting social content, and monitoring engagement is 4+ hours. F2 is budgeted at 4h for 2 blog posts + social, which is tight but realistic if the posts are already written.

4. **Screenshots require a working product.** S04-D2 (README polish) and S04-E1 (landing page) both needed screenshots from DevGateway, which was not ready. Sprint 05 A1 (landing page) explicitly allows CLI screenshots as fallback, removing the DevGateway dependency.

5. **Buffer is not optional.** Sprint 04 allocated 21h buffer and still had 5+ tasks not started. Sprint 05 has 8-16h buffer depending on J1, plus realistic task sizing informed by Sprint 04 actuals.

---

## Sprint 05 Success = Design Partner Confidence

If we complete the P0 and P1 tasks, a design partner can:

- **Find us and understand the value** (updated landing page with signup form)
- **Install and see data in 10 minutes** (onboarding guide + CLI)
- **Receive alerts in Teams** (webhook integration)
- **Search and save queries** (event search + saved searches)
- **Trust the data store will not explode** (cold archive to Lakehouse)
- **Ask questions and get answers** (GitHub Discussions + Discord)
- **Share the tool internally** (landing page + blog posts sell the value proposition)

That is a product worth evaluating for 4 weeks. Sprint 05 success is measured by one outcome: at least one design partner actively using the tool against their own Fabric workspace. The revenue clock starts ticking when they say "I need this in production."
