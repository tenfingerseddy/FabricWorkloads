# Fabric Observability KQL Community Query Pack

**25 production-ready KQL queries for monitoring Microsoft Fabric workloads.** Works with any Fabric Eventhouse -- no additional tooling, licenses, or dependencies required. Copy, paste, and run.

> **New here?** Jump to the [5-Minute Quickstart](./QUICKSTART.md) to run your first query in under 5 minutes.

---

## Why This Exists

The native Fabric monitoring hub has hard limits that make production observability difficult:

| Limitation | Impact |
|------------|--------|
| Shows only **100 activities** per view | Cannot see full execution history |
| **30-day retention** only | No long-term trend analysis or capacity planning |
| Keyword search queries **loaded data only**, not the full backend | Missing failures slip through |
| **No cross-item correlation** | Cannot trace pipeline -> notebook -> dataflow -> refresh chains |
| **No SLO framework** | No error budgets, no proactive breach detection |
| **No cost attribution** | Cannot identify which items waste the most compute |

Once you capture Fabric job events into an Eventhouse, these queries unlock the analysis that native monitoring cannot provide: workspace health scoring, duration regression detection, failure cascade investigation, cost attribution, SLO tracking with error budgets, and proactive "likely to breach" forecasting.

These queries are **completely free and open source** (MIT license). Use them as-is, modify them for your environment, or contribute new queries back to the community.

---

## What's Included

This repository contains multiple KQL query files organized by use case:

| File | Queries | Purpose |
|------|---------|---------|
| [`community-query-pack.kql`](./community-query-pack.kql) | 25 | **Start here.** Standalone, copy-paste-ready queries organized into 6 categories. Each query works independently. |
| [`dashboard-queries.kql`](./dashboard-queries.kql) | 7 | Core dashboard queries: success rates, duration trends, heatmaps, stale items |
| [`slo-queries.kql`](./slo-queries.kql) | 5 | SLO framework: success rate, duration, freshness, error budgets, CU waste |
| [`correlation-queries.kql`](./correlation-queries.kql) | 6 | Cross-item dependency analysis: pipeline chains, blast radius, partial failures |
| [`troubleshooting.kql`](./troubleshooting.kql) | 7 | Incident investigation: recent failures, anomaly detection, new failure patterns |
| [`create-tables.kql`](./create-tables.kql) | -- | Table creation script (run this first) |

The community query pack (`community-query-pack.kql`) is the primary file. All 25 queries work against a single `FabricEvents` table and require no other dependencies.

---

## Prerequisites

Before using these queries, you need:

1. **A Microsoft Fabric workspace** (any capacity: F2 and above)
2. **An Eventhouse with a KQL database** in that workspace
3. **A `FabricEvents` table** populated with job event data

That is it. No npm packages, no CLI tools, no backend services. Just KQL and your data.

### Capacity Requirements

These queries are lightweight. They run comfortably on any Fabric capacity (F2 and above). The Eventhouse itself requires at minimum an F2 SKU. For production monitoring with 90+ day retention, F64 or higher is recommended.

---

## Setup (Step by Step)

### Step 1: Create an Eventhouse

If you do not already have an Eventhouse:

1. Open your Fabric workspace in the browser
2. Click **+ New** in the top left
3. Select **Eventhouse** under Real-Time Intelligence
4. Name it (e.g., `EH_Observability`) and click **Create**
5. A KQL database is automatically created inside the Eventhouse

### Step 2: Create the FabricEvents Table

Open a **KQL queryset** connected to your Eventhouse database. You can create one by clicking **+ New > KQL Queryset** in your workspace.

Then run the table creation command. The minimum table for the community query pack is:

```kql
.create table FabricEvents (
    EventId: guid,
    WorkspaceId: guid,
    WorkspaceName: string,
    ItemId: guid,
    ItemName: string,
    ItemType: string,
    JobType: string,
    InvokeType: string,
    Status: string,
    FailureReason: string,
    RootActivityId: guid,
    StartTimeUtc: datetime,
    EndTimeUtc: datetime,
    DurationSeconds: real,
    CorrelationGroup: string,
    IngestedAt: datetime
)
```

