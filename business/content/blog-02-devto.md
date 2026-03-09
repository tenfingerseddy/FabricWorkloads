---
title: "Cross-Item Correlation in Microsoft Fabric"
published: false
description: "Fabric's monitoring hub shows individual items but not their relationships. Here's how to build a correlation engine that traces failures across pipelines, notebooks, and semantic models."
tags: microsoft-fabric, observability, data-engineering, kql
series: "Fabric Observability Deep Dives"
cover_image: ""
canonical_url: ""
---

The pipeline completed at midnight. Status: Completed. Duration: 18 minutes. Normal.

Two hours later, the semantic model refresh failed. The error referenced a missing partition in a Lakehouse table. The on-call data engineer opened the monitoring hub, found the failed refresh, and stared at the error. Which pipeline was supposed to populate that partition? Was it the midnight run? A different one? Did the notebook that the pipeline triggered actually write data, or did it exit early?

She opened the pipeline's activity run history. Three child activities: two notebooks and a copy job. All completed. She clicked into each one. Both notebooks showed "Completed." Durations looked normal. But one of them was supposed to write to the exact Lakehouse table the semantic model needed, and the partition was empty.

Forty minutes of tab-switching, timestamp cross-referencing, and Slack messages later, she found it. The notebook had completed successfully -- but it processed zero rows because the upstream Dataflow Gen2 that feeds it had silently timed out at 11:43 PM. The dataflow was not part of the pipeline. It ran on its own schedule. It was an implicit dependency -- one that existed only in the team's mental model of the workspace.

The monitoring hub showed four green checkmarks and one red X. The actual story was a five-item dependency chain with a silent failure at the root, and it took 40 minutes of manual archaeology to reconstruct.

## The Correlation Problem in Fabric

Microsoft Fabric's monitoring hub is an item-level tool. It answers the question "what happened to this specific item?" with reasonable accuracy. But production Fabric environments do not operate at the item level. They operate at the chain level.

A typical analytics chain looks like this:

```
Dataflow Gen2 (ingest from external source)
  --> Lakehouse Table (staging)
    --> Pipeline (orchestration)
      --> Notebook (transform / business logic)
        --> Warehouse Table (curated layer)
          --> Semantic Model (refresh)
            --> Report (render for stakeholders)
```

When you monitor each item independently, you see seven separate status indicators. When something breaks, the monitoring hub tells you *which* item failed. It does not tell you *why*, because "why" lives upstream. And it does not tell you *what else is affected*, because "affected" lives downstream.

There is no "show me everything connected to this failed refresh." There is no "trace this pipeline run forward to every item that consumed its output." There is no dependency graph, no correlation chain, no blast radius map.

This is not a minor inconvenience. It is the single biggest contributor to slow incident response in Fabric environments. Every time something breaks, the data engineer becomes a human correlation engine -- manually tracing dependencies across browser tabs, cross-referencing timestamps, and reconstructing a chain that the system should already understand.

### What the Monitoring Hub Does Not Show You

Consider a failed semantic model refresh at 2:14 AM. The monitoring hub tells you:

- The refresh failed
- Error: "The partition 'sales_2026_03' does not exist"
- Duration: 45 seconds

What it does not tell you:

- The pipeline that was supposed to create that partition ran at midnight and succeeded
- A notebook within that pipeline wrote to a different partition due to a date calculation bug
- The Dataflow Gen2 that feeds the staging table timed out 2 hours earlier on a separate schedule
- Three other semantic models that depend on the same staging table are also serving stale data right now
- The report that finance reviews at 8 AM will show last week's numbers

All of that context exists within the monitoring hub's data. It is scattered across individual item histories with no thread connecting them. The data is there. The relationships are not.

## Three Correlation Strategies

Building a correlation engine requires connecting events that the platform keeps separate. There are three strategies, each catching a different type of relationship, listed in order of signal strength.

### Strategy 1: Pipeline Activity Runs (Explicit Parent-Child)

Pipelines are the one place where Fabric explicitly tracks parent-child relationships. The Pipeline Activity Runs API returns the individual activities a pipeline executed:

```
POST /v1/workspaces/{workspaceId}/datapipelines/pipelineruns/{jobId}/queryactivityruns
```

The response includes each activity's name, type, status, start time, end time, and duration. If a pipeline triggered a notebook, the API tells you so. These are explicit, high-confidence correlations.

You can match each activity to a known job instance in the workspace using two criteria:

**Name matching.** Pipeline activities typically reference the target item by name. If the activity is called `Transform_Sales_Data` and there is a notebook item called `Transform_Sales_Data` in the workspace, that is a match.

