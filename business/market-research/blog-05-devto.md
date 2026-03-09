---
title: "CU Waste Score: Quantifying Compute Waste in Microsoft Fabric"
published: false
tags: microsoftfabric, dataengineering, observability, finops
cover_image:
canonical_url:
series: "Fabric Observability Deep Dives"
---

Microsoft Fabric's capacity model is elegant in theory: buy an F-SKU, get a pool of Capacity Units (CUs) that every workload shares. Pipelines, notebooks, dataflows, semantic model refreshes --- they all draw from the same well. The problem is that nobody tracks where the water goes.

With an F64 SKU priced at approximately **$11.52 per hour** --- roughly $0.0032 per CU-second --- even modest inefficiencies compound fast. A pipeline that fails after running for 8 minutes still consumed those CUs. A notebook that runs 3x longer than its baseline burns through capacity that could have served three other jobs. A manual rerun that overlaps with the already-scheduled run doubles the cost.

Most Fabric teams have **zero visibility** into this. The Monitoring Hub shows you what ran and whether it succeeded. It does not show you what that run *cost* relative to what it *should have cost*.

## Three Types of Compute Waste

After analyzing hundreds of job execution patterns across production Fabric environments, we identified three distinct categories.

### 1. Retry Waste

Fabric data pipelines support configurable retry policies. The defaults are generous --- many activities retry up to 3 times with a 30-second interval. This is sensible for transient failures, but catastrophic for deterministic ones.

A pipeline activity that fails because a source table was dropped will run for 6 minutes, fail, wait 30 seconds, run for another 6 minutes, fail again, and repeat. That is **18 minutes of CU consumption** for a job that was never going to succeed:

```
Run 1: 6m 12s  -> Failed (table not found)
Run 2: 6m 08s  -> Failed (table not found)  [retry 1]
Run 3: 6m 15s  -> Failed (table not found)  [retry 2]
─────────────────────────────────────────────
Total: 18m 35s consumed, 0 useful work done
CU cost: ~$3.56 at F64 rates
```

In one environment we analyzed, retry waste accounted for **12% of total monthly CU consumption**.

### 2. Duration Regression

The silent killer. A notebook that took 4 minutes last month now takes 11 minutes. Nobody notices because it still succeeds. The dashboard stays green. But CU consumption for that item nearly tripled.

Common causes:
- Data volume growth without corresponding optimization
- Resource contention from overlapping execution windows
- Missing maintenance (stale statistics, fragmented delta tables)

Each regression is small enough to ignore individually. But across 50 scheduled items, the aggregate effect is a capacity that runs perpetually hot.

### 3. Duplicate Waste

More common than you'd think. The scenario:

1. A pipeline is scheduled to run at 06:00 UTC daily
2. At 06:02, a team member notices "it hasn't run yet" and triggers a manual run
3. Both runs execute simultaneously, processing the same data

In environments with complex orchestration (master pipelines calling child pipelines), duplicate waste cascades. One duplicate parent triggers duplicate children, each of which triggers duplicate grandchildren.

## The CU Waste Score

We built a scoring system that collapses all three categories into a single **0--100 metric**. A score of 100 means no detectable waste.

```
WasteScore = 100 - (RetryWastePct + RegressionWastePct + DuplicateWastePct)
```

The weighting:
- **RetryWastePct** (0--40): CU-seconds from failed/retried runs vs total. Highest weight because it is the most immediately actionable.
- **RegressionWastePct** (0--35): P95 duration increase vs baseline. Largest long-term impact.
- **DuplicateWastePct** (0--25): CU-seconds from overlapping runs of the same item. Easiest to prevent.

### Translating to Dollars

```
F64 monthly budget: $11.52 * 730 hours = $8,409.60

Waste at score 70:  ~30% waste = ~$2,523/month
Waste at score 85:  ~15% waste = ~$1,261/month

Improving from 70 to 85 saves ~$15,144/year
```

For larger SKUs (F128, F256), multiply accordingly.

