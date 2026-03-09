# Fabric Observability KQL Query Pack

A collection of production-ready KQL queries for monitoring Microsoft Fabric workloads. Works with any Fabric Eventhouse -- no additional tooling required.

**Why this exists:** The Fabric monitoring hub shows only 100 activities from the last 30 days, with keyword search limited to loaded data. Once you capture events into an Eventhouse, these queries unlock the analysis that native monitoring cannot provide: full-text failure search, duration regression detection, cost attribution, SLO tracking, and cascade failure investigation.

## What's Included

| File | Queries | Purpose |
|------|---------|---------|
| `community-query-pack.kql` | 25 | **Start here.** Standalone, copy-paste-ready queries organized by category. Designed for sharing and independent use. |
| `dashboard-queries.kql` | 7 | Core dashboard: success rates, duration trends, heatmaps, stale items |
| `slo-queries.kql` | 5 | SLO framework: success rate, duration, freshness, error budgets, CU waste |
| `correlation-queries.kql` | 6 | Cross-item dependency analysis: pipeline chains, blast radius, partial failures |
| `troubleshooting.kql` | 7 | Incident investigation: recent failures, anomaly detection, new failure patterns |
| `create-tables.kql` | -- | Table creation script (run first) |

## Prerequisites

1. A **Microsoft Fabric workspace** with an **Eventhouse** and **KQL database**
2. The `FabricEvents` table created in your KQL database (see setup below)
3. Job event data ingested into the table (from Fabric REST APIs or workspace monitoring)

### Capacity Requirements

These queries are lightweight. They work on any Fabric capacity (F2 and above). The Eventhouse itself requires at minimum an F2 SKU. For production monitoring with 90+ day retention, an F64 or higher is recommended.

## Setup

### Step 1: Create the Tables

Open a KQL queryset connected to your Eventhouse database and run `create-tables.kql`. This creates six tables:

```
FabricEvents          -- Core event store (all job instances)
EventCorrelations     -- Cross-item dependency links
SloDefinitions        -- SLO target definitions
SloSnapshots          -- Point-in-time SLO measurements
WorkspaceInventory    -- Item inventory cache
AlertLog              -- Alert history
```

The minimum table for the community query pack is `FabricEvents`. All 25 queries work against this single table.

### Step 2: Populate the FabricEvents Table

You need to get job event data into the table. Options:

**Option A: Manual one-time load (quickest start)**

Use the Fabric REST API to pull recent jobs and ingest via KQL `.ingest inline`:

```
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances
```

**Option B: Scheduled ingestion with a Fabric notebook**

See our [NB_ObsIngestion notebook](../products/observability-workbench/notebooks/) which automates:
- Workspace enumeration
- Item discovery
- Job instance collection for all item types
- Deduplication and KQL ingestion

**Option C: Use the Observability Workbench CLI**

```bash
npm install @kane-ai/observability-workbench
npx obs-workbench collect --workspace <id> --store kql
```

### FabricEvents Table Schema

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

## Community Query Pack -- Query Reference

### Category 1: Health Overview

**Query 1 -- Workspace Health Scorecard**
Per-workspace success rate, average duration, job volume, and letter grade (A through F). A single-glance view of which workspaces need attention. Lookback: 7 days.

**Query 2 -- Daily Job Success Trend**
One row per day for the last 30 days with total, succeeded, failed, and cancelled counts plus success rate percentage. Ideal for a time-series line chart.

**Query 3 -- Item Reliability Ranking**
Every item ranked by success rate over the last 14 days. Items with fewer than 3 runs are excluded. Use this to identify your most and least reliable jobs.

### Category 2: Performance Analysis

**Query 4 -- Duration Percentiles by Item**
Full percentile breakdown (P50, P75, P90, P95, P99) for every item. Only includes completed runs. Answers "what is the typical vs worst-case execution time?"

**Query 5 -- Duration Regression Detection**
Compares this week's P95 against a 4-week baseline. A ratio > 1.5 means the item runs 50%+ slower than historical norm. Requires at least 5 baseline runs and 3 current runs to avoid noise.

**Query 6 -- Slowest Jobs Heatmap**
Average and P95 duration by hour-of-day and day-of-week. Reveals scheduling hotspots where jobs compete for capacity. Day 0 = Sunday.

