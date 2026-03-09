---
title: "Why Your Fabric Pipeline Succeeded But Your Data Is Wrong"
published: false
description: "Your monitoring hub shows green. Every pipeline 'Completed.' But the revenue report has yesterday's numbers. Here's how silent failures work in Fabric."
tags: microsoft-fabric, data-engineering, observability, data-quality
series: "Fabric Observability Deep Dives"
cover_image:
canonical_url:
---

## The Pipeline That Lied

It was a Tuesday. The kind of Tuesday where everything looks fine until it isn't.

The daily revenue pipeline ran at midnight. Status: Completed. Duration: 22 minutes -- within normal range. The semantic model refreshed at 12:30 AM. Status: Completed. The morning dashboard was rendering crisp, responsive visuals when the finance team opened it at 8 AM.

Except the numbers were wrong. Not dramatically wrong -- not zero-revenue wrong or negative-balance wrong. Subtly wrong. The kind of wrong that takes a domain expert staring at a dashboard for ten minutes before they feel something is off. "These look like Friday's numbers, not Monday's."

They were. The Dataflow Gen2 that feeds the staging Lakehouse table had silently errored at 11:47 PM -- a transient connection timeout to an external data source. But here is the critical part: the dataflow's status was not "Failed." It was "Completed." The dataflow ran its transformation logic on whatever data it could reach, produced a partial result, and reported success. The downstream pipeline picked up that partial result. The notebook processed it. The semantic model refreshed on it. Four successful status indicators across four Fabric items. Zero actual fresh data.

Every item in the chain did its job. Every item reported success. And every report in the workspace was wrong for eight hours.

