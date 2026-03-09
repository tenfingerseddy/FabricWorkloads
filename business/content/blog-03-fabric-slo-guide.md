# Building Your First Fabric SLO: A Practical Guide

*Service Level Objectives are the foundation of reliable operations in every major engineering organization. Here is how to define, measure, and track SLOs for your Microsoft Fabric workloads -- with KQL examples you can run today.*

---

You know your pipelines ran. You know they succeeded. But do you know if they ran *well enough*?

Most Fabric teams can answer basic questions: Did the pipeline finish? Did the notebook throw an error? But ask them this: "What is the success rate of your daily revenue pipeline over the last 30 days?" or "Is your semantic model refresh getting slower week over week?" -- and you get silence. Or a spreadsheet someone updates manually on Fridays.

This is the gap that Service Level Objectives fill. SLOs give you a precise, measurable definition of "good enough" for every critical workload. They replace gut feelings with numbers. They replace reactive firefighting with proactive trend tracking. And they give you a shared language to discuss reliability with stakeholders who do not care about pipeline internals but care deeply about whether the revenue report is accurate by 8 AM.

This guide walks through building your first three SLOs for Microsoft Fabric: success rate, duration, and freshness. Every example uses KQL queries against the `FabricEvents` table schema from our open-source [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads), but the concepts apply regardless of your tooling.

## What Is an SLO, and Why Does Fabric Need One?

An SLO is a target for a measurable indicator of service reliability. The concept comes from Site Reliability Engineering (SRE), popularized by Google, and has become the standard operating model for teams running production systems at scale.

Three components make up an SLO:

1. **Service Level Indicator (SLI)**: The metric you measure. For Fabric, this is typically success rate, execution duration, or data freshness.
2. **Target**: The threshold that defines "acceptable." For example, 99% success rate over a rolling 7-day window.
3. **Error Budget**: The inverse of your target -- the amount of failure you can tolerate before your SLO is breached. A 99% success rate SLO gives you a 1% error budget.

Fabric does not ship with any SLO framework. The monitoring hub shows individual run results. Data Activator can fire alerts on individual events. But neither gives you the ability to define a target, track it over a rolling window, calculate an error budget, or alert when trends suggest a future breach.

That is what we are building here.

## Prerequisites

To follow along, you need:

- A Fabric workspace with items that have job execution history (pipelines, notebooks, dataflows)
- An Eventhouse with a `FabricEvents` table containing job execution data
- If you are using Observability Workbench: `npm start` will collect and ingest this data automatically
- If you are building your own: any KQL database with job status, start time, end time, and item identifiers will work

The `FabricEvents` table schema we use throughout this guide:

```kql
.create-merge table FabricEvents (
  Timestamp: datetime,
  WorkspaceId: guid,
  WorkspaceName: string,
  ItemId: guid,
  ItemName: string,
  ItemType: string,
  JobInstanceId: string,
  JobType: string,
  InvokeType: string,
  Status: string,
  FailureReason: string,
  RootActivityId: guid,
  StartTimeUtc: datetime,
  EndTimeUtc: datetime,
  DurationMs: long
)
```