For the full schema with all supporting tables (correlations, SLO definitions, alerts, etc.), run [`create-tables.kql`](./create-tables.kql) instead. But the single `FabricEvents` table is sufficient for all 25 community queries.

### Step 3: Populate the FabricEvents Table

You need to get Fabric job event data into the table. Here are three options, from quickest to most automated:

**Option A: Manual One-Time Load (quickest start, 5 minutes)**

Use the Fabric REST API to pull recent job instances. You can call this from PowerShell, Python, or any HTTP client:

```
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances
```

Then ingest the results into your Eventhouse using `.ingest inline` or the Kusto ingestion SDK. This is the fastest way to get data in and validate that the queries work against your environment.

**Option B: Scheduled Ingestion with a Fabric Notebook (recommended for ongoing use)**

Create a Fabric notebook that runs on a schedule (e.g., every 5-15 minutes) to:
- Enumerate workspaces and items via REST API
- Collect job instances for all item types
- Deduplicate against existing records
- Ingest into the Eventhouse via KQL

See our [NB_ObsIngestion notebook](../products/observability-workbench/notebooks/) for a production-ready example that handles all of this.

**Option C: Use the Observability Workbench CLI (full automation)**

```bash
npm install @kane-ai/observability-workbench
npx obs-workbench collect --workspace <id> --store kql
```

This handles workspace enumeration, item discovery, job collection, deduplication, and KQL ingestion in a single command.

### Step 4: Run Your First Query

1. Open your KQL queryset (connected to your Eventhouse database)
2. Copy **Query 1: Workspace Health Scorecard** from `community-query-pack.kql`
3. Paste it into the query editor
4. Click **Run**
5. You should see a table with workspace names, job counts, success rates, and letter grades

If you see results, everything is working. Proceed to explore the other 24 queries.

---

## Query Catalog

### Category 1: Health Overview

These queries give you a high-level picture of how your Fabric workloads are performing.

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 1 | **Workspace Health Scorecard** | Which workspaces need attention? Per-workspace success rate, volume, and letter grade (A-F). | 7 days |
| 2 | **Daily Job Success Trend** | Is reliability improving or degrading? One row per day with success/fail/cancel counts. Ideal for time-series charting. | 30 days |
| 3 | **Item Reliability Ranking** | Which items are most/least reliable? Every item ranked by success rate (minimum 3 runs to filter noise). | 14 days |

**Typical use case:** Run Query 1 first thing Monday morning to get a pulse on workspace health. Drill into Query 3 to identify specific items that need investigation.

### Category 2: Performance Analysis

These queries help you understand execution times, identify regressions, and find scheduling bottlenecks.

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 4 | **Duration Percentiles by Item** | What is the typical vs worst-case execution time? Full P50/P75/P90/P95/P99 breakdown per item. | 14 days |
| 5 | **Duration Regression Detection** | Has an item slowed down? Compares this week's P95 to a 4-week baseline. Ratio > 1.5 = regression. | 5 weeks |
| 6 | **Slowest Jobs Heatmap** | When do jobs compete for capacity? Average and P95 duration by hour-of-day and day-of-week. | 30 days |
| 7 | **Peak Concurrency Analysis** | Are we hitting CU throttling? Estimates max simultaneous running jobs per hour. | 7 days |

**Typical use case:** Run Query 5 weekly to catch regressions early. Use Query 6 to find scheduling hotspots and spread jobs across quieter time windows. Query 7 helps justify capacity upgrades.

### Category 3: Failure Investigation

These queries help you diagnose failures, find root causes, and measure recovery.

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 8 | **Top 10 Failure Reasons** | What errors occur most? Grouped by error message with item count and types affected. Fix the top entries first. | 30 days |
| 9 | **Failure Cascade Detection** | Was this a shared-cause outage? Finds 10-minute windows where 3+ items failed together (capacity throttle, source down). | 14 days |
| 10 | **Mean Time to Recovery** | How fast do items recover after failure? Pairs failed runs with next success and calculates MTTR. | 30 days |
| 11 | **Intermittent Failure Detection** | Which items are flapping? Identifies items that alternate between success and failure unpredictably (3+ flips in 14 days). | 14 days |

