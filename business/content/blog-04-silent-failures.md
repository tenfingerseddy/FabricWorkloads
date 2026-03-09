# Why Your Fabric Pipeline Succeeded But Your Data Is Wrong

*The monitoring hub shows green. The pipeline status says "Completed." But the revenue report is showing numbers from two days ago, and nobody noticed until the CFO asked. Here is how silent failures work in Microsoft Fabric, and why status checks alone will never catch them.*

---

## The Pipeline That Lied

It was a Tuesday. The kind of Tuesday where everything looks fine until it isn't.

The daily revenue pipeline ran at midnight. Status: Completed. Duration: 22 minutes -- within normal range. The semantic model refreshed at 12:30 AM. Status: Completed. The morning dashboard was rendering crisp, responsive visuals when the finance team opened it at 8 AM.

Except the numbers were wrong. Not dramatically wrong -- not zero-revenue wrong or negative-balance wrong. Subtly wrong. The kind of wrong that takes a domain expert staring at a dashboard for ten minutes before they feel something is off. "These look like Friday's numbers, not Monday's."

They were. The Dataflow Gen2 that feeds the staging Lakehouse table had silently errored at 11:47 PM -- a transient connection timeout to an external data source. But here is the critical part: the dataflow's status was not "Failed." It was "Completed." The dataflow ran its transformation logic on whatever data it could reach, produced a partial result, and reported success. The downstream pipeline picked up that partial result. The notebook processed it. The semantic model refreshed on it. Four successful status indicators across four Fabric items. Zero actual fresh data.

Every item in the chain did its job. Every item reported success. And every report in the workspace was wrong for eight hours.

If this story sounds implausible, I promise you it is not. Variations of it happen in production Fabric environments regularly. Not because Fabric is broken -- but because the concept of "success" in a data pipeline is far more nuanced than a binary status flag.

## Why "Succeeded" Doesn't Mean "Correct"

The monitoring hub evaluates success at the execution level: did the job run to completion without throwing an unhandled exception? That is a reasonable definition for the platform to use. It is also a completely insufficient definition for anyone operating a data pipeline in production.

Here are the ways a Fabric pipeline can succeed while your data is wrong.

### 1. Partial Source Data

A pipeline that reads from an external API, a database, or a file system can succeed even when the source returns partial data. If the API is throttled and returns 60% of expected records, the pipeline processes those 60% successfully. It does not know the difference between "I got all the data" and "I got some of the data." The status is Completed.

This is especially common with paginated APIs where the first N pages return fine but a rate limit cuts off the remaining pages. The pipeline sees a successful HTTP 200 for every request it made. The requests it never made do not register as failures.

### 2. Schema Drift Without Errors

A source system adds a new column. Or removes one. Or changes a data type. Depending on your pipeline's tolerance settings, this might not throw an error -- the pipeline maps the columns it can find, ignores the rest, and completes. The semantic model downstream now has null values in a column that should be populated, or it is silently dropping rows that fail a type cast. The pipeline status: Completed.

### 3. Stale Upstream Dependencies

This is the scenario from our opening story. The item that should have refreshed the source data failed or ran late, but the downstream pipeline ran on schedule regardless. Fabric pipelines do not natively check whether their upstream dependencies produced fresh data before executing. They run, process whatever is in the Lakehouse at execution time, and report success.

### 4. The "Stopped" Ambiguity

Fabric's own monitoring hub documentation acknowledges that a notebook execution showing a status of "Stopped" can mean different things: cancelled by the user, terminated by the system, or completed successfully with a misleading status label. If your pipeline triggers a notebook, and that notebook finishes with "Stopped" status, the pipeline might still report its own status as "Completed" because the notebook did not throw an exception back to the pipeline context.

### 5. Empty Result Sets

A pipeline runs a query against a Lakehouse table. The table exists. The query executes. But the WHERE clause returns zero rows because a partition was not loaded, or a date filter references tomorrow instead of today due to a timezone bug. The pipeline completes. It writes an empty dataset downstream. The semantic model refreshes on an empty dataset. Depending on the model's configuration, it might show the previous values (stale data) or show blank visuals.

Zero rows is not a failure. It is a successful query with zero results. Fabric does not know whether zero results is expected or catastrophic.

## The Monitoring Hub Cannot Catch This

Let me be precise about why the monitoring hub, as designed, cannot detect silent failures.

The monitoring hub operates at the **job instance level**. It tracks whether a job ran, how long it took, and whether it completed or threw an error. This is valuable information. It is not observability.

Observability requires understanding the *behavior* of the system, not just the *status* of individual components. In the context of data pipelines, behavior includes:

