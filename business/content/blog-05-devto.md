---
title: "CU Waste Score: Quantifying Compute Waste in Fabric"
published: false
description: "Last month your Fabric capacity burned thousands in compute. How much was wasted on failed retries, regressed jobs, and duplicate runs? Here's how to measure it with a single score."
tags: microsoft-fabric, observability, data-engineering, finops
series: "Fabric Observability Deep Dives"
cover_image: ""
canonical_url: ""
---

Last month your Fabric capacity burned $8,400 in compute. How much of that was wasted?

Not "wasted" in the philosophical sense. Wasted in the concrete, measurable sense: CU-seconds consumed by pipeline retries that were never going to succeed. Notebooks that ran 3x longer than their baseline because nobody noticed the regression. Duplicate executions from a manual trigger overlapping with a scheduled run.

Most Fabric teams cannot answer this question. The Monitoring Hub shows what ran and whether it succeeded. The Capacity Metrics app shows aggregate CU consumption. Neither shows you the gap between what you spent and what you should have spent.

That gap is what the CU Waste Score measures.

## What Is CU Waste?

CU waste is compute capacity consumed without producing useful work. On an F64 SKU at $0.0032 per CU-second ($11.52 per hour), even small inefficiencies compound fast over a month. We categorize waste into three distinct types, each with different causes, different magnitudes, and different remediation paths.

### Retry Waste

Fabric data pipelines support configurable retry policies. The defaults are generous -- many activities retry up to 3 times with a 30-second interval. This makes sense for transient failures: a network blip, a temporary throttle, a service restart. But when the failure is deterministic -- a dropped source table, a permissions change, a schema mismatch -- retries are pure waste.

A pipeline activity that fails because a source table was dropped will run for 6 minutes, fail, wait 30 seconds, run for another 6 minutes, fail again, and repeat:

```
Run 1:  6m 12s  -->  Failed (table not found)
Run 2:  6m 08s  -->  Failed (table not found)  [retry 1]
Run 3:  6m 15s  -->  Failed (table not found)  [retry 2]
-------------------------------------------------------
Total: 18m 35s of CU consumption, 0 useful work done
Cost:  ~$3.56 at F64 rates ($0.0032/CU-second)
```

Multiply this by every pipeline in your workspace that has the default retry policy and occasionally hits a deterministic failure. In environments we have analyzed, retry waste accounts for 8-15% of total monthly CU consumption.

### Duration Waste

The silent killer. A notebook that took 4 minutes last month now takes 11 minutes. Nobody notices because it still succeeds. The dashboard shows green checkmarks. But CU consumption for that item nearly tripled.

Duration regression has predictable causes:

- Data volume growth without corresponding query or partition optimization
- Resource contention from overlapping execution windows on shared capacity
- Stale statistics or fragmented Delta tables that degrade Spark performance
- Upstream schema changes that force less efficient join or filter paths

Each regression is small enough to ignore individually. A notebook adds 2 minutes. A pipeline activity takes 40% longer. A dataflow runs an extra pass because a source added columns. But across 30-50 scheduled items, the aggregate effect is a capacity that runs perpetually hot -- consuming 30-50% more CUs than it did three months ago for the same logical work.

### Scheduling Waste

Scheduling waste comes from duplicate or unnecessarily overlapping executions of the same item. The most common scenario:

1. A pipeline is scheduled to run at 06:00 UTC daily
2. At 06:02, a team member opens the monitoring hub, does not see a result yet, and triggers a manual run
3. Both runs execute simultaneously, processing the same data, consuming CUs twice

In environments with complex orchestration -- master pipelines calling child pipelines -- duplicate waste cascades. One duplicate parent triggers duplicate children, each of which triggers duplicate sub-activities. A single accidental manual trigger can double the cost of an entire orchestration chain.

Less obvious scheduling waste: items scheduled more frequently than their consumers need. A notebook that refreshes data every 15 minutes when the semantic model only refreshes hourly is running 3 out of every 4 executions for no downstream benefit.

## The Waste Score Formula

We collapse all three waste categories into a single metric: a score from 0 to 100, where 100 means no detectable waste and 0 means maximum waste.

```
WasteScore = 100 - (RetryWastePct + RegressionWastePct + DuplicateWastePct)
```

Each component is normalized to a weighted percentage:

| Component | Weight | What It Measures |
|---|---|---|
| RetryWastePct | 0-40 | CU-seconds from failed/retried runs relative to total |
| RegressionWastePct | 0-35 | P95 duration increase vs 4-week baseline |
| DuplicateWastePct | 0-25 | CU-seconds from overlapping runs of the same item |