**Typical use case:** When a failure is reported, start with Query 8 to see if it is a known pattern. Query 9 tells you whether it was an isolated failure or part of a cascade. Query 10 shows whether your retry/alerting is recovering fast enough.

### Category 4: Cost Intelligence

These queries estimate compute costs and identify optimization opportunities. All cost estimates use configurable per-CU-second pricing (default: F64 at $0.0032/CU-second).

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 12 | **CU Waste Score** | Where are we burning CUs for nothing? Quantifies waste from retries, duration regression, and duplicate triggers. | 7 days |
| 13 | **Monthly Cost per Item** | What does each item cost to run? Projects monthly compute cost from actual duration and run frequency. | 14 days |
| 14 | **Cost Trend (Week-over-Week)** | Is spend increasing? Total estimated cost per week with week-over-week change percentage. | 8 weeks |
| 15 | **Top 5 Cost Optimization Opportunities** | Where should we focus optimization? Combines cost, regression, failure rate, and frequency signals into a ranked list with actionable insights. | 5 weeks |

**Typical use case:** Run Query 15 monthly to identify the highest-impact optimization targets. Use Query 12 to quantify how much retries and regressions are costing you. Share Query 14 trends with your manager to justify optimization work.

### Category 5: SLO Framework

These queries implement a complete service level objective (SLO) framework with error budgets. No external tooling required -- just KQL.

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 16 | **Success Rate SLO with Error Budgets** | Are we meeting our success rate SLO? Shows error budget consumption per item (>80% = needs attention, >100% = breaching). | 7 days |
| 17 | **Freshness SLO** | Is data stale? Hours since last successful completion per item, measured against configurable freshness targets by item type. | All time |
| 18 | **Duration SLO with Regression Multiplier** | Are items running too slowly? Self-calibrating SLO based on each item's own P95 history. No fixed thresholds to maintain. | 5 weeks |
| 19 | **Combined SLO Summary** | Single-pane view: success + freshness + duration SLOs per item with overall CRITICAL / AT_RISK / OK status. Pin this to your dashboard. | Varies |
| 20 | **Error Budget Burn Rate Forecast** | When will the error budget run out? Projects hours until exhaustion at current burn rate. Items with <24h remaining need immediate action. | 7 days |

**Typical use case:** Pin Query 19 to your operations dashboard for a single-pane health view. Set up Query 20 as a daily check to catch items trending toward breach before they actually breach. Use Query 16 in weekly reviews to track SLO compliance.

### Category 6: Operations Intelligence

These queries provide deeper operational insights for platform teams.

| # | Query Name | What It Answers | Lookback |
|---|-----------|----------------|----------|
| 21 | **Workspace Comparison** | Which environment is healthiest? Side-by-side metrics across workspaces (dev/test/prod comparison). | 7 days |
| 22 | **Job Execution Gaps** | Did a scheduled job miss its window? Compares gap since last run to historical average interval. CRITICAL/OVERDUE/LATE classification. | 14 days |
| 23 | **Retry Effectiveness** | Are retries working or wasting CUs? For items with failures followed by runs within 30 minutes, measures retry success rate. | 7 days |
| 24 | **Item Dependency Map** | What are the undocumented dependencies? Temporal co-occurrence detection: items that consistently start within 5 minutes of each other. Confidence rated HIGH/MEDIUM/LOW. | 7 days |
| 25 | **Weekly Executive Summary** | Single-row weekly summary: total jobs, success rate, worst-performing item, busiest day, estimated CU-hours. Copy-paste into Teams or email. | 7 days |

**Typical use case:** Run Query 22 to catch silently-stopped schedules. Query 24 is invaluable for understanding dependencies that are not documented anywhere. Use Query 25 for the weekly status email to leadership.

---

## FabricEvents Table Schema