If you do not have this set up yet, the [Observability Workbench README](https://github.com/tenfingerseddy/FabricWorkloads) has a quickstart that provisions the tables and ingests data from your live Fabric environment.

## SLO 1: Success Rate

Success rate is the most fundamental SLO. It answers: "What percentage of executions for this workload completed without failure?"

### Defining the SLI

The SLI for success rate is straightforward:

```
Success Rate = (Successful Runs) / (Total Runs) * 100
```

In Fabric's API, a completed job has a status of `"Completed"`. Failed jobs show `"Failed"`. Cancelled jobs show `"Cancelled"`. The question of whether cancelled runs count against your success rate depends on your context -- if cancellations are intentional (a user manually stopped a test run), you might exclude them. If they represent system-level interruptions, count them.

For this guide, we define success rate as completed runs divided by all non-cancelled runs.

### The KQL Query

Here is how to calculate the rolling 7-day success rate for every item in your workspace:

```kql
// SLO: Success Rate -- Rolling 7-Day Window
FabricEvents
| where Timestamp > ago(7d)
| where Status != "Cancelled"           // Exclude intentional cancellations
| summarize
    TotalRuns = count(),
    SuccessCount = countif(Status == "Completed"),
    FailedCount = countif(Status == "Failed")
    by ItemName, ItemType, WorkspaceName
| extend SuccessRate = round(todouble(SuccessCount) / TotalRuns * 100, 2)
| extend ErrorBudgetPct = round(100.0 - SuccessRate, 2)
| project
    WorkspaceName,
    ItemName,
    ItemType,
    TotalRuns,
    SuccessCount,
    FailedCount,
    SuccessRate,
    ErrorBudgetPct
| order by SuccessRate asc
```

This query returns every item ranked by success rate, worst first. The `ErrorBudgetPct` column shows how much of your budget has been consumed -- if you see a pipeline at 97% success rate with a 99% target, you have consumed more than your entire 1% error budget.

### Setting the Target

Common success rate targets for Fabric workloads:

| Workload Type | Recommended Target | Error Budget (7-day) |
|---|---|---|
| Critical production pipelines | 99.0% | ~0.7 failures per 100 runs |
| Daily semantic model refreshes | 98.0% | ~0.14 failures per 7 runs |
| Hourly data ingestion notebooks | 99.5% | ~0.84 failures per 168 runs |
| Ad-hoc / development items | 95.0% | Generous margin for experimentation |

A 99% success rate on a pipeline that runs 4 times daily means you can tolerate roughly 1 failure every 3.5 days before breaching your SLO. That feels right for most production workloads -- an occasional transient failure is acceptable, but multiple failures per week means something is degrading.

### Tracking Error Budgets Over Time

The real power of SLOs is the error budget. Here is how to track it over a rolling window:

```kql
// Error Budget Burn Rate -- Daily Trend for a Specific Item
let SLO_Target = 99.0;
let ItemFilter = "PL_DailyRevenuePipeline";
FabricEvents
| where ItemName == ItemFilter
| where Timestamp > ago(30d)
| where Status != "Cancelled"
| summarize
    TotalRuns = count(),
    Failures = countif(Status == "Failed")
    by bin(Timestamp, 1d)
| extend DailySuccessRate = round(todouble(TotalRuns - Failures) / TotalRuns * 100, 2)
| extend BelowTarget = iff(DailySuccessRate < SLO_Target, 1, 0)
| order by Timestamp asc
```

This daily breakdown shows you exactly when your error budget burns. When you see a cluster of `BelowTarget = 1` days, that is a signal to investigate before the rolling window SLO breaches.

```
[Diagram: Error Budget Burn Rate Chart]
+------------------------------------------------------------------+
| Error Budget: PL_DailyRevenuePipeline (99% SLO, 7-day window)   |
|                                                                    |
| Budget Remaining: |==========================       | 72%          |
|                                                                    |
| Day 1: 100% .................. OK                                  |
| Day 2: 100% .................. OK                                  |
| Day 3:  75% ............XXXXX  BURNED 25% of budget               |
| Day 4: 100% .................. OK                                  |
| Day 5: 100% .................. OK                                  |
| Day 6: 100% .................. OK                                  |
| Day 7:  97% .............XXX.  BURNED 3% of budget                |
|                                                                    |
| Trend: Budget burn accelerated on Day 3 (investigate root cause)  |
+------------------------------------------------------------------+
```

The error budget gives you a fundamentally different conversation with stakeholders. Instead of "the pipeline failed twice this week," you say "we have consumed 28% of our weekly error budget, and at the current burn rate, we will breach the SLO by Thursday." That is actionable information.

## SLO 2: Duration (Execution Performance)

Duration SLOs catch a class of problems that success rate misses entirely: silent performance degradation. A pipeline that succeeds every time but takes 3x longer than it did last month is a pipeline heading toward failure. It is consuming more CU capacity. It is finishing closer to the deadline. It is one traffic spike away from timing out.

### Defining the SLI

For duration, we use percentile-based SLIs rather than averages. Averages hide outliers. A P95 duration tells you: "95% of executions completed within this time." The remaining 5% are your tail latency -- they take longer, and if that tail grows, your workload is degrading.

```
P95 Duration = The execution time below which 95% of runs complete
```

### The KQL Query

```kql
// SLO: Duration -- P50 and P95 by Item (Rolling 14 Days)
FabricEvents
| where Timestamp > ago(14d)
| where Status == "Completed"           // Only measure successful runs
| where DurationMs > 0
| summarize
    RunCount = count(),
    P50_Duration = percentile(DurationMs, 50),
    P95_Duration = percentile(DurationMs, 95),
    MaxDuration = max(DurationMs),
    AvgDuration = avg(DurationMs)
    by ItemName, ItemType, WorkspaceName
| extend P50_Minutes = round(P50_Duration / 60000.0, 1)
| extend P95_Minutes = round(P95_Duration / 60000.0, 1)
| extend Max_Minutes = round(MaxDuration / 60000.0, 1)
| project
    WorkspaceName,
    ItemName,
    ItemType,
    RunCount,
    P50_Minutes,
    P95_Minutes,
    Max_Minutes
| order by P95_Minutes desc
```

### Detecting Duration Regression

The critical use case for duration SLOs is catching regression -- when execution times creep upward. Here is how to compare the current week against the previous week:

```kql
// Duration Regression Detection -- Week-over-Week Comparison
let CurrentWeek = FabricEvents
    | where Timestamp > ago(7d)
    | where Status == "Completed" and DurationMs > 0
    | summarize CurrentP95 = percentile(DurationMs, 95) by ItemName, ItemType;
let PreviousWeek = FabricEvents
    | where Timestamp between (ago(14d) .. ago(7d))
    | where Status == "Completed" and DurationMs > 0
    | summarize PreviousP95 = percentile(DurationMs, 95) by ItemName, ItemType;
CurrentWeek
| join kind=inner PreviousWeek on ItemName, ItemType
| extend RegressionRatio = round(todouble(CurrentP95) / PreviousP95, 2)
| extend RegressionPct = round((todouble(CurrentP95) - PreviousP95) / PreviousP95 * 100, 1)
| where RegressionRatio > 1.5           // Flag items with 50%+ regression
| project
    ItemName,
    ItemType,
    PreviousP95_Min = round(PreviousP95 / 60000.0, 1),
    CurrentP95_Min = round(CurrentP95 / 60000.0, 1),
    RegressionRatio,
    RegressionPct
| order by RegressionRatio desc
```

Any item showing a `RegressionRatio` above 1.5 (50% slower than last week) deserves investigation. In our live Fabric environment, this query caught two notebooks with silent duration regressions -- they succeeded every run but were getting progressively slower. The monitoring hub showed green checkmarks. The SLO framework flagged the trend.

### Setting the Target

Duration targets depend on your workload's business context:

| Scenario | Recommended P95 Target | Why |
|---|---|---|
| Daily pipeline feeding morning reports | 120 minutes | Must finish before 8 AM stakeholder review |
| Hourly incremental notebook | 45 minutes | Must complete within the hour to avoid overlap |
| Semantic model refresh | 30 minutes | Users waiting for updated visuals |
| On-demand CopyJob | 60 minutes | SLA for ad-hoc data requests |

The target should be set with headroom. If your pipeline typically takes 20 minutes, do not set a 25-minute SLO. Set it at 40 minutes. The SLO defines the line between "acceptable" and "needs attention" -- not the line between "normal" and "slightly slower."

## SLO 3: Freshness (Data Timeliness)

Freshness SLOs answer the question stakeholders actually care about: "Is the data in my report current?"

Success rate and duration measure the execution mechanics. Freshness measures the outcome. A pipeline could succeed and finish quickly, but if it ran against stale source data, or if the semantic model refresh that depends on it has not been triggered, the data in the report is stale regardless.

### Defining the SLI

```
Freshness = Time elapsed since the last successful execution completed
```

If the last successful run of your daily revenue pipeline completed at 6 AM, and it is now 10 AM, the freshness is 4 hours. If your SLO says "the revenue pipeline data must be no more than 6 hours old," you are within budget. If it is 2 PM and there has been no successful run since 6 AM, you are at 8 hours -- SLO breached.

### The KQL Query

```kql
// SLO: Freshness -- Hours Since Last Successful Run
FabricEvents
| where Status == "Completed"
| summarize LastSuccessUtc = max(EndTimeUtc) by ItemName, ItemType, WorkspaceName
| extend FreshnessHours = round(datetime_diff('second', now(), LastSuccessUtc) / 3600.0, 1)
| extend FreshnessStatus = case(
    FreshnessHours <= 6, "Fresh",
    FreshnessHours <= 12, "Aging",
    FreshnessHours <= 24, "Stale",
    "Critical"
  )
| project
    WorkspaceName,
    ItemName,
    ItemType,
    LastSuccessUtc,
    FreshnessHours,
    FreshnessStatus
| order by FreshnessHours desc
```

The `FreshnessStatus` classification gives you an immediate visual triage:

```
[Diagram: Freshness Status Board]
+-------------------------------------------------------------------+
| Freshness Dashboard -- FrameworkProduction Workspace               |
|                                                                     |
| FRESH (< 6h)                                                       |
|   [OK] PL_DailyRevenue ............... 2.3h    Last: 07:42 UTC    |
|   [OK] NB_IncrementalLoad ............ 0.8h    Last: 09:15 UTC    |
|   [OK] PL_MasterOrchestrator ......... 4.1h    Last: 05:52 UTC    |
|                                                                     |
| AGING (6-12h)                                                       |
|   [!!] SM_FinanceModel ............... 8.7h    Last: 01:18 UTC    |
|   [!!] DF_CustomerSync ............... 9.2h    Last: 00:48 UTC    |
|                                                                     |
| STALE (12-24h)                                                      |
|   [XX] NB_WeeklyAggregation ......... 18.4h    Last: 15:36 UTC    |
|                                                                     |
| CRITICAL (> 24h)                                                    |
|   [!!] PL_LegacyMigration ........... 52.1h    Last: 2 days ago   |
+-------------------------------------------------------------------+
```

### Freshness Trend Over Time

To see whether freshness is degrading (runs completing later each day), track the completion time trend:

```kql
// Freshness Trend -- When Does Each Item Typically Finish?
FabricEvents
| where Timestamp > ago(14d)
| where Status == "Completed"
| extend CompletionHourUTC = datetime_part("hour", EndTimeUtc)
| summarize
    AvgCompletionHour = avg(CompletionHourUTC),
    LatestCompletionHour = max(CompletionHourUTC),
    RunCount = count()
    by ItemName, bin(Timestamp, 1d)
| order by ItemName asc, Timestamp asc
```

If your daily pipeline usually finishes at 6 AM but has been creeping toward 8 AM over the past two weeks, the freshness SLO is not breached yet -- but it will be soon. This is where proactive alerting earns its value.

### Setting the Target

| Data Consumer | Recommended Freshness Target | Rationale |
|---|---|---|
| Executive dashboards | 4 hours | Morning review at 8 AM, data must reflect overnight processing |
| Operational reports | 2 hours | Near-real-time decisions need recent data |
| Weekly aggregation models | 24 hours | Batch cadence is inherently daily |
| Archived / compliance data | 48 hours | Low urgency, but still needs a bound |

## Putting It All Together: A Combined SLO Dashboard

Here is a single query that computes all three SLO types for every item, giving you a unified reliability view:

```kql
// Combined SLO Dashboard -- All Three Metrics
let Window = 7d;
let SuccessRateTarget = 99.0;
let FreshnessLimitHours = 6.0;
let DurationLimitMs = 1800000.0;     // 30 minutes in ms
FabricEvents
| where Timestamp > ago(Window)
| summarize
    TotalRuns = count(),
    SuccessCount = countif(Status == "Completed"),
    FailedCount = countif(Status == "Failed"),
    P95Duration = percentile(DurationMs, 95),
    LastSuccess = maxif(EndTimeUtc, Status == "Completed")
    by ItemName, ItemType, WorkspaceName
| extend SuccessRate = round(todouble(SuccessCount) / TotalRuns * 100, 2)
| extend FreshnessHours = round(
    datetime_diff('second', now(), LastSuccess) / 3600.0, 1)
| extend P95_Minutes = round(P95Duration / 60000.0, 1)
| extend SLO_SuccessRate = iff(SuccessRate >= SuccessRateTarget, "PASS", "FAIL")
| extend SLO_Freshness = iff(FreshnessHours <= FreshnessLimitHours, "PASS", "FAIL")
| extend SLO_Duration = iff(P95Duration <= DurationLimitMs, "PASS", "FAIL")
| extend OverallHealth = case(
    SLO_SuccessRate == "FAIL" or SLO_Freshness == "FAIL" or SLO_Duration == "FAIL",
    "AT RISK",
    "HEALTHY"
  )
| project
    WorkspaceName,
    ItemName,
    ItemType,
    SuccessRate,
    SLO_SuccessRate,
    P95_Minutes,
    SLO_Duration,
    FreshnessHours,
    SLO_Freshness,
    OverallHealth,
    TotalRuns
| order by OverallHealth desc, SuccessRate asc
```

This single view tells you exactly which items need attention and why. Items showing "AT RISK" with a failing success rate SLO need immediate investigation. Items passing all three SLOs are healthy.

## From Queries to Automation

Running these queries manually is a good start. Automating them is where real operational maturity begins.

### Option 1: Fabric Notebook on Schedule

Create a Fabric notebook that runs these KQL queries on a schedule (every hour or every 15 minutes), writes the results to an `SloSnapshots` table, and evaluates alert rules against the snapshots. This is exactly what our [NB_ObsAlerts notebook](https://github.com/tenfingerseddy/FabricWorkloads) does in Fabric.

### Option 2: Observability Workbench CLI

If you want this running in five minutes, the Observability Workbench does all of the above automatically:

```bash
npm install @kane-ai/observability-workbench
export FABRIC_TENANT_ID=your-tenant-id
export FABRIC_CLIENT_ID=your-client-id
export FABRIC_CLIENT_SECRET=your-secret
npm start
```

It discovers your workspaces, collects job history, computes SLO metrics (success rate, P50/P95 duration, freshness), evaluates alert rules (success rate violations, duration regressions, freshness violations, consecutive failures), ingests everything into your Eventhouse, and renders a CLI dashboard.

### Option 3: KQL Query Pack

We maintain a community-contributed [KQL query pack](https://github.com/tenfingerseddy/FabricWorkloads) with 30+ queries covering SLO computation, error budget tracking, duration regression detection, freshness monitoring, and more. Copy the queries into your Eventhouse and adapt the table names and thresholds to your environment.

## Common Mistakes When Starting with SLOs

**Setting targets too tight.** If your pipeline currently has a 96% success rate, do not set a 99.9% SLO. Start with 97%, stabilize the workload, then tighten. SLOs are supposed to be achievable targets that catch degradation, not aspirational goals that are always breached.

**Measuring the wrong thing.** Success rate on a pipeline that always succeeds but produces wrong data is a vanity metric. Combine success rate with freshness and consider adding data quality SLOs (row count variance, null rate thresholds) once the basics are stable.

**Ignoring error budgets.** An SLO without an error budget is just a threshold alert. The error budget is what makes SLOs powerful -- it gives you permission to accept some failure while making degradation visible before it becomes critical.

**Not sharing SLOs with stakeholders.** SLOs are a communication tool as much as a technical tool. Share them with the business teams that depend on your data. When a stakeholder asks "is the data reliable?" you can point to a dashboard showing three green SLOs instead of hand-waving.

## What Comes Next

Once you have success rate, duration, and freshness SLOs running, the next step is connecting them to your incident response workflow:

- **Alerting**: Fire alerts when an SLO breaches or when trend analysis predicts a breach within N hours
- **Correlation**: When a freshness SLO breaches, automatically trace back through the dependency chain to find the root cause item
- **Error budget policies**: Define what happens when error budgets are exhausted -- freeze deployments? Escalate to on-call? Notify stakeholders?

All of these are capabilities we are building into Observability Workbench. The project is open source, and we would love your feedback on which SLO features matter most to your team.

Star the repo: [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)

---

*This is part of the "Fabric Observability Deep Dives" series. Previous posts: [The State of Fabric Observability in 2026](/blog/state-of-fabric-observability-2026) and [Cross-Item Correlation in Fabric](/blog/cross-item-correlation-fabric). Next up: "Why Your Fabric Pipeline Succeeded But Your Data Is Wrong" -- how silent failures slip through status checks.*