**Query 7 -- Peak Concurrency Analysis**
Estimates maximum simultaneous running jobs per hour. High concurrency on smaller capacities (F2-F64) correlates with CU throttling and longer queue times.

### Category 3: Failure Investigation

**Query 8 -- Top 10 Most Common Failure Reasons**
Groups failures by error message with occurrence count, affected item count, and item types. Fix the top entries first for maximum reliability improvement.

**Query 9 -- Failure Cascade Detection**
Finds 10-minute windows where 3+ distinct items failed in the same workspace. This pattern indicates shared-cause outages (capacity throttle, source system down) rather than independent failures.

**Query 10 -- Mean Time to Recovery (MTTR)**
For each item, pairs failed runs with the next successful run and calculates average recovery time. Lower MTTR = faster recovery loop. High MTTR items need auto-retry or escalation procedures.

**Query 11 -- Intermittent Failure Detection (Flapping)**
Identifies items that alternate between success and failure frequently. A high "flip count" signals instability that is harder to diagnose than consistent failures. Items with 3+ flips in 14 days are flagged.

### Category 4: Cost Intelligence

**Query 12 -- CU Waste Score per Item**
Quantifies compute waste from three sources: retry waste (failed runs), duration waste (regression), and duplicate waste (double-triggered runs). Uses F64 pricing ($0.0032/CU-second) for dollar estimates.

**Query 13 -- Estimated Monthly Cost per Item**
Projects each item's monthly compute cost based on actual duration and run frequency over the last 14 days. Approximation based on F64 pricing -- use Fabric Capacity Metrics app for exact numbers.

**Query 14 -- Cost Trend (Week-over-Week)**
Total estimated compute cost per week with week-over-week percentage change. A rising trend means more runs, longer durations, or both.

**Query 15 -- Top 5 Cost Optimization Opportunities**
Combines cost signals (high spend, duration regression, high failure rate, excessive frequency) into a ranked list with actionable insights for each item. Prioritizes by dollar impact.

### Category 5: SLO Framework

**Query 16 -- Success Rate SLO with Error Budgets**
Evaluates each item against a configurable success rate SLO (default 99.5%). Shows error budget consumption percentage. Items above 80% budget need proactive attention.

**Query 17 -- Freshness SLO**
Measures hours since last successful completion per item. Freshness targets are set by item type (24h for pipelines, 6h for notebooks, etc.). A "STALE" item means downstream consumers see old data.

**Query 18 -- Duration SLO with Regression Multiplier**
Self-calibrating duration SLO based on each item's own historical P95. Flags items where current P95 exceeds the baseline by a configurable multiplier (default 2.0x).

**Query 19 -- Combined SLO Summary**
Single-pane view combining success rate, freshness, and duration SLOs. Each item gets an overall status (CRITICAL / AT_RISK / OK) for operations dashboard pinning.

**Query 20 -- Error Budget Burn Rate Forecast**
Projects when each item's error budget will be exhausted at the current burn rate. Items with "ExhaustedInHours" < 24 need immediate attention. This is the proactive "likely to breach" early warning.

### Category 6: Operations Intelligence

**Query 21 -- Workspace Comparison**
Side-by-side health metrics across workspaces: total jobs, success rate, average duration, failures. Identifies which environments need attention. Useful for dev/test/prod comparison.

**Query 22 -- Job Execution Gaps**
Detects items that have missed their expected scheduled window. Compares the gap between the last run and the historical average interval. CRITICAL = 3x overdue, OVERDUE = 2x, LATE = 1.5x.

**Query 23 -- Retry Effectiveness**
Measures whether retries are actually recovering or just wasting CUs. For items with failures followed by runs within 30 minutes, calculates the retry success rate and counts wasted retries.

**Query 24 -- Item Dependency Map**
Temporal co-occurrence detection. Finds items that consistently start within 5 minutes of each other in the same workspace, suggesting undocumented dependency relationships. Confidence rated HIGH/MEDIUM/LOW.

**Query 25 -- Weekly Executive Summary**
Single-row summary for weekly reports: total jobs, success rate, worst-performing item, busiest day, and estimated CU-hours. Copy-paste into a Teams message or email.

## Customization Guide

### Adjusting SLO Targets

The default SLO target is 99.5% success rate. To change it per item, modify the `SloTarget` value in Query 16, or create a `SloDefinitions` table and join against it:

