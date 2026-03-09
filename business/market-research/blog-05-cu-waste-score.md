# CU Waste Score: Quantifying Compute Waste in Microsoft Fabric

**Published:** March 2026
**Series:** Fabric Observability Deep Dives (#5)
**Author:** Kane Snyder
**Reading time:** ~10 minutes

---

## The Bill Nobody Audits

Microsoft Fabric's capacity model is elegant in theory: buy an F-SKU, get a pool of Capacity Units (CUs) that every workload shares. Pipelines, notebooks, dataflows, semantic model refreshes --- they all draw from the same well. The problem is that nobody tracks where the water goes.

With an F64 SKU priced at approximately $11.52 per hour --- roughly $0.0032 per CU-second --- even modest inefficiencies compound fast. A pipeline that fails after running for 8 minutes still consumed those CUs. A notebook that runs 3x longer than its baseline because someone added a collect() on a 40-million-row DataFrame burns through capacity that could have served three other jobs. A manual rerun that overlaps with the already-scheduled run doubles the cost of that execution window.

Most Fabric teams have zero visibility into this. The Monitoring Hub shows you what ran and whether it succeeded. It does not show you what that run *cost* relative to what it *should have cost*. That gap is what we set out to close.

## Three Types of Compute Waste

After analyzing hundreds of job execution patterns across production Fabric environments, we identified three distinct categories of compute waste. Each has different root causes, different detection methods, and different remediation strategies.

### 1. Retry Waste

Fabric data pipelines support configurable retry policies. The defaults are generous --- many activities retry up to 3 times with a 30-second interval. This is sensible for transient failures (network blips, brief throttling), but catastrophic for deterministic ones.

Consider a pipeline activity that fails because a source table was dropped. It runs for 6 minutes, fails, waits 30 seconds, runs for another 6 minutes, fails again, waits, runs a third time, fails permanently. That is 18 minutes of CU consumption for a job that was never going to succeed after the first attempt.

The waste pattern:

```
Run 1: 6m 12s  -> Failed (table not found)
Run 2: 6m 08s  -> Failed (table not found)  [retry 1]
Run 3: 6m 15s  -> Failed (table not found)  [retry 2]
─────────────────────────────────────────────
Total: 18m 35s consumed, 0 useful work done
CU cost: ~$3.56 at F64 rates
```

Now multiply that by every failed activity across every pipeline in every workspace. In one environment we analyzed, retry waste accounted for 12% of total monthly CU consumption.

### 2. Duration Regression

This is the silent killer. A notebook that took 4 minutes last month now takes 11 minutes. Nobody notices because it still succeeds. The dashboard stays green. But CU consumption for that item nearly tripled.

Duration regression typically stems from three causes:

- **Data volume growth** without corresponding optimization (partitioning, filtering, column pruning)
- **Resource contention** from overlapping execution windows as workload count grows
- **Missing maintenance** --- stale statistics, fragmented delta tables, accumulating small files

The insidious part is that each regression is small enough to ignore individually. A 20% increase here, a 40% increase there. But across 50 scheduled items, the aggregate effect is a capacity that runs perpetually hot --- and a team that wonders why their F64 suddenly feels undersized.

### 3. Duplicate Waste

This one is surprisingly common in teams with both scheduled triggers and manual intervention. The scenario:

1. A pipeline is scheduled to run at 06:00 UTC daily
2. At 06:02, a team member notices "it hasn't run yet" (it is running, they just checked too early) and triggers a manual run
3. Both runs execute simultaneously, processing the same data

Alternatively, overlapping schedules trigger the same pipeline twice within a window where the first run has not yet completed. Fabric does not natively deduplicate these --- both runs consume full CU allocation.

In environments with complex orchestration (master pipelines calling child pipelines), duplicate waste can cascade. One duplicate parent triggers duplicate children, each of which triggers duplicate grandchildren.

## The CU Waste Score

We built a scoring system that collapses these three waste categories into a single 0--100 metric. A score of 100 means no detectable waste. Lower scores indicate progressively worse waste profiles.

### The Formula

The CU Waste Score for an item is calculated as:

```
WasteScore = 100 - (RetryWastePct + RegressionWastePct + DuplicateWastePct)
```

Where:

- **RetryWastePct** = CU-seconds consumed by failed runs that were later retried / total CU-seconds for the item, scaled to a 0--40 range
- **RegressionWastePct** = (CurrentP95 - BaselineP95) / BaselineP95, capped and scaled to 0--35 range
- **DuplicateWastePct** = CU-seconds from overlapping runs of the same item / total CU-seconds, scaled to 0--25 range

The weighting reflects the relative controllability of each waste type. Retry waste is the most immediately actionable (fix your retry policies), so it carries the highest weight. Duration regression requires deeper investigation but has the largest long-term impact. Duplicate waste is often the easiest to prevent with simple scheduling guards.

### Cost Projection

To translate waste scores into dollars, we use the F64 baseline:

```
F64 hourly rate:     $11.52
CU-seconds per hour: 3,600
Cost per CU-second:  $0.0032

Monthly CU budget (F64): $11.52 * 730 hours = $8,409.60
Waste at score 70:       ~30% waste = ~$2,523/month
Waste at score 85:       ~15% waste = ~$1,261/month
```

For an F64 capacity, improving your waste score from 70 to 85 saves approximately $1,262 per month --- $15,144 annually. For larger SKUs (F128, F256), multiply accordingly.

## Calculating Waste with KQL

Here is a KQL query you can run directly against your Eventhouse to calculate per-item waste metrics. This query computes all three waste dimensions and produces a composite score.

```kusto
// ═══════════════════════════════════════════════════════════════
// CU Waste Score — Per-item compute waste analysis
// ═══════════════════════════════════════════════════════════════

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
    // Retry waste: CU-seconds burned by failed runs
    RetryWastePct = round(
        iff(TotalCUSeconds > 0,
            todouble(FailedCUSeconds) / TotalCUSeconds * 40.0,
            0.0), 1),
    // Regression waste: duration increase vs baseline
    RegressionRatio = iff(BaselineP95 > 0,
        CurrentP95 / BaselineP95, 1.0),
    RegressionWastePct = round(
        iff(BaselineP95 > 0,
            min_of((CurrentP95 - BaselineP95) / BaselineP95, 1.0) * 35.0,
            0.0), 1),
    // Duplicate waste: overlapping execution CUs
    DuplicateWastePct = round(
        iff(TotalCUSeconds > 0 and isnotnull(OverlapCUSeconds),
            todouble(OverlapCUSeconds) / TotalCUSeconds * 25.0,
            0.0), 1)
| extend
    WasteScore = round(100.0
        - max_of(RetryWastePct, 0.0)
        - max_of(RegressionWastePct, 0.0)
        - max_of(DuplicateWastePct, 0.0), 0),
    MonthlyCUSeconds = TotalCUSeconds,
    // F64 cost: $0.0032 per CU-second
    MonthlyEstCost = round(TotalCUSeconds * 0.0032, 2),
    WastedCost = round(
        (max_of(RetryWastePct, 0.0) + max_of(RegressionWastePct, 0.0) + max_of(DuplicateWastePct, 0.0))
        / 100.0 * TotalCUSeconds * 0.0032, 2)
| project
    WorkspaceName,
    ItemName,
    ItemType,
    TotalRuns,
    FailedRuns,
    WasteScore = max_of(WasteScore, 0),
    RetryWastePct,
    RegressionWastePct = max_of(RegressionWastePct, 0.0),
    RegressionRatio = round(RegressionRatio, 2),
    DuplicateWastePct,
    MonthlyEstCost,
    WastedCost
| order by WasteScore asc
```

### Reading the Output

The query produces a table like this:

| WorkspaceName | ItemName | ItemType | Runs | Failed | WasteScore | Retry% | Regress% | Dup% | Cost | Wasted |
|---|---|---|---|---|---|---|---|---|---|---|
| Production | PL_DailyIngest | DataPipeline | 62 | 8 | 58 | 18.4 | 14.2 | 9.4 | $47.82 | $20.09 |
| Production | NB_Transform | Notebook | 186 | 3 | 71 | 2.1 | 26.9 | 0.0 | $124.50 | $36.10 |
| Analytics | DF_CustomerSync | Dataflow | 31 | 0 | 92 | 0.0 | 8.0 | 0.0 | $18.20 | $1.46 |
| Production | PL_MasterOrch | DataPipeline | 30 | 12 | 44 | 32.0 | 18.5 | 5.5 | $89.10 | $49.94 |

In this example, PL_MasterOrch has a waste score of 44 --- meaning 56% of its CU consumption is wasteful. At $89.10/month in total compute, nearly $50 is being thrown away. That single pipeline, left unaddressed, wastes $600 per year.

## Practical Recommendations

### Audit Your Retry Policies (Immediate Impact)

Every pipeline activity has a retry configuration. Review them with these guidelines:

- **Idempotent operations** (copy to lakehouse, overwrite mode): Safe to retry. Keep defaults.
- **Non-idempotent operations** (append mode, API calls with side effects): Set retries to 0 or 1.
- **Long-running activities** (>5 minutes): Reduce retry count to 1. The cost of a retry exceeds the benefit for most deterministic failures.
- **All activities**: Set `retryIntervalInSeconds` to at least 60 for any retry-eligible activity. This gives transient issues time to resolve.

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

### Set Duration Baselines (Medium-Term)

Use the Duration SLO query from the Observability Workbench to establish P95 baselines for every scheduled item:

```kusto
// From slo-queries.kql — Duration SLO baseline comparison
let Baseline = FabricEvents
| where StartTimeUtc between (ago(30d) .. ago(7d))
| where Status == "Completed"
| where DurationSeconds > 0
| summarize BaselineP95 = percentile(DurationSeconds, 95) by ItemId;
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status == "Completed"
| where DurationSeconds > 0
| summarize CurrentP95 = percentile(DurationSeconds, 95) by ItemId, ItemName
| join kind=inner Baseline on ItemId
| extend DurationRatio = round(CurrentP95 / BaselineP95, 2)
| extend IsRegression = DurationRatio > 2.0
| order by DurationRatio desc
```

When `DurationRatio` exceeds 1.5, investigate. When it exceeds 2.0, treat it as a production incident. The CU cost has doubled even though nothing visibly "broke."

### Implement Dedup Guards (Preventive)

For pipelines with both scheduled triggers and manual execution access:

1. **Tumbling window triggers** instead of schedule triggers where possible --- they inherently prevent overlap
2. **Check for active runs** at the start of each pipeline using the Fabric REST API before proceeding
3. **Concurrency limits**: Set pipeline concurrency to 1 for jobs that should never overlap
4. **Naming conventions**: Include the trigger type in run metadata so overlaps are identifiable in telemetry

## How the Observability Workbench Automates This

Manually running KQL queries is a starting point, but it does not scale. The [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) automates waste detection as part of its broader monitoring pipeline.

### Continuous Collection

The collector module runs on a configurable schedule (default: every 15 minutes), pulling job execution data from the Fabric REST API across all workspaces in your capacity. Every run --- successful, failed, cancelled --- is captured with full duration metadata and ingested into your Eventhouse for long-term retention.

### Duration Regression Detection

The dashboard module already tracks duration trends and flags regressions:

```
REGRESSION PL_DailyIngest: avg 4m 12s -> 11m 38s (2.76x)
```

When the average duration exceeds 1.5x the previous measurement period, it surfaces in the dashboard output with the exact ratio. This catches gradual drift that humans consistently miss.

### SLO Integration

The waste score feeds into the existing SLO framework. You can define waste-aware SLOs:

- "No item in Production workspace shall have a WasteScore below 70"
- "Total monthly wasted CU cost across all workspaces shall not exceed $500"
- "Any item with RetryWastePct above 20% triggers an immediate alert"

These SLOs are evaluated alongside success rate, freshness, and duration SLOs, giving you a unified view of both reliability and efficiency.

### Alert Engine

The alert engine evaluates waste thresholds on every collection cycle. When an item's waste score drops below your configured threshold, you get an alert with the full breakdown --- which waste category is the primary contributor, the estimated dollar impact, and the trend direction (improving or worsening).

## The Bigger Picture: From Observability to FinOps

CU Waste Score is the bridge between operational observability and financial accountability. Today, most Fabric teams think about monitoring in terms of "did it work?" Tomorrow, the question becomes "did it work *efficiently*?"

This is especially relevant for organizations running multiple Fabric capacities or using capacity reservation for cost predictability. When your capacity is fixed, every wasted CU-second is compute that could have served another workload. When your capacity is pay-as-you-go, every wasted CU-second is literal dollars burned.

The Observability Workbench is open source and available today. Install it, point it at your capacity, and find out what your waste score looks like. You might be surprised.

---

**Resources:**

- [Observability Workbench on GitHub](https://github.com/tenfingerseddy/FabricWorkloads) --- Open source, MIT licensed
- [KQL Query Pack](https://github.com/tenfingerseddy/FabricWorkloads/tree/main/kql) --- 30+ ready-to-use queries including the CU Waste Score query above
- [Fabric Capacity Pricing](https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/) --- Current SKU pricing for cost calculations
- Previous in this series: [Cross-Item Correlation in Microsoft Fabric](#) | [Building an SLO Framework for Fabric](#)

---

*This is post #5 in our Fabric Observability Deep Dives series. Next up: "Alert Fatigue is Real --- Building Intelligent Alert Routing for Data Teams."*