If this story sounds implausible, I promise you it is not. Variations of it happen in production Fabric environments regularly. (If you have not read it yet, [The State of Fabric Observability in 2026](https://dev.to/series/fabric-observability-deep-dives) covers the full landscape of monitoring gaps that make scenarios like this possible.)

## Why "Succeeded" Does Not Mean "Correct"

The monitoring hub evaluates success at the execution level: did the job run to completion without throwing an unhandled exception? That is a reasonable definition for the platform. It is also completely insufficient for operating a data pipeline in production.

Here are the ways a Fabric pipeline can succeed while your data is wrong.

### 1. Partial Source Data

A pipeline reading from an external API can succeed even when the source returns partial data. If the API is throttled and returns 60% of expected records, the pipeline processes those 60% successfully. It does not know the difference between "I got all the data" and "I got some of the data." The status is Completed.

### 2. Schema Drift Without Errors

A source system changes a column. Depending on tolerance settings, the pipeline maps what it can find, ignores the rest, and completes. The semantic model downstream now has null values in a column that should be populated. The pipeline status: Completed.

### 3. Stale Upstream Dependencies

The item that should have refreshed the source data failed or ran late, but the downstream pipeline ran on schedule regardless. Fabric pipelines do not natively check whether their upstream dependencies produced fresh data before executing. They process whatever is in the Lakehouse at execution time, and report success.

### 4. The "Stopped" Ambiguity

Fabric's monitoring hub documentation acknowledges that a notebook with "Stopped" status can mean cancelled, terminated, or completed with a misleading label. If your pipeline triggers such a notebook, the pipeline might still report "Completed."

### 5. Empty Result Sets

A pipeline query returns zero rows because a partition was not loaded or a date filter has a timezone bug. The pipeline writes an empty dataset. The semantic model refreshes on empty data. The status: Completed.

Zero rows is not a failure. It is a successful query with zero results. Fabric does not know whether zero results is expected or catastrophic.

## The Monitoring Hub Cannot Catch This

The monitoring hub operates at the **job instance level**. It tracks whether a job ran, how long it took, and whether it completed or errored. This is valuable information. It is not observability.

Observability requires understanding the *behavior* of the system:

- **Did the data actually change?** If a daily pipeline runs and the output table has the same row count and max timestamp as yesterday, something is wrong -- even if the pipeline succeeded.
- **Are downstream consumers seeing fresh data?** The pipeline might have succeeded, but if the semantic model that depends on it refreshed on stale data, the end user sees old numbers.
- **Is execution time trending in a concerning direction?** A pipeline heading from 20 minutes to 35 minutes over two weeks will eventually time out. The monitoring hub shows green checkmarks every day until the day it does not.

None of these questions can be answered by looking at the status field of individual job instances.

## Cross-Item Correlation: Seeing the Chain

The pattern that catches silent failures is cross-item correlation -- tracing the dependency chain from source to report and validating each link.

In a typical Fabric environment:

```
External Source
  --> Dataflow Gen2 (ingest)
    --> Lakehouse Table (staging)
      --> Pipeline (orchestration)
        --> Notebook (business logic)
          --> Warehouse Table (curated)
            --> Semantic Model (refresh)
              --> Report (render)
```

When you monitor each item independently, you see eight separate success indicators. When you monitor the chain, you see a single story: did fresh data flow from source to report within the expected time window?

### Freshness Propagation Failure

Without correlation, the pipeline's "Completed" status is taken at face value. With correlation:

```
11:47 PM  DF_ExternalIngest    FAILED    (upstream of PL_DailyRevenue)
12:00 AM  PL_DailyRevenue      Completed (ran on stale data)
12:22 AM  NB_RevenueCalc       Completed (child of PL_DailyRevenue)
12:31 AM  SM_RevenueDashboard  Completed (refreshed on stale data)
```

The correlation engine checks whether the upstream item succeeded within the expected window *before* the downstream item ran. When it did not, the entire chain is flagged as stale.

### Duration Chain Analysis

Individual items might be within their SLOs, but the end-to-end chain might be drifting. If pipeline, notebook, and semantic model each add 4 minutes, the chain degraded by 12 minutes total:

```kql
// End-to-End Chain Duration Analysis
FabricEvents
| where Timestamp > ago(7d)
| where Status == "Completed"
| where ItemName in ("DF_ExternalIngest", "PL_DailyRevenue",
                      "NB_RevenueCalc", "SM_RevenueDashboard")
| summarize
    ChainStartUtc = min(StartTimeUtc),
    ChainEndUtc = max(EndTimeUtc)
    by bin(Timestamp, 1d)
| extend ChainDurationMinutes = datetime_diff('minute', ChainEndUtc, ChainStartUtc)
| order by Timestamp asc
```

### Blast Radius Mapping

When a dataflow fails, what is affected? With correlation:

```
DF_ExternalIngest FAILED
  --> PL_DailyRevenue (stale data)
    --> NB_RevenueCalc (stale data)
      --> SM_RevenueDashboard (stale for Finance, Sales, Exec)
  --> PL_WeeklyAggregation (will use stale Friday data)
```

## What the Data Looks Like in Practice

We run the Observability Workbench against a live Fabric environment. Here is what correlation surfaces that status checks miss.

### The 24.5% Alert Rate

In the first week of continuous monitoring, 24.5% of job events triggered at least one alert. The monitoring hub showed the vast majority as successful.

- **Duration regressions**: Two notebooks had P95 increases over 150% week-over-week. They succeeded every time but were getting slower.
- **Freshness violations**: A semantic model refreshed on schedule, but its source pipeline was running 2 hours late due to an upstream change.
- **Correlation gaps**: A pipeline triggered three notebooks. Two ran normally. The third completed in 8 seconds instead of 12 minutes -- an empty input table caused an early exit. The pipeline reported "Completed."

### The Pipeline That Always Succeeds

One production pipeline maintains a 100% success rate over 30 days. But on 3 of those days, it ran before its upstream dependency completed. It processed yesterday's data. The reports were subtly wrong for ~4 hours each time.

Success rate: 100%. Data correctness: 90%.

## Building Your Own Silent Failure Detection

Three KQL queries you can run today against any Eventhouse with Fabric event data.

### 1. Stale Data Detector

```kql
// Items that succeeded after another item in the workspace failed
let RecentFailures = FabricEvents
    | where Timestamp > ago(24h)
    | where Status == "Failed"
    | distinct ItemName, WorkspaceName, StartTimeUtc;
let RecentSuccesses = FabricEvents
    | where Timestamp > ago(24h)
    | where Status == "Completed"
    | distinct ItemName, WorkspaceName, StartTimeUtc, EndTimeUtc;
RecentSuccesses
| join kind=inner RecentFailures on WorkspaceName
| where StartTimeUtc > StartTimeUtc1
| project
    SucceededItem = ItemName,
    FailedUpstream = ItemName1,
    FailedAt = StartTimeUtc1,
    SucceededAt = StartTimeUtc,
    WorkspaceName
| distinct SucceededItem, FailedUpstream, FailedAt, SucceededAt, WorkspaceName
```

### 2. Anomalous Duration Detector

```kql
// Runs that completed much faster than their baseline (possible empty results)
FabricEvents
| where Timestamp > ago(7d)
| where Status == "Completed" and DurationMs > 0
| summarize
    MedianDuration = percentile(DurationMs, 50),
    P5Duration = percentile(DurationMs, 5),
    RunCount = count()
    by ItemName, ItemType
| join kind=inner (
    FabricEvents
    | where Timestamp > ago(24h)
    | where Status == "Completed" and DurationMs > 0
    | project ItemName, JobInstanceId, DurationMs, StartTimeUtc
) on ItemName
| where DurationMs < P5Duration * 0.5
| where RunCount >= 5
| project
    ItemName,
    ItemType,
    JobInstanceId,
    ActualDuration_Sec = round(DurationMs / 1000.0, 1),
    Median_Sec = round(MedianDuration / 1000.0, 1),
    SpeedupRatio = round(todouble(MedianDuration) / DurationMs, 1),
    StartTimeUtc
| order by SpeedupRatio desc
```

A pipeline that usually takes 15 minutes completing in 8 seconds is not a performance win. It is probably processing zero rows.

### 3. Freshness Gap Detector

```kql
// Items whose freshness exceeds their typical schedule interval
FabricEvents
| where Timestamp > ago(14d)
| where Status == "Completed"
| summarize
    AvgGapHours = avg(datetime_diff('hour', Timestamp, prev(EndTimeUtc, 1))),
    LastSuccess = max(EndTimeUtc),
    RunCount = count()
    by ItemName, ItemType
| extend CurrentFreshnessHours = datetime_diff('hour', now(), LastSuccess)
| where CurrentFreshnessHours > AvgGapHours * 2
| where RunCount >= 3
| project
    ItemName,
    ItemType,
    CurrentFreshnessHours,
    TypicalGapHours = round(AvgGapHours, 1),
    FreshnessFactor = round(todouble(CurrentFreshnessHours) / AvgGapHours, 1),
    LastSuccess
| order by FreshnessFactor desc
```

## The Mindset Shift

The core problem is not that Fabric's monitoring tools are bad. They do what they are designed to do. The problem is that execution status is a proxy for data correctness, and it is a leaky proxy.

- **Status monitoring asks**: Did it run? Did it succeed?
- **Behavior observability asks**: Did fresh data flow end-to-end? Did it arrive on time? Is the volume consistent?

This is the difference between checking that the sprinkler system ran and checking that the lawn is actually watered.

## What We Are Building

The [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) automates everything in this post: cross-item correlation, freshness validation, anomalous duration detection, and SLO evaluation. It runs as a Fabric-native workload, stores events in Eventhouse, and surfaces alerts with full chain context.

The project is open source. If you have experienced the "successful pipeline, wrong data" problem, we want to hear about it.

{% embed https://github.com/tenfingerseddy/FabricWorkloads %}

---

*This is part of the "Fabric Observability Deep Dives" series. Previous: [Building Your First Fabric SLO](https://dev.to/series/fabric-observability-deep-dives). Started from the beginning? Read [The State of Fabric Observability in 2026](https://dev.to/series/fabric-observability-deep-dives). The pipeline lied to you. Now you know how to catch it.*