```kql
// Example: custom SLO targets
let CustomTargets = datatable(ItemName: string, CustomSloTarget: real) [
    "PL_CriticalPipeline", 99.9,
    "NB_ExperimentalJob", 95.0,
    "PL_DailyReport", 99.0
];
// Then join: | join kind=leftouter CustomTargets on ItemName
// And use: extend SloTarget = coalesce(CustomSloTarget, 99.5)
```

### Adjusting Freshness Targets

Modify the `FreshnessTargetHours` case statement in Query 17 to match your business SLAs. Common patterns:

- Real-time dashboards: 1-2 hours
- Daily reports: 24 hours
- Weekly summaries: 168 hours

### Adjusting Cost Estimates

The queries use F64 pricing ($11.52/hr = $0.0032/CU-second). Adjust the `CU_RATE` variable for your SKU:

| SKU | Hourly Rate | CU_RATE |
|-----|------------|---------|
| F2  | $0.36/hr   | $0.0001 |
| F4  | $0.72/hr   | $0.0002 |
| F8  | $1.44/hr   | $0.0004 |
| F16 | $2.88/hr   | $0.0008 |
| F32 | $5.76/hr   | $0.0016 |
| F64 | $11.52/hr  | $0.0032 |
| F128| $23.04/hr  | $0.0064 |

### Time Windows

Most queries use 7-day or 14-day lookback windows. For longer history analysis, change `ago(7d)` to `ago(30d)` or `ago(90d)`. Baseline comparisons use a 4-week window (28 days before the evaluation window).

## Screenshots

> Screenshots will be added showing each query category rendered in a KQL queryset.

**Workspace Health Scorecard**
<!-- ![Health Scorecard](./screenshots/health-scorecard.png) -->
*Placeholder: Letter-graded workspace summary with success rates and job counts.*

**Daily Success Trend**
<!-- ![Success Trend](./screenshots/success-trend.png) -->
*Placeholder: 30-day time-series chart showing daily success rate and job volume.*

**Duration Regression**
<!-- ![Duration Regression](./screenshots/duration-regression.png) -->
*Placeholder: Table showing items with P95 duration ratio exceeding baseline.*

**Failure Cascade Detection**
<!-- ![Failure Cascade](./screenshots/failure-cascade.png) -->
*Placeholder: Timeline view of clustered failures within 10-minute windows.*

**CU Waste Score**
<!-- ![CU Waste](./screenshots/cu-waste.png) -->
*Placeholder: Stacked bar chart showing retry, duration, and duplicate waste per item.*

**Combined SLO Summary**
<!-- ![SLO Summary](./screenshots/slo-summary.png) -->
*Placeholder: Traffic-light table with success, freshness, and duration status per item.*

**Error Budget Burn Rate**
<!-- ![Budget Forecast](./screenshots/budget-forecast.png) -->
*Placeholder: Table with projected hours until budget exhaustion per item.*

## Limitations and Known Issues

- **Cost estimates are approximations.** CU consumption varies by workload type, parallelism, data volume, and Spark/SQL engine behavior. The queries use a flat per-second rate which overestimates some workloads (lightweight notebooks) and underestimates others (memory-intensive Spark). Use the Fabric Capacity Metrics app for billing-accurate numbers.

- **Concurrency estimation (Query 7) is approximate.** True concurrency requires start/end overlap analysis, which is computationally expensive on large datasets. The estimation uses average duration per hour bucket.

- **Correlation depends on time-window proximity.** Without explicit correlation IDs from Fabric, cross-item correlation relies on temporal overlap (items starting within the parent pipeline's time window). This can produce false positives in workspaces with many concurrent pipelines.

- **Status terminology.** Fabric uses "Completed" for success in the jobs API, but "Succeeded" in some monitoring hub views. These queries use "Completed" to match the REST API. If your ingestion normalizes differently, adjust the Status filter values.

## Related Resources

- [Fabric Monitoring Hub documentation](https://learn.microsoft.com/en-us/fabric/admin/monitoring-hub)
- [Fabric REST API -- Job Scheduler](https://learn.microsoft.com/en-us/rest/api/fabric/core/job-scheduler)
- [Eventhouse and KQL overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [Observability Workbench on GitHub](https://github.com/tenfingerseddy/FabricWorkloads)

## Contributing

Found a bug? Have a useful query to add? Open an issue or PR at [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads).

## License

MIT -- use freely, attribution appreciated.
