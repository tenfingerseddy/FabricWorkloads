# 5-Minute Quickstart: Fabric Observability KQL Queries

Get useful insights from your Fabric workloads in under 5 minutes. All you need is a Fabric Eventhouse with job event data in a `FabricEvents` table.

> **Do not have a FabricEvents table yet?** See the [full README](./README.md#setup-step-by-step) for setup instructions.

---

## How to Run These Queries

1. Open your **Fabric workspace** in the browser
2. Open (or create) a **KQL queryset** connected to your Eventhouse database
3. Copy any query below and paste it into the query editor
4. Click **Run** (or press Shift+Enter)

Each query is self-contained. No setup, no variables, no dependencies between queries.

---

## Query 1: Workspace Health Scorecard

**What it does:** Grades each workspace A through F based on job success rate over the past 7 days. One glance tells you which workspaces need attention.

**When to use it:** First thing Monday morning, or any time you want a quick pulse check.

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status in ("Completed", "Failed", "Cancelled")
| summarize
    TotalJobs      = count(),
    Succeeded      = countif(Status == "Completed"),
    Failed         = countif(Status == "Failed"),
    Cancelled      = countif(Status == "Cancelled"),
    AvgDurationSec = round(avg(DurationSeconds), 0),
    UniqueItems    = dcount(ItemId)
    by WorkspaceId, WorkspaceName
| extend SuccessRate = round(todouble(Succeeded) / TotalJobs * 100, 1)
| extend Grade = case(
    SuccessRate >= 99.0, "A",
    SuccessRate >= 95.0, "B",
    SuccessRate >= 90.0, "C",
    SuccessRate >= 80.0, "D",
    "F"
)
| project WorkspaceName, TotalJobs, Succeeded, Failed, Cancelled, SuccessRate, AvgDurationSec, UniqueItems, Grade
| order by SuccessRate asc
```

**Expected output:**

```
WorkspaceName      | TotalJobs | Succeeded | Failed | SuccessRate | Grade
Production         | 1240      | 1222      | 14     | 98.5        | B
Staging            | 310       | 270       | 34     | 87.1        | C
Development        | 88        | 86        | 2      | 97.7        | B
```

---

## Query 2: Top 10 Failure Reasons

**What it does:** Groups all failures from the past 30 days by error message and ranks them by frequency. Shows how many distinct items are affected and which item types.

**When to use it:** When investigating reliability issues. Fix the top entries first for maximum impact.

```kql
FabricEvents
| where StartTimeUtc > ago(30d)
| where Status == "Failed"
| where isnotempty(FailureReason)
| summarize
    Count         = count(),
    AffectedItems = dcount(ItemId),
    ItemTypes     = make_set(ItemType),
    Workspaces    = make_set(WorkspaceName),
    LastSeen      = max(StartTimeUtc)
    by FailureReason
| order by Count desc
| take 10
```

**Expected output:**

```
FailureReason                        | Count | AffectedItems | ItemTypes              | LastSeen
SparkSessionTimeout                  | 34    | 3             | ["Notebook"]           | 2026-03-09 14:22
RefreshFailed_DataSourceError        | 12    | 2             | ["SemanticModel"]      | 2026-03-08 06:15
PipelineActivityFailed               | 8     | 4             | ["DataPipeline"]       | 2026-03-09 02:30
```

---

## Query 3: Freshness SLO (Is My Data Stale?)

**What it does:** For every item, shows how many hours since its last successful completion. Compares that to a configurable freshness target by item type. Items marked STALE or CRITICAL mean downstream consumers are looking at old data.

**When to use it:** Any time a business user asks "why is my report showing yesterday's data?"

```kql
FabricEvents
| where Status == "Completed"
| summarize LastSuccess = max(EndTimeUtc) by ItemId, ItemName, ItemType, WorkspaceName
| extend HoursSinceSuccess = round(datetime_diff('second', now(), LastSuccess) / 3600.0, 1)
| extend FreshnessTargetHours = case(
    ItemType == "DataPipeline",    24.0,
    ItemType == "Notebook",        6.0,
    ItemType == "Dataflow",        12.0,
    ItemType == "SemanticModel",   24.0,
    ItemType == "CopyJob",         24.0,
    48.0
)
| extend FreshnessStatus = case(
    HoursSinceSuccess > FreshnessTargetHours * 2, "CRITICAL",
    HoursSinceSuccess > FreshnessTargetHours,     "STALE",
    HoursSinceSuccess > FreshnessTargetHours * 0.8, "AT_RISK",
    "FRESH"
)
| project ItemName, ItemType, WorkspaceName, LastSuccess, HoursSinceSuccess, FreshnessTargetHours, FreshnessStatus
| order by case(FreshnessStatus == "CRITICAL", 0, FreshnessStatus == "STALE", 1, FreshnessStatus == "AT_RISK", 2, 3) asc, HoursSinceSuccess desc
```

**Expected output:**

```
ItemName            | ItemType     | WorkspaceName | LastSuccess          | HoursSince | Target | FreshnessStatus
PL_DailyRefresh     | DataPipeline | Production    | 2026-03-08 02:15     | 50.3       | 24.0   | CRITICAL
NB_TransformRaw     | Notebook     | Production    | 2026-03-09 22:10     | 8.1        | 6.0    | STALE
PL_HourlyIngest     | DataPipeline | Staging       | 2026-03-10 04:45     | 1.5        | 24.0   | FRESH
```

**Customize:** Edit the `FreshnessTargetHours` case statement to match your business SLAs. For example, set critical pipelines to 4 hours instead of 24.

---

## Query 4: Duration Regression Detection

**What it does:** Compares this week's P95 execution time to a 4-week baseline for every item. A ratio above 1.5 means the item is running 50% slower than normal. A ratio above 2.0 is a serious regression worth investigating.

**When to use it:** Weekly performance review. Catches items that have silently slowed down before users complain.

```kql
let BaselineWindow = FabricEvents
| where StartTimeUtc between (ago(35d) .. ago(7d))
| where Status == "Completed" and DurationSeconds > 0
| summarize BaselineP95 = percentile(DurationSeconds, 95), BaselineRuns = count() by ItemId;
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Completed" and DurationSeconds > 0
| summarize CurrentP95 = percentile(DurationSeconds, 95), CurrentRuns = count() by ItemId, ItemName, ItemType, WorkspaceName
| join kind=inner BaselineWindow on ItemId
| where BaselineRuns >= 5 and CurrentRuns >= 3
| extend DurationRatio = round(CurrentP95 / BaselineP95, 2)
| extend Regression = DurationRatio > 1.5
| project ItemName, ItemType, WorkspaceName, BaselineP95 = round(BaselineP95, 0), CurrentP95 = round(CurrentP95, 0), DurationRatio, Regression, BaselineRuns, CurrentRuns
| order by DurationRatio desc
```

**Expected output:**

```
ItemName         | ItemType     | BaselineP95 | CurrentP95 | DurationRatio | Regression
NB_HeavyETL     | Notebook     | 180         | 420        | 2.33          | true
PL_MasterOrch   | DataPipeline | 300         | 380        | 1.27          | false
PL_DailyIngest  | DataPipeline | 60          | 65         | 1.08          | false
```

**Investigate regressions:** For items with `Regression = true`, check recent code changes, data volume growth, or Spark configuration changes. Duration regressions often indicate a growing dataset that needs partition pruning or a config change that disabled parallelism.

---

## Query 5: Weekly Executive Summary

**What it does:** Produces a single row with the week's key metrics: total jobs, success rate, worst-performing item, busiest day, and estimated CU-hours. Designed to be copy-pasted into a Teams message or email.

**When to use it:** Friday afternoon, for the weekly status report.

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| summarize
    TotalJobs = count(),
    Succeeded = countif(Status == "Completed"),
    Failed = countif(Status == "Failed"),
    TotalDurationMs = sum(datetime_diff("millisecond", EndTimeUtc, StartTimeUtc))
| extend SuccessRate = round(todouble(Succeeded) / TotalJobs * 100, 1)
| extend EstCuHours = round(todouble(TotalDurationMs) / 3600000.0, 1)
| join kind=leftouter (
    FabricEvents
    | where StartTimeUtc > ago(7d)
    | where Status == "Failed"
    | summarize FailCount = count() by ItemName
    | top 1 by FailCount desc
    | project WorstItem = ItemName
) on $left.TotalJobs == $left.TotalJobs
| join kind=leftouter (
    FabricEvents
    | where StartTimeUtc > ago(7d)
    | extend DayOfWeek = dayofweek(StartTimeUtc)
    | summarize DayCount = count() by DayOfWeek
    | top 1 by DayCount desc
    | extend BusiestDay = case(
        DayOfWeek == 0d, "Sunday",
        DayOfWeek == 1d, "Monday",
        DayOfWeek == 2d, "Tuesday",
        DayOfWeek == 3d, "Wednesday",
        DayOfWeek == 4d, "Thursday",
        DayOfWeek == 5d, "Friday",
        "Saturday"
      )
    | project BusiestDay
) on $left.TotalJobs == $left.TotalJobs
| project TotalJobs, SuccessRate, Failed, WorstItem, BusiestDay, EstCuHours
```

**Expected output:**

```
TotalJobs | SuccessRate | Failed | WorstItem        | BusiestDay | EstCuHours
1247      | 96.8        | 40     | NB_LongRunning   | Wednesday  | 42.3
```

**Tip:** Copy the output row and paste it into your weekly Teams update: "This week: 1,247 jobs at 96.8% success rate. 40 failures, worst offender was NB_LongRunning. Busiest day: Wednesday. Estimated 42.3 CU-hours consumed."

---

## What's Next?

These 5 queries cover the essentials: health scoring, failure analysis, freshness monitoring, regression detection, and executive reporting. The full community query pack includes **20 more queries** across these additional areas:

| Category | Queries | What You Get |
|----------|---------|-------------|
| Performance Analysis | 4 queries | Duration percentiles, scheduling heatmaps, concurrency analysis |
| Failure Investigation | 4 queries | Cascade detection, MTTR calculation, flapping item detection |
| Cost Intelligence | 4 queries | CU waste scoring, monthly cost projection, optimization opportunities |
| SLO Framework | 5 queries | Error budgets, combined SLO dashboard, burn rate forecasting |
| Operations Intelligence | 3 more queries | Workspace comparison, retry effectiveness, dependency mapping |

**Get the full pack:** [`community-query-pack.kql`](./community-query-pack.kql) -- all 25 queries in one file, copy-paste ready.

**Read the full guide:** [`README.md`](./README.md) -- complete documentation, customization guide, and query catalog.

---

## Want Continuous Automated Observability?

These queries are great for ad-hoc analysis. If you want this running **automatically** with long-term retention, proactive alerting, and a purpose-built dashboard, check out the [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads):

- Automated ingestion every 5 minutes (no manual data collection)
- 90-day and 365-day retention (vs native 30-day limit)
- Cross-item correlation engine with dependency graphs
- Proactive alerts via Teams, email, or webhooks
- SLO dashboards with historical trend tracking
- Free tier: 1 workspace, 7-day retention, 5 SLOs -- no credit card required

```bash
npm install @kane-ai/observability-workbench
```

GitHub: [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)

---

*Part of the [Fabric Observability Community Query Pack](./README.md). MIT license -- use freely, attribution appreciated.*