Retry waste gets the highest weight because it is the most immediately actionable -- you can change a retry policy in 30 seconds. Regression waste gets the second-highest weight because it has the largest long-term impact. Scheduling waste gets the lowest weight because it is the easiest to prevent through basic operational hygiene.

### Translating Scores to Dollars

The score becomes concrete when you map it to your SKU's cost:

```
F64 hourly rate:       $11.52
F64 monthly budget:    $11.52 * 730 hours = $8,409.60

Score 70 (30% waste):  ~$2,523/month wasted  --> $30,276/year
Score 85 (15% waste):  ~$1,261/month wasted  --> $15,138/year
Score 95 (5% waste):   ~$420/month wasted    --> $5,046/year

Improving from 70 to 85 saves ~$15,138/year on a single F64.
```

For larger SKUs, the numbers scale linearly. An F128 at score 70 wastes approximately $60,000 per year. An F256 at score 70 wastes approximately $120,000 per year. These are real dollars that show up on the Azure invoice, attributed to nobody, because no one measured where they went.

We set a default threshold of $500 per month in projected waste as the trigger for investigation. Below that threshold, waste is a nuisance. Above it, waste is a line item that deserves a remediation plan.

## KQL Queries for Waste Detection

Here are three queries you can run today against any Eventhouse with Fabric event data. Each one targets a specific waste category.

### Query 1: Retry Waste Calculation

This query identifies items where failed runs are consuming significant CU-seconds relative to total consumption:

```kql
// Retry Waste: CU-seconds burned on runs that never produced useful output
let CU_RATE = 0.0032;  // F64: $0.0032 per CU-second
FabricEvents
| where StartTimeUtc > ago(30d)
| where DurationSeconds > 0
| summarize
    TotalRuns = count(),
    FailedRuns = countif(Status == "Failed"),
    TotalCUSeconds = sum(DurationSeconds),
    FailedCUSeconds = sumif(DurationSeconds, Status == "Failed")
    by ItemId, ItemName, ItemType, WorkspaceName
| where FailedRuns > 0
| extend RetryWastePct = round(todouble(FailedCUSeconds) / TotalCUSeconds * 100, 1)
| extend RetryWasteDollars = round(FailedCUSeconds * CU_RATE, 2)
| extend MonthlyProjection = round(RetryWasteDollars, 2)
| project
    ItemName, ItemType, WorkspaceName,
    TotalRuns, FailedRuns,
    TotalCUSeconds = round(TotalCUSeconds, 0),
    FailedCUSeconds = round(FailedCUSeconds, 0),
    RetryWastePct,
    RetryWasteDollars
| order by RetryWasteDollars desc
```

In our live Fabric environment with 137+ tracked events, this query immediately surfaced items where more than 20% of CU consumption came from failed runs. The monitoring hub showed these as routine failures. The cost view showed them as a $40+ monthly line item per item -- invisible without the calculation.

### Query 2: Duration Regression Detection

This query compares each item's current P95 execution time against its 4-week baseline and flags regressions:

```kql
// Duration Regression: items running significantly slower than baseline
let CU_RATE = 0.0032;
let BaselineWindow = FabricEvents
    | where StartTimeUtc between (ago(35d) .. ago(7d))
    | where Status == "Completed" and DurationSeconds > 0
    | summarize
        BaselineP95 = percentile(DurationSeconds, 95),
        BaselineAvg = round(avg(DurationSeconds), 0),
        BaselineRuns = count()
        by ItemId;
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Completed" and DurationSeconds > 0
| summarize
    CurrentP95 = percentile(DurationSeconds, 95),
    CurrentAvg = round(avg(DurationSeconds), 0),
    CurrentRuns = count(),
    TotalSeconds = sum(DurationSeconds)
    by ItemId, ItemName, ItemType, WorkspaceName
| join kind=inner BaselineWindow on ItemId
| where BaselineRuns >= 5 and CurrentRuns >= 3
| extend RegressionRatio = round(CurrentP95 / BaselineP95, 2)
| extend ExcessSeconds = iff(RegressionRatio > 1.5,
    (CurrentP95 - BaselineP95) * CurrentRuns, 0.0)
| extend DurationWasteDollars = round(ExcessSeconds * CU_RATE, 2)
| where RegressionRatio > 1.5
| project
    ItemName, ItemType, WorkspaceName,
    BaselineP95_Sec = round(BaselineP95, 0),
    CurrentP95_Sec = round(CurrentP95, 0),
    RegressionRatio,
    ExcessSeconds = round(ExcessSeconds, 0),
    DurationWasteDollars,
    CurrentRuns
| order by DurationWasteDollars desc
```

A `RegressionRatio` above 1.5 means the item is running 50% or more slower than its historical norm. Above 2.0 means it doubled. The `DurationWasteDollars` column translates that regression into the dollar cost of the excess CU-seconds consumed.