**Time matching.** When names do not align perfectly, execution timing provides a strong signal. If the activity started at 22:01:15 and a notebook job instance in the same workspace started within 60 seconds of that timestamp, they are almost certainly the same execution.

The limitation: this only captures items the pipeline *directly* invoked. It misses implicit dependencies -- items that run on independent schedules but consume the same data.

### Strategy 2: RootActivityId Matching (Shared Context)

Every job instance returned by the Fabric Jobs API includes a `rootActivityId` field. When a pipeline triggers a notebook, both job instances sometimes share the same `rootActivityId`. This is not documented as guaranteed behavior, but in practice it is a reliable signal for pipeline-triggered executions.

```
GET /v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances

Response:
{
  "id": "a1b2c3d4-...",
  "rootActivityId": "f9e8d7c6-...",
  "status": "Completed",
  "startTimeUtc": "2026-03-08T22:01:17Z"
}
```

When multiple job instances share the same `rootActivityId`, they were part of the same logical operation. This catches cases where the activity runs endpoint is unavailable (some pipeline types return 400 or 405) but the activity ID propagated correctly.

The challenge: `rootActivityId` propagation is inconsistent across item types. It is most reliable for pipeline-triggered notebooks and least reliable for independently scheduled items like Dataflow Gen2 executions. We assign these correlations medium confidence and use them to supplement, not replace, activity run matching.

### Strategy 3: Temporal Proximity (Implicit Dependencies)

Many Fabric workspaces have items that run on overlapping schedules because they form a logical chain. The Dataflow Gen2 runs at 11 PM. The pipeline runs at midnight. The semantic model refreshes at 12:30 AM. They are not explicitly linked, but they depend on each other through shared data in a Lakehouse.

Temporal proximity correlation looks for patterns: items in the same workspace that consistently run in sequence within a time window. If Item A completes and Item B starts within N minutes, repeatedly, across multiple days -- that is likely a dependency.

We assign confidence based on how consistent the pattern is:

| Occurrences (over 14 days) | Confidence |
|---|---|
| 12+ consistent sequences | High |
| 7-11 consistent sequences | Medium |
| 3-6 occurrences | Low (flagged for human review) |

This is the weakest individual signal, but it catches the implicit dependencies that no API exposes -- the independently scheduled dataflow that is actually a critical upstream dependency. These are often the dependencies that cause the worst incidents precisely because they are invisible to explicit tooling.

### Combining All Three

A robust correlation engine layers all three strategies:

1. Start with pipeline activity runs for explicit parent-child links
2. Overlay `RootActivityId` matching for shared-context correlations
3. Apply temporal proximity analysis for implicit scheduling dependencies
4. Tag each correlation with a method and a confidence score

The result is a dependency graph that evolves over time. As more events flow through the system, temporal patterns strengthen or weaken, confidence scores adjust, and the graph becomes more accurate with every ingestion cycle.

## Building an Automated Correlation Engine

The Observability Workbench ingests events from the Fabric monitoring hub every 5 minutes and stores them in an Eventhouse table called `FabricEvents`. A separate correlation notebook runs every 15 minutes, analyzes recent events, and writes records to an `EventCorrelations` table.

Here is the KQL query that finds temporally correlated event pairs within a workspace:

```kql
// Find item pairs that consistently run in sequence
let TimeWindow = 30m;
let LookbackPeriod = 14d;
let UpstreamEvents = FabricEvents
    | where StartTimeUtc > ago(LookbackPeriod)
    | where Status == "Completed"
    | project
        UpstreamEventId = EventId,
        UpstreamItemId = ItemId,
        UpstreamItemName = ItemName,
        UpstreamItemType = ItemType,
        UpstreamEndTime = EndTimeUtc,
        WorkspaceId;
let DownstreamEvents = FabricEvents
    | where StartTimeUtc > ago(LookbackPeriod)
    | where Status in ("Completed", "Failed")
    | project
        DownstreamEventId = EventId,
        DownstreamItemId = ItemId,
        DownstreamItemName = ItemName,
        DownstreamItemType = ItemType,
        DownstreamStartTime = StartTimeUtc,
        WorkspaceId;
UpstreamEvents
| join kind=inner DownstreamEvents on WorkspaceId
| where UpstreamItemId != DownstreamItemId
| where DownstreamStartTime > UpstreamEndTime
| where DownstreamStartTime < UpstreamEndTime + TimeWindow
| extend GapSeconds = datetime_diff('second', DownstreamStartTime, UpstreamEndTime)
| summarize
    Occurrences = count(),
    AvgGapSeconds = round(avg(GapSeconds), 0),
    MinGapSeconds = min(GapSeconds),
    MaxGapSeconds = max(GapSeconds)
    by UpstreamItemName, UpstreamItemType,
       DownstreamItemName, DownstreamItemType, WorkspaceId
| where Occurrences >= 3
| extend Confidence = case(
    Occurrences >= 12, "high",
    Occurrences >= 7, "medium",
    "low"
)
| project
    UpstreamItemName, UpstreamItemType,
    DownstreamItemName, DownstreamItemType,
    Occurrences, AvgGapSeconds, Confidence
| order by Occurrences desc
```