## Calculating Waste with KQL

Here is the full query you can run against your Eventhouse. It computes all three waste dimensions and produces a composite score with cost projections.

```sql
// CU Waste Score — Per-item compute waste analysis

// Step 1: Establish baselines (prior 30-day window)
let BaselinePeriod = FabricEvents
| where StartTimeUtc between (ago(60d) .. ago(30d))
| where Status == "Completed"
| where DurationSeconds > 0
| summarize BaselineP95 = percentile(DurationSeconds, 95),
            BaselineAvg = avg(DurationSeconds)
    by ItemId;

// Step 2: Current period metrics (last 30 days)
let CurrentPeriod = FabricEvents
| where StartTimeUtc > ago(30d)
| where DurationSeconds > 0
| summarize
    TotalRuns = count(),
    SuccessRuns = countif(Status == "Completed"),
    FailedRuns = countif(Status == "Failed"),
    TotalCUSeconds = sum(DurationSeconds),
    FailedCUSeconds = sumif(DurationSeconds, Status == "Failed"),
    CurrentP95 = percentile(DurationSeconds, 95),
    CurrentAvg = avg(DurationSeconds)
    by ItemId, ItemName, ItemType, WorkspaceName;

// Step 3: Detect overlapping (duplicate) runs
let Overlaps = FabricEvents
| where StartTimeUtc > ago(30d)
| where DurationSeconds > 0
| extend EndTimeUtc = StartTimeUtc + totimespan(DurationSeconds * 10000000)
| join kind=inner (
    FabricEvents
    | where StartTimeUtc > ago(30d)
    | where DurationSeconds > 0
    | extend EndTimeUtc = StartTimeUtc + totimespan(DurationSeconds * 10000000)
) on ItemId
| where StartTimeUtc1 > StartTimeUtc and StartTimeUtc1 < EndTimeUtc
| summarize OverlapCUSeconds = sum(DurationSeconds1) by ItemId;

// Step 4: Composite waste score
CurrentPeriod
| join kind=leftouter BaselinePeriod on ItemId
| join kind=leftouter Overlaps on ItemId
| extend
    RetryWastePct = round(
        iff(TotalCUSeconds > 0,
            todouble(FailedCUSeconds) / TotalCUSeconds * 40.0,
            0.0), 1),
    RegressionWastePct = round(
        iff(BaselineP95 > 0,
            min_of((CurrentP95 - BaselineP95) / BaselineP95, 1.0) * 35.0,
            0.0), 1),
    DuplicateWastePct = round(
        iff(TotalCUSeconds > 0 and isnotnull(OverlapCUSeconds),
            todouble(OverlapCUSeconds) / TotalCUSeconds * 25.0,
            0.0), 1)
| extend
    WasteScore = round(100.0
        - max_of(RetryWastePct, 0.0)
        - max_of(RegressionWastePct, 0.0)
        - max_of(DuplicateWastePct, 0.0), 0),
    MonthlyEstCost = round(TotalCUSeconds * 0.0032, 2),
    WastedCost = round(
        (max_of(RetryWastePct, 0.0) + max_of(RegressionWastePct, 0.0)
         + max_of(DuplicateWastePct, 0.0))
        / 100.0 * TotalCUSeconds * 0.0032, 2)
| project
    WorkspaceName, ItemName, ItemType, TotalRuns, FailedRuns,
    WasteScore = max_of(WasteScore, 0),
    RetryWastePct,
    RegressionWastePct = max_of(RegressionWastePct, 0.0),
    DuplicateWastePct,
    MonthlyEstCost, WastedCost
| order by WasteScore asc
```

### Sample Output