All 25 queries work against this single table:

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | guid | Unique job instance identifier |
| `WorkspaceId` | guid | Fabric workspace ID |
| `WorkspaceName` | string | Human-readable workspace name |
| `ItemId` | guid | Fabric item ID |
| `ItemName` | string | Human-readable item name |
| `ItemType` | string | `DataPipeline`, `Notebook`, `Dataflow`, `SemanticModel`, `CopyJob`, etc. |
| `JobType` | string | Job type from monitoring hub (e.g., `Pipeline`, `RunNotebook`) |
| `InvokeType` | string | `Scheduled`, `Manual`, `API` |
| `Status` | string | `Completed`, `Failed`, `Cancelled`, `InProgress` |
| `FailureReason` | string | Error message (empty on success) |
| `RootActivityId` | guid | Shared ID linking related operations in a chain |
| `StartTimeUtc` | datetime | Job start timestamp |
| `EndTimeUtc` | datetime | Job end timestamp |
| `DurationSeconds` | real | Execution duration in seconds |
| `CorrelationGroup` | string | Custom correlation grouping (optional) |
| `IngestedAt` | datetime | When the record was written to the Eventhouse |

---

## Customization Guide

Every query is designed to be modified for your environment. Here are the most common adjustments.

### Adjusting Time Windows

Most queries use 7-day or 14-day lookback windows. To analyze longer history, change `ago(7d)` to `ago(30d)` or `ago(90d)`. Baseline comparisons (used by regression and SLO queries) use a 4-week window (28 days before the evaluation window).

```kql
// Default: 7 days
| where StartTimeUtc > ago(7d)

// Extended: 30 days
| where StartTimeUtc > ago(30d)

// Extended: 90 days (requires corresponding retention in your Eventhouse)
| where StartTimeUtc > ago(90d)
```

### Adjusting SLO Targets

The default SLO target is 99.5% success rate. To change it per item, modify the `SloTarget` value in Query 16, or create a lookup table and join against it:

```kql
// Example: custom SLO targets per item
let CustomTargets = datatable(ItemName: string, CustomSloTarget: real) [
    "PL_CriticalPipeline", 99.9,
    "NB_ExperimentalJob", 95.0,
    "PL_DailyReport", 99.0
];
// Then join: | join kind=leftouter CustomTargets on ItemName
// And use: | extend SloTarget = coalesce(CustomSloTarget, 99.5)
```

### Adjusting Freshness Targets

Modify the `FreshnessTargetHours` case statement in Query 17 to match your business SLAs:

| Use Case | Recommended Target |
|----------|--------------------|
| Real-time dashboards | 1-2 hours |
| Intra-day reports | 4-6 hours |
| Daily batch ETL | 24 hours |
| Weekly summaries | 168 hours |

```kql
// Example: tighter freshness for critical pipelines
| extend FreshnessTargetHours = case(
    ItemName startswith "PL_Critical", 4.0,    // 4-hour freshness for critical pipelines
    ItemType == "DataPipeline",         24.0,
    ItemType == "Notebook",             6.0,
    ItemType == "Dataflow",             12.0,
    ItemType == "SemanticModel",        24.0,
    48.0
)
```

### Adjusting Cost Estimates

Cost queries use F64 pricing by default ($11.52/hr = $0.0032/CU-second). Update the `CU_RATE` variable for your SKU:

| SKU | Hourly Rate | CU_RATE (per CU-second) |
|-----|-------------|-------------------------|
| F2  | $0.36/hr    | $0.0001 |
| F4  | $0.72/hr    | $0.0002 |
| F8  | $1.44/hr    | $0.0004 |
| F16 | $2.88/hr    | $0.0008 |
| F32 | $5.76/hr    | $0.0016 |
| F64 | $11.52/hr   | $0.0032 |
| F128 | $23.04/hr  | $0.0064 |

```kql
// Change this line at the top of Queries 12, 13, 14, 15:
let CU_RATE = 0.0032;   // F64 default
let CU_RATE = 0.0016;   // Use this for F32
let CU_RATE = 0.0064;   // Use this for F128
```

### Filtering by Workspace or Item Type

