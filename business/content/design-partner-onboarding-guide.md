# Design Partner Onboarding Guide

## Observability Workbench for Microsoft Fabric

> Version 1.0 | March 2026
> This guide is for design partners who have accepted the invitation to join the program. Welcome aboard.

---

## Table of Contents

1. [Welcome and Expectations](#1-welcome-and-expectations)
2. [Prerequisites](#2-prerequisites)
3. [Week 1 -- Setup and First Collection](#3-week-1--setup-and-first-collection)
4. [Week 2 -- Live Monitoring and SLO Configuration](#4-week-2--live-monitoring-and-slo-configuration)
5. [Week 3 -- Advanced Features](#5-week-3--advanced-features)
6. [Week 4 -- Feedback and Wrap-Up](#6-week-4--feedback-and-wrap-up)
7. [Support Channels](#7-support-channels)
8. [FAQ](#8-faq)
9. [Appendix A -- Environment Variable Reference](#appendix-a--environment-variable-reference)
10. [Appendix B -- KQL Table Reference](#appendix-b--kql-table-reference)

---

## 1. Welcome and Expectations

Thank you for joining the Observability Workbench Design Partner Program. You are one of 10 organizations shaping the first Fabric-native observability tool. This is not a beta test -- you are a co-creator, and your feedback directly determines what gets built.

### What You Get

| Benefit | Details |
|---------|---------|
| **Free Professional Tier** | Full Professional features ($499/month value) at zero cost for 4 weeks. Includes 5 workspaces, 90-day retention, unlimited SLOs, full alerting, and cross-item correlation. |
| **Direct Support Channel** | Private Discord or Teams channel with the engineering team. 4-hour response time target during business hours (AEST/UTC). |
| **Roadmap Influence** | Partners vote on the next features each sprint. Your priorities shape the product. |
| **Early Access** | New features delivered to design partners 2 weeks before general release. |
| **Founding Partner Recognition** | Listed on the website and in the project README (with your permission; anonymous attribution is also available). |
| **Post-Program Discount** | 50% off Professional tier for 3 months after the program ends ($249.50/month instead of $499/month). |

### What We Ask

| Commitment | Time Required |
|------------|--------------|
| Install and configure against a real Fabric environment within Week 1. Non-production environments are fine, but real workloads are needed (not synthetic data). | 2-3 hours (Week 1) |
| Use the tool for monitoring during Weeks 2-4, so you have hands-on experience to give informed feedback. | 15-30 minutes per day (passive monitoring with occasional exploration) |
| Attend one structured feedback session per week (async via Loom is fine if scheduling is difficult). | 30 minutes per week |
| File bugs and feature requests on GitHub. Honest reports of what does not work are more valuable than praise. | As encountered |
| Complete a structured wrap-up survey in Week 4. | 20 minutes (Week 4) |
| Grant permission for anonymized aggregate metrics in marketing materials. No organization-specific data without your explicit written consent. | One-time approval |

### Program Timeline at a Glance

```
Week 1: Setup and First Collection
  - Clone repo, configure service principal, create KQL database
  - Run create-tables.kql, execute first collection cycle
  - Verify data appears in Eventhouse

Week 2: Live Monitoring and SLO Setup
  - Enable scheduled ingestion (notebooks or CLI cron)
  - Review KQL dashboards with real data
  - Define your first 3-5 SLO targets
  - Configure alert rules for critical items

Week 3: Advanced Features
  - Explore cross-item correlation chains
  - Analyze CU waste scores
  - Deep-dive into event search
  - Walk through incident timelines

Week 4: Feedback and Wrap-Up
  - Complete structured feedback form
  - Architecture review session with engineering team
  - Roadmap discussion and next steps planning
```

### Your Dedicated Contacts

After you accept, we will introduce you to:

- **Engineering Lead** -- your primary contact for technical questions and support
- **Product Lead** -- handles roadmap feedback, feature prioritization, and program logistics

You will have direct access to both via the private partner channel.

---

## 2. Prerequisites

Before starting Week 1, verify that your Fabric environment meets these requirements.

### Fabric Capacity

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Capacity SKU | F2 (dev/test only) | F64 or higher |
| Region | Any Azure region | Same region as your primary workspaces |
| Status | Active (not paused) | Active |

**Why F64?** Lower SKUs restrict some REST API endpoints and have reduced concurrency. The ingestion notebooks and collection cycles perform API calls that work most reliably on F64 and above. If you only have F2 available for testing, let us know -- we can work around some limitations, but the experience will be constrained.

### Workspace Setup

You need a dedicated workspace for Observability Workbench components:

1. Create a new workspace in Fabric (suggested name: `ObservabilityWorkbench`)
2. Assign it to your Fabric capacity
3. Ensure the workspace has at least one Eventhouse available (or permission to create one)

**Important:** The Observability Workbench collects data *from* your other workspaces. The workspaces you want to monitor do not need any changes. The dedicated workspace is only for the tool's own storage and notebooks.

### Eventhouse Access

You need an Eventhouse with a KQL database. If you do not already have one:

1. In the Fabric portal, go to your ObservabilityWorkbench workspace
2. Select **New** then **Eventhouse**
3. Name it (suggested: `EH_Observability`)
4. A default KQL database is created automatically with the same name

After creation, note the following (you will need them during setup):

- **KQL Query Endpoint** -- found in the Eventhouse details page (looks like `https://trd-XXXXX.z9.kusto.fabric.microsoft.com`)
- **KQL Ingestion Endpoint** -- same details page (looks like `https://ingest-trd-XXXXX.z9.kusto.fabric.microsoft.com`)
- **Database Name** -- the name of the KQL database within the Eventhouse

### Service Principal (Entra ID App Registration)

You need an Entra ID service principal to authenticate the CLI and notebooks against Fabric APIs.

**If your organization already has a service principal for Fabric automation:**
- Verify it has the required permissions listed below
- Obtain the Tenant ID, Client ID, and Client Secret

**If you need to create a new one:**

1. Go to the **Azure Portal** and navigate to **Microsoft Entra ID** then **App registrations** then **New registration**
2. Name: `ObservabilityWorkbench-SP` (or your preferred convention)
3. Account type: Single tenant
4. No redirect URI needed
5. After creation, go to **Certificates & secrets** and create a new client secret. Copy the value immediately (it is only shown once).
6. Note the **Application (client) ID** and **Directory (tenant) ID** from the Overview page.

**Required API Permissions:**

| Permission | Type | Purpose |
|------------|------|---------|
| `https://api.fabric.microsoft.com/.default` | Application | Access Fabric REST APIs (workspace listing, item enumeration, job instances) |
| `https://api.kusto.windows.net/.default` | Application | Query and ingest data into Eventhouse |

**Grant admin consent** for these permissions in the Azure Portal under the app's API Permissions page.

**Fabric Tenant Settings:**

Your Fabric admin must enable one setting:
- Go to **Fabric Admin Portal** then **Tenant settings** then **Developer settings**
- Enable **Service principals can use Fabric APIs**
- Add the service principal (or its security group) to the allowed list

**Workspace Access:**

The service principal needs **Contributor** or **Member** role on:
- The ObservabilityWorkbench workspace (for KQL ingestion and notebook execution)
- Each workspace you want to monitor (for reading monitoring hub data and job instances)

To add the service principal to a workspace:
1. Open the workspace in Fabric
2. Select **Manage access**
3. Add the service principal by its application name or client ID
4. Assign **Contributor** role

### Local Development Environment

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x or 22.x (not 24.x) | Runs the CLI tool |
| npm | Included with Node.js | Package management |
| Git | Any recent version | Clone the repository |
| A terminal | bash, zsh, PowerShell, or Windows Terminal | Running commands |

**Node 24 is not supported.** The project uses dependencies that are incompatible with Node.js 24. Use Node 20 (LTS) or Node 22.

### Preflight Checklist

Before proceeding to Week 1, confirm:

- [ ] Fabric capacity is active (F64 or higher recommended)
- [ ] Dedicated workspace created and assigned to capacity
- [ ] Eventhouse and KQL database created
- [ ] KQL query endpoint URL noted
- [ ] KQL ingestion endpoint URL noted
- [ ] KQL database name noted
- [ ] Service principal created with client secret
- [ ] Tenant ID, Client ID, and Client Secret obtained
- [ ] Admin consent granted for Fabric and Kusto API permissions
- [ ] "Service principals can use Fabric APIs" enabled in tenant settings
- [ ] Service principal added as Contributor to all relevant workspaces
- [ ] Node.js 20 or 22 installed locally
- [ ] Git installed locally

If any of these are blocked by organizational policy (for example, you cannot create service principals without IT approval), reach out to us on the partner channel and we will help you navigate the process or find an alternative approach.

---

## 3. Week 1 -- Setup and First Collection

**Goal:** By the end of Week 1, you have the CLI running, tables created in your Eventhouse, and your first batch of monitoring data collected and visible in KQL.

### Step 1: Clone the Repository

```bash
git clone https://github.com/tenfingerseddy/FabricWorkloads.git
cd FabricWorkloads
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages. It should complete in under 60 seconds on a typical connection. If you see any `ERESOLVE` or peer dependency warnings, they can usually be ignored. If `npm install` fails outright, contact us with the error output.

### Step 3: Verify the Build

```bash
npx tsc --noEmit
```

This runs the TypeScript compiler in check mode. If it prints no output and exits with code 0, the build is clean. If you see errors, your Node.js version may be incorrect -- verify with `node --version`.

Run the test suite to confirm everything is healthy:

```bash
npm test
```

All tests should pass. Current count is 187+. If tests fail on your machine, send us the output -- it is usually an environment issue, not a code issue.

### Step 4: Configure Environment Variables

Create a `.env` file in the project root (this file is gitignored and will not be committed):

```bash
# .env -- Observability Workbench configuration
# Copy this template and fill in your values

# === Required: Fabric Authentication ===
FABRIC_TENANT_ID=your-tenant-id-here
FABRIC_CLIENT_ID=your-client-id-here
FABRIC_CLIENT_SECRET=your-client-secret-here

# === Required: Eventhouse Endpoints ===
EVENTHOUSE_QUERY_ENDPOINT=https://trd-XXXXX.z9.kusto.fabric.microsoft.com
EVENTHOUSE_INGESTION_ENDPOINT=https://ingest-trd-XXXXX.z9.kusto.fabric.microsoft.com
KQL_DATABASE=EH_Observability

# === Optional: KQL Toggle ===
KQL_ENABLED=true
```

Alternatively, export these variables directly in your terminal session:

```bash
export FABRIC_TENANT_ID="your-tenant-id"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
export EVENTHOUSE_QUERY_ENDPOINT="https://trd-XXXXX.z9.kusto.fabric.microsoft.com"
export EVENTHOUSE_INGESTION_ENDPOINT="https://ingest-trd-XXXXX.z9.kusto.fabric.microsoft.com"
export KQL_DATABASE="EH_Observability"
export KQL_ENABLED="true"
```

**Security note:** Never commit your `.env` file or share your client secret in GitHub Issues, Discord messages, or screenshots. The `.gitignore` file already excludes `.env`, but double-check before pushing any changes.

### Step 5: Verify Authentication

Run the CLI in its default mode:

```bash
npm start
```

You should see output similar to:

```
Authenticating with Fabric API...            OK
Discovering workspaces...                    X found
```

If authentication fails:
- Verify the tenant ID, client ID, and client secret are correct
- Confirm admin consent has been granted for the Fabric API permissions
- Confirm the service principal is enabled (not disabled) in Entra ID
- Check that "Service principals can use Fabric APIs" is enabled in Fabric admin settings

If workspace discovery returns 0 workspaces:
- The service principal needs Contributor or Member access on at least one workspace
- Add it via the workspace's "Manage access" settings in the Fabric portal

### Step 6: Create KQL Tables

Open the KQL database in your Eventhouse through the Fabric portal. You can do this by navigating to your workspace, selecting the Eventhouse, then opening the KQL database.

In the KQL query editor, paste and run the contents of `kql/create-tables.kql` from the repository. This creates the following tables:

| Table | Purpose |
|-------|---------|
| `FabricEvents` | Core event storage -- all job instances from monitored workspaces |
| `EventCorrelations` | Cross-item correlation links between upstream and downstream events |
| `SloDefinitions` | SLO target definitions (freshness, success rate, duration) |
| `SloSnapshots` | Point-in-time SLO measurements and error budget tracking |
| `AlertRules` | Alert rule definitions (conditions, thresholds, notification targets) |
| `WorkspaceInventory` | Workspace and item inventory (items discovered across workspaces) |
| `AlertLog` | Alert history log (all fired alerts with severity and values) |

The script also sets retention policies (90 days for events, 365 days for inventory and snapshots) and creates a materialized view for deduplication.

**Verify table creation** by running this query:

```kql
.show tables
```

You should see all 7 tables listed.

### Step 7: Run the First Collection Cycle

```bash
npm run collect
```

This runs the collector in one-shot mode. It will:
1. Authenticate with Fabric
2. Discover all workspaces the service principal can access
3. Pull job instances from the Fabric REST API for each workspace
4. Compute initial SLO metrics
5. Ingest the data into your Eventhouse (if `KQL_ENABLED=true`)

Expected output:

```
Authenticating with Fabric API...            OK
Discovering workspaces...                    X found
Collecting job instances...                  Y events
Computing SLOs...                            Z definitions evaluated
```

The number of events depends on how many workspaces and items your service principal can access, and how much recent activity exists.

### Step 8: Verify Data in Eventhouse

Go back to your KQL database in the Fabric portal and run:

```kql
FabricEvents
| count
```

If the count is greater than 0, data is flowing. Run a broader check:

```kql
FabricEvents
| summarize
    TotalEvents = count(),
    Workspaces = dcount(WorkspaceId),
    Items = dcount(ItemId),
    EarliestEvent = min(StartTimeUtc),
    LatestEvent = max(StartTimeUtc)
```

This tells you how many events were ingested, across how many workspaces and items, and the time range covered.

### Step 9: Run the Dashboard

```bash
npm run dashboard
```

This renders a CLI dashboard using the most recent collected data. You should see:
- A workspace health summary (items by status)
- SLO compliance overview
- CU waste score (if applicable)
- Any active alerts

### Week 1 Checkpoint

By end of Week 1, you should be able to confirm:

- [ ] Repository cloned and `npm install` completed
- [ ] `npm test` passes all tests
- [ ] Environment variables configured
- [ ] `npm start` authenticates and discovers workspaces
- [ ] KQL tables created in Eventhouse (7 tables)
- [ ] `npm run collect` ingests events into Eventhouse
- [ ] `FabricEvents | count` returns > 0 in KQL query editor
- [ ] `npm run dashboard` renders health summary

**If you are stuck on any step**, reach out on the partner channel. We will schedule a 30-minute pairing session to get you unblocked. Most setup issues are permissions-related and can be resolved quickly.

---

## 4. Week 2 -- Live Monitoring and SLO Configuration

**Goal:** By the end of Week 2, you have continuous data collection running, SLOs defined for your most critical items, and alert rules configured.

### Step 1: Set Up Scheduled Collection

You have two options for continuous collection: Fabric Notebooks (recommended for production) or CLI cron (simpler for evaluation).

#### Option A: Fabric Notebooks (Recommended)

The repository includes three pre-built notebooks in the `notebooks/` directory:

| Notebook | Schedule | Purpose |
|----------|----------|---------|
| `NB_ObsIngestion` | Every 5 minutes | Pulls new events from the Fabric REST API and ingests into Eventhouse |
| `NB_ObsCorrelation` | Every 15 minutes | Builds and updates cross-item dependency chains |
| `NB_ObsAlerts` | Every 15 minutes | Evaluates alert rules and fires notifications |

**To deploy notebooks to your workspace:**

1. In the Fabric portal, go to your ObservabilityWorkbench workspace
2. Create three new notebooks with the names above
3. Copy the contents from the `.py` files in `notebooks/` into each notebook
4. Update the configuration cell in each notebook with your Eventhouse details:
   - KQL query endpoint
   - KQL ingestion endpoint
   - Database name
5. Run each notebook manually once to verify it executes without errors
6. Schedule each notebook using Fabric's built-in scheduler:
   - Select the notebook then **Schedule** in the ribbon
   - Set the frequency as shown in the table above
   - Enable the schedule

Alternatively, if you are comfortable with the CLI, use the deployment script:

```bash
./scripts/deploy-to-fabric.sh --dry-run
```

The `--dry-run` flag shows what would happen without making changes. Remove it to execute:

```bash
./scripts/deploy-to-fabric.sh
```

This script uploads notebooks, configures schedules, and runs a health check against the Eventhouse.

#### Option B: CLI Cron (Simpler)

If you prefer to run collection from your local machine or a VM:

**Linux/macOS (crontab):**

```bash
# Run collection every 5 minutes
*/5 * * * * cd /path/to/FabricWorkloads && npm run collect >> /var/log/obs-workbench.log 2>&1
```

**Windows (Task Scheduler):**

Create a scheduled task that runs `npm run collect` in the project directory every 5 minutes.

**Important:** CLI cron is fine for the design partner evaluation period, but it requires a machine that is always on. For production use, Fabric Notebooks are preferred because they run natively in your Fabric capacity and do not require an external compute resource.

### Step 2: Review Your First KQL Dashboards

After 24-48 hours of continuous collection, you will have enough data to see meaningful patterns. Run these queries in your KQL database to explore your data.

**Workspace Health Scorecard:**

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status in ("Completed", "Failed", "Cancelled")
| summarize
    TotalJobs = count(),
    Succeeded = countif(Status == "Completed"),
    Failed = countif(Status == "Failed"),
    AvgDurationSec = round(avg(DurationSeconds), 0)
    by WorkspaceName
| extend SuccessRate = round(todouble(Succeeded) / TotalJobs * 100, 1)
| extend Grade = case(
    SuccessRate >= 99.0, "A",
    SuccessRate >= 95.0, "B",
    SuccessRate >= 90.0, "C",
    SuccessRate >= 80.0, "D",
    "F")
| order by SuccessRate asc
```

**Top Failing Items:**

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Failed"
| summarize
    FailureCount = count(),
    LastFailure = max(StartTimeUtc),
    SampleReason = take_any(FailureReason)
    by ItemName, ItemType, WorkspaceName
| order by FailureCount desc
| take 20
```

**Daily Success Rate Trend:**

```kql
FabricEvents
| where StartTimeUtc > ago(30d)
| where Status in ("Completed", "Failed")
| summarize
    Total = count(),
    Succeeded = countif(Status == "Completed")
    by Day = bin(StartTimeUtc, 1d)
| extend SuccessRate = round(todouble(Succeeded) / Total * 100, 1)
| order by Day asc
```

The full Community Query Pack (`kql/community-query-pack.kql` in the repository) contains 20 additional queries organized by category: health overview, failure analysis, SLO tracking, correlation, performance, and capacity. Copy and paste any query you find useful into a KQL queryset in your workspace for ongoing use.

### Step 3: Configure SLO Definitions

Choose 3-5 of your most critical Fabric items to start tracking SLOs. Good candidates are:

- A pipeline that feeds a business-critical report
- A semantic model refresh that stakeholders depend on daily
- A notebook that runs an important data transformation
- Any item where a failure has caused real impact in the past

**SLO types available:**

| Metric Type | What It Tracks | Example Target |
|-------------|---------------|----------------|
| `SuccessRate` | Percentage of runs that complete successfully over a rolling window | 99% over 7 days |
| `Freshness` | Time since last successful completion | Within 2 hours |
| `Duration` | P95 execution time over a rolling window | Under 30 minutes |

**To define an SLO**, insert a row into the `SloDefinitions` table in your KQL database:

```kql
.ingest inline into table SloDefinitions <|
    new_guid(), "your-workspace-id", "your-item-id", "Daily Sales Pipeline", "SuccessRate", 99.0, 95.0, "7d", now(), true
```

Replace the placeholder values:
- `your-workspace-id` -- the GUID of the workspace containing the item
- `your-item-id` -- the GUID of the specific Fabric item
- `"Daily Sales Pipeline"` -- a human-readable name for the item
- `99.0` -- the target value (99% success rate)
- `95.0` -- the warning threshold (alert at 95%, breach at 99%)
- `"7d"` -- the evaluation window (rolling 7 days)

You can find item GUIDs by querying:

```kql
WorkspaceInventory
| where ItemName contains "your item name"
| project WorkspaceId, WorkspaceName, ItemId, ItemName, ItemType
```

**Start with 3-5 SLOs.** You can add more as you become comfortable with the system. Defining too many at once makes it harder to evaluate whether the thresholds are appropriate for your environment.

### Step 4: Configure Alert Rules

Once SLOs are defined, set up alert rules so you are notified when something goes wrong.

**Insert an alert rule:**

```kql
.ingest inline into table AlertRules <|
    new_guid(), "your-slo-id", "SloBreached", 0, "email", "your-email@company.com", 60, true, now()
```

Parameters:
- `"your-slo-id"` -- the SloId of the SLO definition you want to alert on
- `"SloBreached"` -- the alert condition (options: `SloBreached`, `SloWarning`, `TrendDegradation`, `ErrorSpike`)
- `0` -- the threshold value (0 means use the SLO's own target)
- `"email"` -- notification type (`email` or `webhook`)
- `"your-email@company.com"` -- where to send the notification
- `60` -- cooldown period in minutes (prevents repeated alerts)
- `true` -- whether the rule is enabled

**Recommended starter alerts:**
- One `SloBreached` alert per critical SLO
- One `ErrorSpike` alert across your busiest workspace (catches sudden failure bursts)

### Week 2 Checkpoint

By end of Week 2:

- [ ] Scheduled collection is running (notebooks or cron)
- [ ] 24+ hours of continuous data in Eventhouse
- [ ] Reviewed workspace health scorecard and failure analysis queries
- [ ] Defined 3-5 SLOs for critical items
- [ ] Configured alert rules for at least your top SLOs
- [ ] Explored the Community Query Pack for additional useful queries

### Week 2 Feedback Session

At the end of Week 2, we will schedule a 30-minute feedback session (video call or async Loom). Topics:

- How did the setup process go? What was confusing or slow?
- Are the KQL queries giving you useful insights?
- Do the SLO definitions make sense for your environment?
- Any bugs or unexpected behavior?
- What features are you most wanting that do not exist yet?

---

## 5. Week 3 -- Advanced Features

**Goal:** By the end of Week 3, you have explored the full depth of the tool: correlation chains, CU analysis, event search, and incident timelines.

### Cross-Item Correlation Review

The correlation engine (run by `NB_ObsCorrelation` or the CLI) automatically discovers dependency chains between Fabric items. After 1-2 weeks of data, it should have built relationships.

**View discovered correlations:**

```kql
EventCorrelations
| summarize
    TotalCorrelations = count(),
    RelationshipTypes = make_set(RelationshipType),
    AvgConfidence = round(avg(ConfidenceScore), 2)
```

**View a specific correlation chain** (trace a failure back to its root cause):

```kql
let failedEvent = toscalar(
    FabricEvents
    | where Status == "Failed"
    | where StartTimeUtc > ago(7d)
    | top 1 by StartTimeUtc desc
    | project EventId
);
// Find upstream causes
EventCorrelations
| where DownstreamEventId == failedEvent
| join kind=inner FabricEvents on $left.UpstreamEventId == $right.EventId
| project
    UpstreamItem = ItemName,
    UpstreamType = ItemType,
    UpstreamStatus = Status,
    UpstreamStart = StartTimeUtc,
    Confidence = ConfidenceScore,
    Relationship = RelationshipType
```

**View downstream impact** (what broke because of a specific failure):

```kql
let failedEvent = toscalar(
    FabricEvents
    | where Status == "Failed"
    | where StartTimeUtc > ago(7d)
    | top 1 by StartTimeUtc desc
    | project EventId
);
EventCorrelations
| where UpstreamEventId == failedEvent
| join kind=inner FabricEvents on $left.DownstreamEventId == $right.EventId
| project
    DownstreamItem = ItemName,
    DownstreamType = ItemType,
    DownstreamStatus = Status,
    DownstreamStart = StartTimeUtc,
    Confidence = ConfidenceScore
```

**Questions to consider during your exploration:**
- Are the discovered correlations correct? Does the tool correctly identify that Pipeline A triggers Notebook B?
- Are there dependency chains the tool missed? (This is valuable feedback -- tell us about them.)
- Is the confidence score meaningful? Are high-confidence correlations accurate and low-confidence ones less reliable?

### CU Waste Score Analysis

The CU waste scorer identifies items that are consuming capacity units disproportionately to the value they deliver. Run the CLI to see scores:

```bash
npm run collect
npm run dashboard
```

The dashboard includes a CU Waste Score section. Items are scored on a 0-100 scale:
- **80-100**: Efficient -- well-utilized
- **50-79**: Moderate -- some optimization possible
- **0-49**: Wasteful -- significant CU savings available

Common waste patterns the tool detects:
- Items that run frequently but consistently fail (wasting CUs on retries)
- Items with run durations that have regressed significantly over time
- Scheduled items that have not produced new data in the last 7 days (running but serving no purpose)
- Items running more frequently than their downstream consumers need

**Questions to consider:**
- Do the waste scores match your intuition about which items are inefficient?
- Are there waste patterns the tool is not catching?
- Would CU cost estimates (translating waste scores to dollar amounts) be useful?

### Event Search Deep-Dive

By Week 3, you have accumulated 2+ weeks of event data -- far more than the Fabric monitoring hub retains in its UI view.

**Search for events by error message:**

```kql
FabricEvents
| where StartTimeUtc > ago(14d)
| where FailureReason contains "timeout"
| summarize
    OccurrenceCount = count(),
    AffectedItems = dcount(ItemId),
    FirstSeen = min(StartTimeUtc),
    LastSeen = max(StartTimeUtc)
    by FailureReason
| order by OccurrenceCount desc
```

**Search for a specific item's full history:**

```kql
FabricEvents
| where ItemName == "Your Pipeline Name"
| where StartTimeUtc > ago(30d)
| project StartTimeUtc, EndTimeUtc, Status, DurationSeconds, FailureReason
| order by StartTimeUtc desc
```

**Find items with duration regressions:**

```kql
FabricEvents
| where StartTimeUtc > ago(14d)
| where Status == "Completed"
| summarize
    P50 = percentile(DurationSeconds, 50),
    P95 = percentile(DurationSeconds, 95),
    Runs = count()
    by ItemName, ItemType
| where Runs >= 10
| where P95 > P50 * 3
| order by P95 desc
```

This finds items where the P95 duration is more than 3x the median -- a sign of intermittent performance issues.

**Questions to consider:**
- Can you find events that the Fabric monitoring hub no longer shows (older than 30 days or beyond the 100-activity window)?
- Is the full-text search on FailureReason useful for diagnosing recurring issues?
- What additional search filters would make this more useful?

### Incident Timeline Walkthrough

Select a recent failure in your environment and reconstruct the incident timeline.

**Step 1: Identify the failure.**

```kql
FabricEvents
| where Status == "Failed"
| where StartTimeUtc > ago(7d)
| project StartTimeUtc, ItemName, ItemType, WorkspaceName, FailureReason
| order by StartTimeUtc desc
| take 10
```

**Step 2: Build the timeline for one event.**

Pick an EventId from the above and replace it below:

```kql
let targetEvent = guid("paste-event-id-here");
let targetTime = toscalar(
    FabricEvents | where EventId == targetEvent | project StartTimeUtc
);
// Everything that happened in the same workspace within 30 minutes
FabricEvents
| where WorkspaceId == toscalar(
    FabricEvents | where EventId == targetEvent | project WorkspaceId
)
| where StartTimeUtc between (targetTime - 30m .. targetTime + 30m)
| project StartTimeUtc, EndTimeUtc, ItemName, ItemType, Status, DurationSeconds, FailureReason
| order by StartTimeUtc asc
```

**Step 3: Check for upstream causes and downstream impact** using the correlation queries from earlier in this section.

**Questions to consider:**
- Can you reconstruct an incident that actually happened in your environment?
- Does the timeline make the root cause obvious?
- What information is missing from the timeline that would have helped during the incident?

### Week 3 Checkpoint

By end of Week 3:

- [ ] Reviewed correlation chains and validated accuracy
- [ ] Examined CU waste scores and identified at least one optimization opportunity
- [ ] Used event search to find historical events beyond the monitoring hub's 30-day window
- [ ] Walked through at least one incident timeline end-to-end
- [ ] Noted any missing features, incorrect data, or UX friction

### Week 3 Feedback Session

Topics for the Week 3 session:

- Correlation accuracy: what percentage of discovered chains are correct?
- Are there dependency patterns the tool cannot detect yet?
- How useful are the CU waste scores in practice?
- What searches or queries do you find yourself running repeatedly?
- If you could add one feature right now, what would it be?

---

## 6. Week 4 -- Feedback and Wrap-Up

**Goal:** Deliver structured feedback, discuss architecture and roadmap, and plan what happens after the program.

### Structured Feedback Form

In Week 4, we will send you a feedback form. Here is what it covers so you can think about your responses throughout the program:

**Section 1: Setup and Onboarding**

- How long did initial setup take? (hours)
- What was the most confusing part of setup?
- What would have made setup faster?
- Rate the documentation quality (1-5)

**Section 2: Core Features**

For each feature, rate usefulness (1-5) and reliability (1-5):

| Feature | Usefulness | Reliability | Comments |
|---------|-----------|-------------|----------|
| Long-retention event store | | | |
| Cross-item correlation | | | |
| SLO tracking | | | |
| Alert rules | | | |
| Event search | | | |
| CU waste scoring | | | |
| CLI dashboard | | | |
| KQL query pack | | | |

**Section 3: Impact**

- Did the tool surface any issues you did not know about?
- Did it reduce the time to diagnose an incident? If so, by how much?
- How many SLOs did you end up defining?
- Did any alert fire that caught a real problem early?

**Section 4: Missing Features**

- What is the single most important feature that does not exist yet?
- Rank these potential features by priority for your team:
  - [ ] Teams webhook notifications
  - [ ] Multi-workspace aggregated view
  - [ ] Lakehouse cold archive (365-day)
  - [ ] KQL query interface in the workload UI
  - [ ] Custom correlation rules
  - [ ] "Likely to breach" predictive alerts
  - [ ] Saved searches and shared views
  - [ ] Cost estimation (CU to dollar conversion)
  - [ ] Other: ___

**Section 5: Pricing and Willingness to Pay**

- Would you continue using this tool after the program?
- Would your organization pay $499/month for Professional tier?
- What would justify the price? What would need to change?
- What is the maximum your team would pay for this type of tool?

**Section 6: Open Feedback**

- What did we get right?
- What did we get wrong?
- What surprised you (positively or negatively)?
- Would you recommend this tool to a colleague?

### Architecture Review Session

We will schedule a 45-60 minute session with the engineering team to discuss:

1. **Your environment architecture**: How does Observability Workbench fit into your existing monitoring and alerting stack? Are there integration points we should build toward?

2. **Scalability concerns**: Based on your data volume, are there performance issues we need to address before general availability?

3. **Security review**: Any concerns about the authentication model, data access patterns, or permission structure?

4. **Deployment model preferences**: Do you prefer the notebook-based approach, the CLI approach, or would you rather have a fully managed SaaS deployment? This shapes our roadmap significantly.

### Roadmap Discussion

We will share our planned roadmap and ask you to prioritize:

- **Near-term (next 4 weeks)**: Which features would make you convert to a paid tier?
- **Medium-term (next quarter)**: Which of our planned products (Release Orchestrator, FinOps Guardrails, Schema Drift Gate) would be most valuable to your team?
- **Long-term**: Where do you see Fabric observability heading? What should we be building toward?

### Post-Program Options

After the 4-week program, you have several options:

| Option | Details |
|--------|---------|
| **Convert to Professional** | $249.50/month for 3 months (50% founding partner discount), then $499/month. Continuous monitoring, full features, continued support. |
| **Stay on Free Tier** | 1 workspace, 7-day retention, 5 SLOs. Good if you want to keep evaluating with limited scope. |
| **Pause and Revisit** | No obligation. We will keep you updated on new features via newsletter. Re-engage anytime. |
| **Continue as Advisor** | If the product is not ready for your needs but you want to stay involved, join our advisory group for quarterly check-ins and continued roadmap input. |

### Week 4 Checkpoint

By end of Week 4:

- [ ] Structured feedback form completed
- [ ] Architecture review session completed
- [ ] Roadmap discussion completed
- [ ] Post-program option selected
- [ ] (Optional) Testimonial provided or case study interview scheduled
- [ ] (Optional) Referral to another team that could benefit

---

## 7. Support Channels

### During the Program

| Channel | Response Time | Best For |
|---------|--------------|----------|
| **Private Partner Channel** (Discord or Teams) | 4 hours during business hours | Quick questions, setup help, real-time troubleshooting |
| **GitHub Issues** (https://github.com/tenfingerseddy/FabricWorkloads/issues) | 24 hours | Bug reports, feature requests, reproducible problems |
| **Email** | 24 hours | Sensitive topics, security concerns, billing questions |
| **Scheduled Call** | By appointment | Complex issues, architecture discussions, feedback sessions |

### How to File a Good Bug Report

When filing a GitHub Issue:

1. Use the "Bug Report" template
2. Include:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce
   - Your Fabric capacity SKU
   - Your Node.js version (`node --version`)
   - The full error output (redact any secrets or tenant-specific data)
3. Label it with `design-partner` so we can prioritize

### After the Program

| Channel | Response Time | Best For |
|---------|--------------|----------|
| **GitHub Issues** | 48 hours | Bug reports and feature requests |
| **GitHub Discussions** (https://github.com/tenfingerseddy/FabricWorkloads/discussions) | Community-driven | Questions, ideas, show your setup |
| **Discord** | Community-driven | General discussion, tips, networking |
| **Newsletter** | Bi-weekly | Product updates, new features, community highlights |

---

## 8. FAQ

### Data Privacy and Security

**Q: Does Observability Workbench send my data outside my Fabric tenant?**

No. All data stays within your Fabric tenant. The tool reads from Fabric REST APIs and writes to your Eventhouse and Lakehouse. No telemetry, usage data, or monitoring data is transmitted to our servers or any third party. The CLI runs on your local machine. The notebooks run within your Fabric capacity. The data path is entirely within your control.

**Q: What data does the tool collect?**

The tool collects job metadata from the Fabric REST API: item names, types, run statuses, start/end times, durations, error messages, and root activity IDs. It does NOT access the contents of your data (no table rows, no report data, no dataset contents). It reads operational metadata only.

**Q: Can I restrict which workspaces the tool monitors?**

Yes. The service principal only has access to workspaces where it has been explicitly granted a role. If you do not add the service principal to a workspace, the tool cannot read any data from it. This gives you full control over the monitoring scope.

**Q: Is there an audit trail of what the tool does?**

Yes. All ingestion operations, SLO computations, and alert evaluations are logged in the KQL tables with timestamps. You can query the `AlertLog` table to see every alert that was evaluated and fired. The Fabric monitoring hub also shows the notebook job runs, so you have full visibility into the tool's own operations.

**Q: What happens to my data if I stop using the tool?**

The data remains in your Eventhouse and Lakehouse. You own it completely. If you stop running the collection notebooks or CLI, no new data is ingested, but existing data remains queryable until the retention policy expires (90 days for events, 365 days for snapshots and inventory). You can delete the tables at any time.

### Capacity and CU Consumption

**Q: How much CU does Observability Workbench consume?**

The tool is designed to consume less than 5% of a typical F64 capacity. The main CU consumers are:
- Notebook execution (NB_ObsIngestion every 5 min, NB_ObsCorrelation and NB_ObsAlerts every 15 min)
- KQL ingestion and query operations
- Eventhouse storage

Actual consumption varies with the number of monitored workspaces and items. During the design partner program, we will help you measure the actual CU impact. If it exceeds 5%, we will work with you to optimize.

**Q: Will this affect my other Fabric workloads?**

The tool runs in its own workspace and uses its own Eventhouse. It does not modify, trigger, or interfere with any existing Fabric items. The only shared resource is the Fabric capacity -- the notebooks consume CUs from the same capacity pool. On F64, the impact is negligible for most environments. If you are running close to capacity limits, let us know and we can adjust the collection frequency.

**Q: What is the minimum capacity SKU?**

F64 is recommended. F2 works for development and testing but may hit API rate limits and has reduced concurrency. SKUs below F2 are not supported.

**Q: Can I run this on a trial capacity?**

Yes. Fabric trial capacities (FTL64) work. Our own development environment runs on a trial capacity. Be aware that trial capacities have a 60-day expiration.

### Authentication and Permissions

**Q: Can I use a user account instead of a service principal?**

The CLI supports user-delegated auth in theory, but the scheduled notebooks require a service principal for unattended execution. We recommend using a service principal from the start so the setup is consistent across CLI and notebook use.

**Q: What if my organization does not allow service principals?**

Some organizations restrict service principal creation. Options:
1. Request an exception for the Observability Workbench SP, scoped to read-only Fabric access
2. Use an existing service principal that already has Fabric API access
3. Contact us -- we can discuss alternative authentication patterns for restricted environments

**Q: What if I cannot get admin consent for the API permissions?**

If your Entra ID admin cannot grant consent for `https://api.fabric.microsoft.com/.default`, the tool cannot authenticate. This is a hard requirement. We can provide a brief justification document to share with your admin team that explains exactly what the permissions allow and what they do not allow.

**Q: Does the service principal need Global Admin or Fabric Admin?**

No. The service principal needs only workspace-level Contributor access. It does not need any admin-level permissions. The only admin action required is the one-time tenant setting to enable service principals to use Fabric APIs.

### Technical Questions

**Q: Can I customize the collection frequency?**

Yes. The default is every 5 minutes for ingestion and every 15 minutes for correlation and alerts. You can adjust the notebook schedules or the CLI cron expression to any frequency. Lower frequency (every 30 min or hourly) reduces CU consumption. Higher frequency (every 1-2 min) is possible but increases CU cost.

**Q: Can I use my existing Eventhouse instead of creating a new one?**

Yes. Run `create-tables.kql` in any KQL database. The table names are specific to Observability Workbench and will not conflict with your existing tables. Point the environment variables to your existing Eventhouse endpoints and database name.

**Q: What if I already have a FabricEvents table with a different schema?**

Rename conflict. Either use a separate KQL database for Observability Workbench tables, or modify the table names in `create-tables.kql` and update the corresponding references in the notebooks and CLI configuration. Contact us and we will help with the mapping.

**Q: Does the tool work with Fabric on sovereign clouds (Government, China)?**

Not tested. The tool uses the public Fabric API endpoints (`api.fabric.microsoft.com`) and public Entra ID endpoints (`login.microsoftonline.com`). Sovereign clouds use different endpoints. If you are on a sovereign cloud, reach out and we will work with you to adapt the configuration.

**Q: Can multiple team members use the same setup?**

Yes. The Eventhouse data is shared -- anyone with access to the KQL database can run queries and see the dashboards. Each team member can run the CLI independently (they all read from the same Fabric APIs and write to the same Eventhouse). Alert notifications go to whoever is configured in the AlertRules table.

**Q: How do I uninstall?**

1. Delete or disable the scheduled notebooks in the Fabric portal
2. (Optional) Delete the KQL tables: `.drop table FabricEvents`, `.drop table SloDefinitions`, etc.
3. (Optional) Delete the Eventhouse and Lakehouse
4. (Optional) Remove the service principal's workspace access
5. Delete the local repository folder

There are no background processes, no persistent connections, and no external dependencies to clean up.

---

## Appendix A -- Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FABRIC_TENANT_ID` | Yes | -- | Your Entra ID (Azure AD) tenant ID |
| `FABRIC_CLIENT_ID` | Yes | -- | Service principal application (client) ID |
| `FABRIC_CLIENT_SECRET` | Yes | -- | Service principal client secret value |
| `EVENTHOUSE_QUERY_ENDPOINT` | Yes | -- | KQL query endpoint URL for your Eventhouse |
| `EVENTHOUSE_INGESTION_ENDPOINT` | Yes | -- | KQL ingestion endpoint URL for your Eventhouse |
| `KQL_DATABASE` | No | `EH_Observability` | Name of the KQL database within the Eventhouse |
| `KQL_ENABLED` | No | `true` | Set to `false` to disable KQL ingestion (local-only mode) |

---

## Appendix B -- KQL Table Reference

### FabricEvents

Core event storage. One row per job instance.

| Column | Type | Description |
|--------|------|-------------|
| EventId | guid | Unique identifier for this event |
| WorkspaceId | guid | Workspace where the item resides |
| WorkspaceName | string | Human-readable workspace name |
| ItemId | guid | Fabric item identifier |
| ItemName | string | Human-readable item name |
| ItemType | string | Item type (Pipeline, Notebook, DataflowGen2, SemanticModel, etc.) |
| JobType | string | Job type identifier |
| InvokeType | string | How the job was triggered (Scheduled, Manual, API) |
| Status | string | Job status (Completed, Failed, Cancelled, InProgress) |
| FailureReason | string | Error message for failed jobs (empty for successful jobs) |
| RootActivityId | guid | Fabric activity ID for correlation |
| StartTimeUtc | datetime | Job start time (UTC) |
| EndTimeUtc | datetime | Job end time (UTC) |
| DurationSeconds | real | Execution duration in seconds |
| CorrelationGroup | string | Correlation group identifier (set by correlation engine) |
| IngestedAt | datetime | When this event was written to the Eventhouse |

### SloDefinitions

SLO target definitions. One row per SLO.

| Column | Type | Description |
|--------|------|-------------|
| SloId | guid | Unique SLO identifier |
| WorkspaceId | guid | Workspace scope |
| ItemId | guid | Item this SLO applies to |
| ItemName | string | Human-readable item name |
| MetricType | string | SLO type: SuccessRate, Freshness, or Duration |
| TargetValue | real | Target value (e.g., 99.0 for 99% success rate) |
| WarningThreshold | real | Warning threshold (alert before breach) |
| EvaluationWindow | string | Rolling window for evaluation (e.g., "7d") |
| CreatedAt | datetime | When this SLO was defined |
| IsActive | bool | Whether this SLO is actively evaluated |

### SloSnapshots

Point-in-time SLO measurements. One row per evaluation cycle per SLO.

| Column | Type | Description |
|--------|------|-------------|
| SnapshotId | guid | Unique snapshot identifier |
| SloId | guid | Which SLO this measurement is for |
| ItemId | guid | Item being measured |
| MetricType | string | Metric type (matches SloDefinitions) |
| CurrentValue | real | Current measured value |
| TargetValue | real | Target from the SLO definition |
| IsBreaching | bool | Whether the SLO is currently breached |
| ErrorBudgetRemaining | real | Remaining error budget (percentage) |
| ComputedAt | datetime | When this measurement was taken |

### EventCorrelations

Cross-item correlation links.

| Column | Type | Description |
|--------|------|-------------|
| UpstreamEventId | guid | The event that triggered/caused the downstream event |
| DownstreamEventId | guid | The event that was triggered/affected |
| RelationshipType | string | Type of relationship (Triggers, DependsOn, etc.) |
| ConfidenceScore | real | Confidence in this correlation (0.0 to 1.0) |
| DetectedAt | datetime | When the correlation was discovered |

### AlertRules

Alert rule definitions.

| Column | Type | Description |
|--------|------|-------------|
| RuleId | string | Unique rule identifier |
| SloId | string | SLO this rule monitors (or empty for workspace-wide rules) |
| Condition | string | Alert condition: SloBreached, SloWarning, TrendDegradation, ErrorSpike |
| Threshold | real | Threshold value (0 means use SLO target) |
| NotificationType | string | Notification channel: email or webhook |
| Target | string | Notification destination (email address or webhook URL) |
| Cooldown | int | Minimum minutes between repeated alerts |
| Enabled | bool | Whether this rule is active |
| CreatedAt | datetime | When this rule was created |

### AlertLog

History of all evaluated and fired alerts.

| Column | Type | Description |
|--------|------|-------------|
| AlertId | string | Unique alert instance identifier |
| Kind | string | Alert type |
| Severity | string | Alert severity level |
| WorkspaceId | string | Affected workspace |
| WorkspaceName | string | Workspace name |
| ItemId | string | Affected item |
| ItemName | string | Item name |
| Message | string | Human-readable alert message |
| Value | real | Measured value that triggered the alert |
| Threshold | real | Threshold that was exceeded |
| NotificationSent | bool | Whether the notification was successfully delivered |
| Timestamp | datetime | When the alert was evaluated |

### WorkspaceInventory

Discovered workspace and item inventory.

| Column | Type | Description |
|--------|------|-------------|
| WorkspaceId | string | Workspace identifier |
| WorkspaceName | string | Workspace name |
| ItemId | string | Item identifier |
| ItemName | string | Item name |
| ItemType | string | Item type |
| CapacityId | string | Fabric capacity hosting this workspace |
| DiscoveredAt | datetime | When this item was first seen |
| LastSeenAt | datetime | Most recent observation of this item |

---

*Observability Workbench is an open-source project (MIT license). Design partner participation is free. We will never share your organization's data or identity without your explicit written permission.*