| Item | Type | Runs | WasteScore | Retry% | Regress% | Dup% | Cost | Wasted |
|---|---|---|---|---|---|---|---|---|
| PL_DailyIngest | Pipeline | 62 | 58 | 18.4 | 14.2 | 9.4 | $47.82 | $20.09 |
| NB_Transform | Notebook | 186 | 71 | 2.1 | 26.9 | 0.0 | $124.50 | $36.10 |
| DF_CustomerSync | Dataflow | 31 | 92 | 0.0 | 8.0 | 0.0 | $18.20 | $1.46 |
| PL_MasterOrch | Pipeline | 30 | 44 | 32.0 | 18.5 | 5.5 | $89.10 | $49.94 |

PL_MasterOrch has a waste score of 44 --- meaning 56% of its CU consumption is wasteful. At $89.10/month in total compute, nearly $50 is being thrown away. **That single pipeline, left unaddressed, wastes $600 per year.**

## Practical Recommendations

### Audit Retry Policies (Do This Today)

- **Idempotent operations** (copy to lakehouse, overwrite mode): Safe to retry. Keep defaults.
- **Non-idempotent operations** (append mode, API calls): Set retries to 0 or 1.
- **Long-running activities** (>5 minutes): Reduce retry count to 1.
- **All activities**: Set `retryIntervalInSeconds` to at least 60.

```json
{
    "policy": {
        "retry": {
            "count": 1,
            "intervalInSeconds": 60
        },
        "timeout": "01:00:00"
    }
}
```

### Set Duration Baselines

Use this SLO query to establish P95 baselines for every scheduled item:

```sql
let Baseline = FabricEvents
| where StartTimeUtc between (ago(30d) .. ago(7d))
| where Status == "Completed"
| where DurationSeconds > 0
| summarize BaselineP95 = percentile(DurationSeconds, 95) by ItemId;
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Completed"
| where DurationSeconds > 0
| summarize CurrentP95 = percentile(DurationSeconds, 95)
    by ItemId, ItemName
| join kind=inner Baseline on ItemId
| extend DurationRatio = round(CurrentP95 / BaselineP95, 2)
| extend IsRegression = DurationRatio > 2.0
| order by DurationRatio desc
```

When `DurationRatio` exceeds 1.5, investigate. When it exceeds 2.0, treat it as a production incident. The CU cost has doubled even though nothing visibly "broke."

### Implement Dedup Guards

- Use **tumbling window triggers** instead of schedule triggers where possible
- **Check for active runs** via the Fabric REST API before proceeding
- Set pipeline **concurrency to 1** for jobs that should never overlap
- Include trigger type in run metadata so overlaps are identifiable

## Automating This With the Observability Workbench

Manually running KQL queries is a starting point, but it does not scale. The [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) automates waste detection as part of its monitoring pipeline:

**Continuous Collection** --- The collector runs on a configurable schedule, pulling job execution data from the Fabric REST API across all workspaces. Every run (successful, failed, cancelled) is captured with full duration metadata.

**Duration Regression Detection** --- The dashboard flags regressions automatically:

```
REGRESSION PL_DailyIngest: avg 4m 12s -> 11m 38s (2.76x)
```

**SLO Integration** --- Define waste-aware SLOs alongside reliability SLOs:
- "No item shall have a WasteScore below 70"
- "Total monthly wasted CU cost shall not exceed $500"
- "RetryWastePct above 20% triggers an immediate alert"

**Alert Engine** --- Evaluates waste thresholds on every collection cycle with full breakdown of which waste category is driving the score down.

## From Observability to FinOps

CU Waste Score bridges operational observability and financial accountability. Today, most Fabric teams ask "did it work?" Tomorrow, the question becomes "did it work *efficiently*?"

When your capacity is fixed, every wasted CU-second is compute that could have served another workload. When your capacity is pay-as-you-go, every wasted CU-second is dollars burned.

The Observability Workbench is [open source and available today](https://github.com/tenfingerseddy/FabricWorkloads). Point it at your capacity and find out what your waste score looks like. You might be surprised.

---

*This is post #5 in the Fabric Observability Deep Dives series. Previously: State of Fabric Observability in 2026, Cross-Item Correlation, SLO Frameworks for Fabric, and the FabCon 2026 Observability Gap.*