To narrow any query to a specific workspace or item type, add a `where` clause after the initial `FabricEvents` line:

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| where WorkspaceName == "Production"         // Filter to one workspace
| where ItemType in ("DataPipeline", "Notebook")  // Filter to specific item types
// ... rest of query
```

### Adjusting Status Values

These queries use `"Completed"` to match the Fabric REST API. If your ingestion pipeline normalizes differently (e.g., `"Succeeded"` from the monitoring hub UI), update the Status filters:

```kql
// If your data uses "Succeeded" instead of "Completed":
| where Status in ("Succeeded", "Failed", "Cancelled")
// instead of:
| where Status in ("Completed", "Failed", "Cancelled")
```

---

## Expected Output Examples

### Query 1: Workspace Health Scorecard

```
WorkspaceName      | TotalJobs | Succeeded | Failed | Cancelled | SuccessRate | AvgDurationSec | UniqueItems | Grade
Production         | 1240      | 1222      | 14     | 4         | 98.5        | 142            | 28          | B
Staging            | 310       | 270       | 34     | 6         | 87.1        | 204            | 15          | C
Development        | 88        | 86        | 2      | 0         | 97.7        | 45             | 12          | B
```

### Query 5: Duration Regression Detection

```
ItemName         | ItemType     | WorkspaceName | BaselineP95 | CurrentP95 | DurationRatio | Regression
NB_HeavyETL     | Notebook     | Production    | 180         | 420        | 2.33          | true
PL_DailyIngest  | DataPipeline | Production    | 300         | 310        | 1.03          | false
```

### Query 19: Combined SLO Summary

```
ItemName         | ItemType     | WorkspaceName | SuccessRate | SuccessStatus | FinalFreshness | FinalDuration | OverallStatus
PL_BrokenPipe   | DataPipeline | Production    | 85.0        | BREACHING     | STALE          | OK            | CRITICAL
NB_SlowJob      | Notebook     | Production    | 99.2        | OK            | FRESH          | BREACHING     | AT_RISK
PL_HealthyETL   | DataPipeline | Production    | 100.0       | OK            | FRESH          | OK            | OK
```

### Query 20: Error Budget Burn Rate Forecast

```
ItemName        | ItemType     | WorkspaceName | Runs | Failed | BudgetUsedPct | BurnRatePerDay | ExhaustedInHours | Urgency
PL_Fragile      | DataPipeline | Production    | 42   | 3      | 1428.6        | 204.1          | -                | EXHAUSTED
NB_Intermittent | Notebook     | Production    | 28   | 1      | 714.3         | 102.0          | -                | EXHAUSTED
PL_MostlyOK     | DataPipeline | Staging       | 56   | 1      | 357.1         | 51.0           | 24.0             | CRITICAL
```

---

## Screenshots

> Screenshots will be added showing each query category rendered in a KQL queryset.

**Workspace Health Scorecard**
<!-- ![Health Scorecard](./screenshots/health-scorecard.png) -->
*Letter-graded workspace summary with success rates and job counts.*

**Daily Success Trend**
<!-- ![Success Trend](./screenshots/success-trend.png) -->
*30-day time-series chart showing daily success rate and job volume.*

**Duration Regression**
<!-- ![Duration Regression](./screenshots/duration-regression.png) -->
*Table showing items with P95 duration ratio exceeding baseline.*

**Failure Cascade Detection**
<!-- ![Failure Cascade](./screenshots/failure-cascade.png) -->
*Timeline view of clustered failures within 10-minute windows.*

**CU Waste Score**
<!-- ![CU Waste](./screenshots/cu-waste.png) -->
*Stacked bar chart showing retry, duration, and duplicate waste per item.*

**Combined SLO Summary**
<!-- ![SLO Summary](./screenshots/slo-summary.png) -->
*Traffic-light table with success, freshness, and duration status per item.*

**Error Budget Burn Rate**
<!-- ![Budget Forecast](./screenshots/budget-forecast.png) -->
*Table with projected hours until budget exhaustion per item.*

---

## Limitations and Known Issues

- **Cost estimates are approximations.** CU consumption varies by workload type, parallelism, data volume, and Spark/SQL engine behavior. The queries use a flat per-second rate which overestimates some workloads (lightweight notebooks) and underestimates others (memory-intensive Spark). Use the [Fabric Capacity Metrics app](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app) for billing-accurate numbers.

- **Concurrency estimation (Query 7) is approximate.** True concurrency requires start/end overlap analysis, which is computationally expensive on large datasets. The estimation uses average duration per hour bucket, which is directionally correct but not exact.

- **Correlation depends on time-window proximity.** Without explicit correlation IDs from Fabric, cross-item correlation (Query 24) relies on temporal overlap -- items starting within a short window of each other. This can produce false positives in workspaces with many concurrent, unrelated pipelines.

- **Status terminology.** Fabric uses `"Completed"` for success in the Jobs REST API, but `"Succeeded"` in some monitoring hub views. These queries use `"Completed"` to match the REST API. If your ingestion normalizes differently, adjust the Status filter values (see Customization Guide above).

- **SLO error budget math assumes uniform distribution.** The burn rate forecast (Query 20) assumes the failure rate continues at the same pace. Bursty failure patterns (e.g., a bad deploy on Wednesday) will skew the projection.

---

## Want More? Observability Workbench

These queries give you powerful ad-hoc analysis. If you want **continuous, automated observability** for your Fabric environment, check out the [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- a Fabric-native observability tool that builds on these same patterns:

| Feature | Query Pack (Free) | Observability Workbench |
|---------|-------------------|------------------------|
| Ad-hoc KQL queries | 25 queries | 50+ queries |
| Automated data ingestion | Manual / BYO notebook | Automated (every 5 min) |
| Data retention | Your Eventhouse config | 90-day / 365-day managed |
| Cross-item correlation | Temporal co-occurrence (Query 24) | Correlation engine with dependency graphs |
| SLO tracking | Point-in-time queries (16-20) | Continuous tracking with historical trends |
| Alerting | None (manual monitoring) | Proactive alerts via Teams, email, webhooks |
| Dashboards | KQL queryset results | Purpose-built Fabric workload UI |
| Cost tracking | Estimated (Queries 12-15) | Integrated with Capacity Metrics |

**Free tier available** -- 1 workspace, 7-day retention, 5 SLOs. No credit card required.

```bash
npm install @kane-ai/observability-workbench
```

---

## Related Resources

- [Fabric Monitoring Hub documentation](https://learn.microsoft.com/en-us/fabric/admin/monitoring-hub)
- [Fabric REST API -- Job Scheduler](https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler)
- [Eventhouse and KQL overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [KQL quick reference](https://learn.microsoft.com/en-us/kusto/query/kql-quick-reference)
- [Fabric Capacity Metrics app](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app)
- [Observability Workbench on GitHub](https://github.com/tenfingerseddy/FabricWorkloads)

---

## Contributing

We welcome community contributions. Here is how to add a new query:

### Adding a New Query

1. **Fork** the repository and create a branch
2. Add your query to `community-query-pack.kql` in the appropriate category (or propose a new category)
3. Follow the existing format:
   - A comment block header with the query name
   - A plain-English description of what the query does and why it is useful
   - Sample output showing expected columns and example values
   - The KQL query itself, fully self-contained (no external dependencies)
4. Test the query against real data (or at minimum, verify it parses without errors)
5. Update this README with a one-line description in the Query Catalog section
6. Open a pull request with a description of the use case your query addresses

### Query Style Guidelines

- Every query must be **self-contained** and **copy-paste ready** -- no dependencies on other queries
- Include a **sample output** comment showing expected columns and realistic example data
- Use **descriptive column names** (e.g., `SuccessRate` not `sr`, `AvgDurationSec` not `d`)
- Use `round()` on all numeric outputs for readability
- Include a `| order by` clause so results are sorted meaningfully by default
- Set sensible default lookback windows (7d for operational queries, 14d for analysis, 30d for trends)
- Add `| where` filters to exclude noise (e.g., minimum run counts, non-zero durations)

### Reporting Issues

Found a bug in a query? Have a suggestion? [Open an issue](https://github.com/tenfingerseddy/FabricWorkloads/issues) with:

- The query number and name
- Your Fabric environment (SKU, region)
- The error message or unexpected behavior
- Your table schema if it differs from the standard

---

## License

MIT -- use freely, attribution appreciated.

Part of the [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) project.