This query identifies item pairs that repeatedly run in sequence. A Dataflow Gen2 that completes 10-15 minutes before a pipeline starts, every day for two weeks, gets tagged as a high-confidence upstream dependency.

Once correlation records are written to the `EventCorrelations` table, you can trace any event's full chain -- upstream causes and downstream impact -- with a single query:

```kql
// Trace the full correlation chain for a specific event
let FocalEventId = "abc-1234-5678-def0";
// Upstream: what triggered or preceded this event
EventCorrelations
| where DownstreamEventId == FocalEventId
| project
    Direction = "upstream",
    RelatedEventId = UpstreamEventId,
    CorrelationType,
    Confidence,
    GapSeconds
| union (
    // Downstream: what this event triggered or affected
    EventCorrelations
    | where UpstreamEventId == FocalEventId
    | project
        Direction = "downstream",
        RelatedEventId = DownstreamEventId,
        CorrelationType,
        Confidence,
        GapSeconds
)
| join kind=inner FabricEvents on $left.RelatedEventId == $right.EventId
| project
    Direction,
    ItemName,
    ItemType,
    Status,
    StartTimeUtc,
    EndTimeUtc,
    DurationSeconds,
    CorrelationType,
    Confidence,
    FailureReason
| order by StartTimeUtc asc
```

Give this query any event, and it returns the full chain: what came before it, what depends on it, and the status of every link.

## The Incident Timeline

The correlation engine enables the feature that fundamentally changes how you investigate incidents: the incident timeline.

When a data engineer clicks on a failed event in the Observability Workbench dashboard, they do not see a single failed item. They see a story:

```
11:43 PM  DF_ExternalIngest     FAILED       [ROOT CAUSE]
          Dataflow Gen2 -- connection timeout to external API
          Duration: 12m 34s (baseline: 8m)
          Correlation: temporal, high confidence (14 occurrences)

12:00 AM  PL_DailyRevenue       Completed    [STALE DATA]
          Pipeline -- ran on schedule, upstream data was not refreshed
          Duration: 18m 12s
          Correlation: temporal, high confidence (14 occurrences)

12:01 AM  NB_RevenueCalc        Completed    [STALE DATA]
          Notebook -- child of PL_DailyRevenue
          Duration: 11m 45s
          Correlation: pipeline-activity, explicit

12:13 AM  NB_PartitionWriter    Completed    [STALE DATA]
          Notebook -- child of PL_DailyRevenue
          Duration: 6m 22s (wrote 0 rows, expected ~45,000)
          Correlation: pipeline-activity, explicit

02:14 AM  SM_RevenueDashboard   FAILED       [DOWNSTREAM IMPACT]
          Semantic Model -- partition 'sales_2026_03' missing
          Duration: 0m 45s
          Correlation: temporal, high confidence (12 occurrences)
```

Five items. One root cause. One view. The 40-minute investigation becomes 10 seconds of reading.

Each entry in the timeline includes the correlation method and confidence, so the engineer can immediately distinguish between definitive relationships (pipeline-activity, explicit) and inferred ones (temporal, high confidence). If a correlation is marked "low confidence," they know to verify it manually. If it is marked "pipeline-activity, explicit," they can trust it completely.

### Blast Radius Mapping

The timeline shows the linear chain, but real dependency graphs are rarely linear. A single failed Dataflow Gen2 might feed three pipelines, each triggering their own notebooks and semantic models. The blast radius view shows the full impact tree:

```
DF_ExternalIngest [FAILED -- connection timeout]
|
+-- PL_DailyRevenue [STALE DATA]
|   +-- NB_RevenueCalc [STALE]
|   +-- NB_PartitionWriter [STALE -- 0 rows written]
|   +-- SM_RevenueDashboard [FAILED]
|       +-- Report: Daily Revenue (Finance team)
|       +-- Report: Sales Summary (Sales team)
|       +-- Report: Exec Overview (Leadership)
|
+-- PL_WeeklyAggregation [STALE DATA]
|   +-- SM_WeeklyMetrics [STALE]
|       +-- Report: Weekly KPIs (Ops team)
|
+-- NB_DataQualityChecks [STALE]
```