### Query 3: Aggregate Waste Score

This query combines all three waste dimensions into a single per-item score with cost projections:

```kql
// Composite CU Waste Score with dollar projections
let CU_RATE = 0.0032;
let WasteThreshold = 500.0;  // $500/month projected waste triggers investigation
// Retry component
let RetryWaste = FabricEvents
    | where StartTimeUtc > ago(30d)
    | where DurationSeconds > 0
    | summarize
        TotalCU = sum(DurationSeconds),
        FailedCU = sumif(DurationSeconds, Status == "Failed")
        by ItemId, ItemName, ItemType, WorkspaceName
    | extend RetryPct = round(iff(TotalCU > 0,
        todouble(FailedCU) / TotalCU * 40.0, 0.0), 1);
// Regression component
let Baseline = FabricEvents
    | where StartTimeUtc between (ago(60d) .. ago(30d))
    | where Status == "Completed" and DurationSeconds > 0
    | summarize BaseP95 = percentile(DurationSeconds, 95) by ItemId;
let RegressionWaste = FabricEvents
    | where StartTimeUtc > ago(30d)
    | where Status == "Completed" and DurationSeconds > 0
    | summarize CurP95 = percentile(DurationSeconds, 95) by ItemId
    | join kind=leftouter Baseline on ItemId
    | extend RegressionPct = round(iff(isnotnull(BaseP95) and BaseP95 > 0,
        min_of((CurP95 - BaseP95) / BaseP95, 1.0) * 35.0, 0.0), 1);
// Duplicate component
let DuplicateWaste = FabricEvents
    | where StartTimeUtc > ago(30d)
    | where DurationSeconds > 0
    | order by ItemId asc, StartTimeUtc asc
    | serialize
    | extend PrevStart = prev(StartTimeUtc), PrevItemId = prev(ItemId)
    | where ItemId == PrevItemId
    | where datetime_diff('second', StartTimeUtc, PrevStart) < 60
    | summarize DupSeconds = sum(DurationSeconds) by ItemId;
// Combine
RetryWaste
| join kind=leftouter RegressionWaste on ItemId
| join kind=leftouter DuplicateWaste on ItemId
| extend DupPct = round(iff(TotalCU > 0 and isnotnull(DupSeconds),
    todouble(DupSeconds) / TotalCU * 25.0, 0.0), 1)
| extend WasteScore = round(100.0
    - max_of(RetryPct, 0.0)
    - max_of(RegressionPct, 0.0)
    - max_of(DupPct, 0.0), 0)
| extend MonthlyCost = round(TotalCU * CU_RATE, 2)
| extend WastedDollars = round(
    (max_of(RetryPct, 0.0) + max_of(RegressionPct, 0.0) + max_of(DupPct, 0.0))
    / 100.0 * TotalCU * CU_RATE, 2)
| project
    ItemName, ItemType, WorkspaceName,
    WasteScore = max_of(WasteScore, 0),
    RetryWaste = max_of(RetryPct, 0.0),
    RegressionWaste = max_of(RegressionPct, 0.0),
    DuplicateWaste = max_of(DupPct, 0.0),
    MonthlyCost, WastedDollars
| order by WasteScore asc
```

Sample output from a production workspace:

| Item | Type | Score | Retry | Regress | Dup | Cost | Wasted |
|---|---|---|---|---|---|---|---|
| PL_MasterOrch | Pipeline | 44 | 32.0 | 18.5 | 5.5 | $89.10 | $49.94 |
| PL_DailyIngest | Pipeline | 58 | 18.4 | 14.2 | 9.4 | $47.82 | $20.09 |
| NB_Transform | Notebook | 71 | 2.1 | 26.9 | 0.0 | $124.50 | $36.10 |
| DF_CustomerSync | Dataflow | 92 | 0.0 | 8.0 | 0.0 | $18.20 | $1.46 |

PL_MasterOrch has a waste score of 44. That means 56% of its CU consumption produces no useful output. At $89.10 per month in total compute, nearly $50 is wasted. Left unaddressed, that single pipeline wastes $600 per year. Across every item in the workspace, the numbers add up to thousands.

## The Dashboard View

The waste score surfaces in the Observability Workbench dashboard as a dedicated panel alongside the SLO grid and failure timeline. The panel shows:

**Workspace-level waste score.** A single number -- the weighted average across all items. This is the headline metric: "Your workspace waste score is 72. Approximately $1,840 per month in CU consumption is not producing useful work."

**Per-item breakdown table.** Every item ranked by waste score (worst first), with columns for each waste component, monthly cost, and wasted dollars. The table is sortable by any column, so you can quickly find the highest-dollar waste, the worst retry offenders, or the biggest regressions.