- **Did the data actually change?** If a daily pipeline runs and the output table has the same row count and max timestamp as yesterday, something is wrong -- even if the pipeline succeeded.
- **Are the downstream consumers seeing fresh data?** The pipeline might have succeeded, but if the semantic model refresh that depends on it has not run (or ran on stale data), the end user is still looking at old numbers.
- **Is the execution time trending in a concerning direction?** A pipeline that takes 20 minutes today, 25 minutes next week, and 35 minutes the week after is heading toward failure. It will probably succeed for another month before it finally times out. The monitoring hub will show green checkmarks every day until the day it doesn't.

None of these questions can be answered by looking at the status field of individual job instances.

## Cross-Item Correlation: Seeing the Chain

The pattern that catches silent failures is cross-item correlation -- tracing the dependency chain from source to report and validating each link.

In a typical Fabric environment, data flows through a chain of items:

```
External Source
  --> Dataflow Gen2 (ingest and transform)
    --> Lakehouse Table (staging)
      --> Pipeline (orchestration)
        --> Notebook (business logic)
          --> Warehouse / Lakehouse Table (curated)
            --> Semantic Model (refresh)
              --> Report (render)
```

When you monitor each item independently, you see eight separate success indicators. When you monitor the chain, you see a single story: did fresh data flow from source to report within the expected time window?

Here is what cross-item correlation catches that individual status checks miss.

### Freshness Propagation Failure

The Dataflow Gen2 failed at 11:47 PM but the pipeline ran at midnight. Without correlation, the pipeline's "Completed" status is taken at face value. With correlation, you see:

```
11:47 PM  DF_ExternalIngest    FAILED    (upstream of PL_DailyRevenue)
12:00 AM  PL_DailyRevenue      Completed (ran on stale data -- DF_ExternalIngest last success: 11:00 PM YESTERDAY)
12:22 AM  NB_RevenueCalc       Completed (child of PL_DailyRevenue)
12:31 AM  SM_RevenueDashboard  Completed (downstream -- refreshed on stale data)
```

The correlation engine does not just check if PL_DailyRevenue succeeded. It checks whether DF_ExternalIngest -- the item that feeds PL_DailyRevenue's source table -- succeeded within the expected window before PL_DailyRevenue ran. When it didn't, the correlation engine flags the entire chain as stale, regardless of individual statuses.

### Duration Chain Analysis

Individual items might be within their duration SLOs, but the end-to-end chain might be drifting. If the pipeline takes 5 minutes longer, the notebook takes 3 minutes longer, and the semantic model refresh takes 4 minutes longer, the total chain has degraded by 12 minutes. No individual item breached its SLO, but the chain is now 12 minutes closer to missing the 8 AM stakeholder deadline.

Correlation chains calculate total end-to-end duration:

```kql
// End-to-End Chain Duration Analysis
FabricEvents
| where Timestamp > ago(7d)
| where Status == "Completed"
| where ItemName in ("DF_ExternalIngest", "PL_DailyRevenue", "NB_RevenueCalc", "SM_RevenueDashboard")
| summarize
    ChainStartUtc = min(StartTimeUtc),
    ChainEndUtc = max(EndTimeUtc)
    by bin(Timestamp, 1d)
| extend ChainDurationMinutes = datetime_diff('minute', ChainEndUtc, ChainStartUtc)
| order by Timestamp asc
```

If that chain duration is creeping from 45 minutes to 55 minutes to 70 minutes over two weeks, you know the 8 AM deadline is at risk -- even though every individual item is green.

### Blast Radius Mapping

When a dataflow fails, what is affected? Without correlation, you have to manually trace every downstream dependency. With correlation, you immediately see:

```
DF_ExternalIngest FAILED
  --> Affects: PL_DailyRevenue (will run on stale data)
    --> Affects: NB_RevenueCalc (will process stale data)
      --> Affects: SM_RevenueDashboard (will show stale numbers)
        --> Affects: 3 reports used by Finance, Sales, Executive teams
  --> Also affects: PL_WeeklyAggregation (runs Saturday, will use stale Friday data)
```

This is the blast radius. Knowing it immediately lets you make an informed decision: do you re-trigger the dataflow now, or is the impact limited enough to wait until the next scheduled run?

## What the Data Looks Like in Practice

We run the Observability Workbench against a live Fabric environment with multiple workspaces, dozens of items, and scheduled pipeline orchestrations. Here is what the correlation engine surfaces that individual status checks would miss.

### Real Pattern: The 24.5% Alert Rate

In the first week of continuous monitoring, 24.5% of job events triggered at least one alert. The monitoring hub showed the vast majority of these as successful runs. The alerts came from:

- **Duration regressions**: Two notebooks had P95 duration increases of more than 150% week-over-week. They succeeded every time, but they were getting slower. Without duration SLOs, this would have been invisible until one of them eventually timed out.
- **Freshness violations**: A semantic model was refreshing on schedule, but its source pipeline was running 2 hours later than usual due to an upstream dependency change. The semantic model "succeeded" but was consistently serving data that was 2 hours older than intended.
- **Correlation gaps**: A pipeline orchestrator triggered three notebook executions. Two completed normally. The third completed in 8 seconds instead of its usual 12 minutes -- it hit an early exit condition due to an empty input table. The pipeline reported "Completed." The correlation engine flagged the anomalous duration.

None of these would appear as failures in the monitoring hub. All of them represent real data quality risks.

### Real Pattern: The Pipeline That Always Succeeds

One production pipeline in our environment has maintained a 100% success rate over 30 days. Green checkmarks every day. But the correlation engine shows that on 3 of those 30 days, the pipeline ran before its upstream dependency completed. The pipeline processed yesterday's data instead of today's. The semantic model refreshed on stale data. The reports were subtly wrong for approximately 4 hours on each of those days -- between the pipeline's completion and the next scheduled run that processed the correct data.

Success rate: 100%. Data correctness: 90%. The monitoring hub shows one number. The correlation engine shows both.

## Building Your Own Silent Failure Detection

You do not need a commercial observability tool to start catching silent failures. Here are three KQL queries you can run against any Eventhouse with Fabric event data.

### 1. Stale Data Detector

Identify items that succeeded but whose data might be stale because an upstream dependency failed:

```kql
// Find items that ran successfully but whose upstream items failed recently
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
| where StartTimeUtc > StartTimeUtc1    // Success happened after the failure
| project
    SucceededItem = ItemName,
    FailedUpstream = ItemName1,
    FailedAt = StartTimeUtc1,
    SucceededAt = StartTimeUtc,
    WorkspaceName
| distinct SucceededItem, FailedUpstream, FailedAt, SucceededAt, WorkspaceName
```

This is a simplified heuristic -- it flags any item that succeeded after another item in the same workspace failed. In a real implementation, you would use lineage data to know the actual dependency graph rather than flagging all workspace-level co-occurrences.

### 2. Anomalous Duration Detector

Find runs that completed successfully but in an unusually short time (potential empty result sets or early exits):

```kql
// Anomalous Duration: Runs that completed much faster than their baseline
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
| where DurationMs < P5Duration * 0.5   // Less than half the 5th percentile
| where RunCount >= 5                    // Only flag items with enough history
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

Find items where there is an unexplained gap between expected and actual freshness:

```kql
// Freshness Gap: Items whose freshness exceeds their typical schedule
FabricEvents
| where Timestamp > ago(14d)
| where Status == "Completed"
| summarize
    AvgGapHours = avg(datetime_diff('hour', Timestamp, prev(EndTimeUtc, 1))),
    LastSuccess = max(EndTimeUtc),
    RunCount = count()
    by ItemName, ItemType
| extend CurrentFreshnessHours = datetime_diff('hour', now(), LastSuccess)
| where CurrentFreshnessHours > AvgGapHours * 2    // Double the typical gap
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

An item that typically runs every 6 hours but has not run in 14 hours has a freshness factor of 2.3x -- something is wrong, even if there is no failure in the monitoring hub.

## The Mindset Shift: From Status to Behavior

The core problem is not that Fabric's monitoring tools are bad. They do what they are designed to do: show you the execution status of individual items. The problem is that execution status is a proxy for data correctness, and it is a leaky proxy.

Catching silent failures requires shifting from status monitoring to behavior observability:

- **Status monitoring asks**: Did it run? Did it succeed?
- **Behavior observability asks**: Did fresh data flow end-to-end? Did it arrive on time? Is the volume consistent with expectations? Are the downstream consumers actually seeing updated numbers?

This is the difference between checking that the sprinkler system ran and checking that the lawn is actually watered.

## What We Are Building

The Observability Workbench automates everything described in this post: cross-item correlation that traces dependency chains, freshness validation that compares upstream completion times against downstream execution times, anomalous duration detection that flags suspiciously fast or slow runs, and SLO evaluation that tracks success rate, duration, and freshness across rolling windows.

It runs as a Fabric-native workload inside your workspace, stores events in Eventhouse for long-retention analysis, and surfaces alerts that give you the full chain context -- not just "Pipeline X failed" but "Pipeline X processed stale data because Dataflow Y failed 2 hours earlier, affecting Semantic Model Z and 3 downstream reports."

The project is open source: [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)

If you have experienced the "successful pipeline, wrong data" problem -- or if you have built your own detection mechanisms for it -- we want to hear about it. Drop a comment or open an issue on GitHub. The more patterns we catalogue, the better the detection engine becomes.

---

*This is part of the "Fabric Observability Deep Dives" series. Previous: [Building Your First Fabric SLO](/blog/building-your-first-fabric-slo). The pipeline lied to you. Now you know how to catch it.*