One dataflow failure. Three pipelines affected. Five reports serving stale data to four different business teams. Without correlation, the data engineer finds and fixes the first failure. With correlation, they see the full blast radius and can communicate the impact to all affected stakeholders in one message before anyone opens a stale report.

The blast radius query in KQL:

```kql
// Recursive blast radius: all downstream items affected by a failure
let RootFailure = FabricEvents
    | where Status == "Failed"
    | where Timestamp > ago(24h)
    | project EventId, ItemName, ItemType, FailureReason, StartTimeUtc;
let DirectImpact = EventCorrelations
    | where UpstreamEventId in (toscalar(RootFailure | project EventId))
    | project DownstreamEventId, CorrelationType, Confidence;
DirectImpact
| join kind=inner FabricEvents on $left.DownstreamEventId == $right.EventId
| project
    RootCause = toscalar(RootFailure | take 1 | project ItemName),
    AffectedItem = ItemName,
    AffectedType = ItemType,
    AffectedStatus = Status,
    CorrelationType,
    Confidence
| summarize
    AffectedItems = make_set(AffectedItem),
    AffectedTypes = make_set(AffectedType),
    StatusBreakdown = make_bag(pack(AffectedItem, AffectedStatus))
    by RootCause
| extend BlastRadius = array_length(AffectedItems)
```

### The Morning Summary

The incident timeline also powers a "what happened overnight" summary. Instead of scrolling through the monitoring hub at 8 AM hoping nothing is broken, the morning-shift engineer sees:

```
Overnight Summary (11 PM -- 7 AM)
----------------------------------
Total events:     47
Completed:        42 (89.4%)
Failed:            3 (6.4%)
Stale data risk:   2 (4.3%)

Incident chains:  1
  Root cause: DF_ExternalIngest connection timeout (11:43 PM)
  Blast radius: 8 downstream items across 3 pipelines
  Affected teams: Finance, Sales, Leadership, Ops
  Occurrence: 3rd time this week
  Recommended action: Check external API health, add retry logic

Items requiring attention:
  SM_RevenueDashboard -- failed, manual re-trigger after dataflow recovery
  SM_WeeklyMetrics -- stale, will self-recover on next scheduled run
  NB_DataQualityChecks -- stale output, non-critical, no action needed
```

Thirty seconds of reading. Full operational awareness. No tab-switching.

## What This Means for MTTR

Mean Time to Resolution is the metric that correlation improves most directly. The difference is stark:

**Without correlation (manual investigation):**

1. Open monitoring hub, find the failed item
2. Read the error message, guess which upstream item might be responsible
3. Open that item's run history in a new tab
4. Cross-reference timestamps with the failed item
5. Repeat for each potential upstream item
6. Check if any other items are also affected
7. Typical time to root cause: 25-45 minutes

**With correlation (automated):**

1. Open the incident timeline for the failed event
2. Read the chain: root cause, propagation path, blast radius
3. Typical time to root cause: under 2 minutes

The correlation data also enriches alert context. When the alerting engine fires a notification, it includes the full chain. The alert does not say "SM_RevenueDashboard failed." It says "SM_RevenueDashboard failed because DF_ExternalIngest timed out at 11:43 PM. 8 downstream items affected across 3 pipelines. This is the 3rd occurrence this week -- consider adding retry logic to the dataflow."

That is the difference between an alert you have to investigate and an alert you can act on immediately.

## Try It

The correlation engine runs as a scheduled Fabric notebook, ingests events via the Fabric REST API, stores them in an Eventhouse, and builds correlation records every 15 minutes. In our live environment, it has identified 8 correlation chains across 137+ tracked events -- including implicit dependencies that no one on the team had documented.

The full source is open and available on GitHub: the ingestion notebook, the correlation logic, the KQL table schemas, and the queries shown in this post.

{% embed https://github.com/tenfingerseddy/FabricWorkloads %}

If you are running Fabric in production and spending time manually tracing dependencies across the monitoring hub, this is built for you. Clone the repo, point it at your workspace, and see what your dependency graph actually looks like. You might discover chains you did not know existed.

---

*This is part of the "Fabric Observability Deep Dives" series. Next up: [Building Your First Fabric SLO](https://dev.to/series/fabric-observability-deep-dives) -- how to define success rate, duration, and freshness targets with KQL queries you can run today.*