**Trend line.** Weekly waste score over the last 90 days. Is the workspace getting more efficient or less? When a new pipeline is deployed, does the waste score dip? When a notebook gets optimized, does it recover? The trend makes optimization efforts visible and measurable.

**Waste category breakdown.** A stacked view showing what proportion of total waste comes from retries, regressions, and duplicates. This tells you where to focus: if 70% of waste is retry-driven, fix retry policies first. If 60% is regression-driven, invest in duration monitoring and alerting.

## From Visibility to Action

Measuring waste is useful. Reducing it is the point. Here are the concrete actions each waste category implies.

### Fixing Retry Waste (Immediate, Low Effort)

Audit every pipeline's retry policy today. The default settings are designed for resilience, not cost efficiency. Adjust them based on the failure mode:

**Idempotent operations** (copy to Lakehouse in overwrite mode, full table refresh): Safe to retry. Keep the default policy but increase `retryIntervalInSeconds` to at least 60 to avoid rapid-fire retries that consume CUs during transient outages.

**Non-idempotent operations** (append mode writes, external API calls with side effects): Set retry count to 0 or 1. A failed append that retries may produce duplicate data, which is a data quality problem on top of a cost problem.

**Long-running activities** (anything over 5 minutes): Set retry count to 1 at most. A 6-minute activity with 3 retries burns 24 minutes of CUs on a deterministic failure.

```json
{
  "policy": {
    "retry": { "count": 1, "intervalInSeconds": 60 },
    "timeout": "01:00:00"
  }
}
```

### Fixing Duration Regression (Medium Effort, High Impact)

Set up automated duration monitoring. The duration regression detection query above should run weekly at minimum. When `RegressionRatio` exceeds 1.5, investigate. When it exceeds 2.0, treat it as a production incident -- the CU cost has doubled even though nothing visibly broke.

Common fixes for duration regression:

- **Delta table maintenance.** Run `OPTIMIZE` and `VACUUM` on Lakehouse tables that notebooks read from. Fragmented small files force Spark to open thousands of file handles.
- **Partition pruning.** Add or fix partition columns so queries scan less data. A notebook that scans 90 days of data when it only needs today's partition is doing 90x the work.
- **Resource contention.** Use the concurrency analysis query from our [community query pack](https://github.com/tenfingerseddy/FabricWorkloads) (45+ KQL queries) to identify scheduling hotspots where jobs compete for capacity.
- **Upstream schema changes.** A new column in a source table can change query plans. Check whether upstream items changed around the time the regression started.

### Fixing Scheduling Waste (Low Effort, Moderate Impact)

**Set pipeline concurrency to 1** for jobs that should never overlap. This is a single setting in the pipeline configuration that prevents the most common duplicate waste scenario.

**Check for active runs before triggering.** Use the Fabric REST API to verify no instance is already running before launching a manual or API-triggered execution:

```
GET /v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances?status=InProgress
```

If the response contains any in-progress instances, skip the trigger.

**Align schedules with consumers.** If a notebook refreshes data every 15 minutes but the semantic model that consumes it only refreshes hourly, three out of four notebook runs produce data that nobody reads before it is overwritten. Reduce the notebook frequency to match its downstream consumer.

### Setting Waste-Aware SLOs

The waste score integrates with the SLO framework described in [our previous post on building your first Fabric SLO](https://dev.to/series/fabric-observability-deep-dives). Define waste thresholds alongside reliability targets:

- "No item shall have a WasteScore below 70"
- "Total monthly projected waste shall not exceed $500"
- "RetryWastePct above 20% triggers an immediate alert"

When a waste SLO breaches, the alert includes the full breakdown: which component is driving the score down, how much it is costing, and what the remediation path looks like.

## Try It

The CU Waste Score calculation, along with all three component queries, is part of the [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- an open-source Fabric-native workload for production observability. The project includes 205 passing tests, automated notebook validation, and a community query pack with 45+ KQL queries covering health, performance, failure investigation, cost intelligence, and SLO tracking.

Point it at your F64 (or any Fabric capacity) and find out what your waste score looks like. The number might surprise you. More importantly, the per-item breakdown will tell you exactly where to start optimizing.

{% embed https://github.com/tenfingerseddy/FabricWorkloads %}

---

*This is part of the "Fabric Observability Deep Dives" series. Previously: [The State of Fabric Observability in 2026](https://dev.to/series/fabric-observability-deep-dives), [Cross-Item Correlation](https://dev.to/series/fabric-observability-deep-dives), [Building Your First Fabric SLO](https://dev.to/series/fabric-observability-deep-dives), and [Why Your Fabric Pipeline Succeeded But Your Data Is Wrong](https://dev.to/series/fabric-observability-deep-dives).*
