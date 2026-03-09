---
title: "Cross-Item Correlation in Microsoft Fabric: How We Link Pipelines, Notebooks, and Refreshes Into a Single Execution Chain"
published: false
description: "A technical deep-dive into three strategies for correlating execution events across Fabric item types — activity-run matching, rootActivityId propagation, and time-window overlap — with real code, real API calls, and real KQL queries."
tags: microsoft-fabric, observability, data-engineering, kql
---

In our [previous post](https://dev.to/observability-workbench/the-state-of-fabric-observability-in-2026), we called out cross-item correlation as the most painful gap in Fabric's native monitoring tools. The response confirmed what we suspected: data engineers are spending significant time manually reconstructing execution chains across pipelines, notebooks, semantic models, and Lakehouses when something goes wrong.

This post is the technical follow-up. We're going to walk through the exact strategies we use in our correlation engine to automatically link related Fabric job executions into unified chains -- with real API calls, real TypeScript, and real KQL queries you can use today. If you've ever wished you could ask "what did this pipeline actually trigger, and what happened to each of those things?" -- this is how.

## Why Cross-Item Correlation Matters

In any non-trivial Fabric workspace, items form execution chains. A typical pattern:

1. A **Data Pipeline** runs on schedule
2. The pipeline triggers a **Notebook** activity that transforms data into a Lakehouse
3. The pipeline then triggers a **Semantic Model refresh** so reports pick up fresh data
4. Downstream **reports** render from the semantic model

When the notebook takes 40 minutes instead of its usual 12, or when the semantic model refresh fails because the notebook wrote a schema-breaking column, you need to trace back through the chain. In Fabric's monitoring hub, these are four separate items with four separate run histories. There is no native "show me everything this pipeline touched" view.

That's the problem we solve. Our correlation engine ingests all job instances across every item in a workspace and stitches them into `CorrelationChain` objects -- each one representing a pipeline run and all the child executions it spawned.

## The Three Correlation Strategies

There is no single reliable signal in the Fabric APIs that universally links a pipeline run to the notebook execution it triggered. Different pipeline configurations, activity types, and Fabric runtime versions expose different correlation hints. So we use three strategies in order of signal strength, each one catching cases the previous one missed.

### Strategy 1: Activity-Run Matching (Strongest Signal)

The Fabric REST API exposes an endpoint that returns the individual activity runs within a pipeline execution:

```http
POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/datapipelines/pipelineruns/{jobInstanceId}/queryactivityruns
Content-Type: application/json

{}
```

The response includes each activity's name, type, status, start/end times, and duration:

```json
{
  "value": [
    {
      "activityName": "Transform_Sales_Data",
      "activityType": "NotebookActivity",
      "status": "Succeeded",
      "activityRunStart": "2026-03-08T22:01:15.000Z",
      "activityRunEnd": "2026-03-08T22:14:32.000Z",
      "durationInMs": 797000
    },
    {
      "activityName": "Refresh_Sales_Model",
      "activityType": "DatasetRefreshActivity",
      "status": "Succeeded",
      "activityRunStart": "2026-03-08T22:14:45.000Z",
      "activityRunEnd": "2026-03-08T22:18:02.000Z",
      "durationInMs": 197000
    }
  ]
}
```

This is our strongest signal. The activity run tells us exactly what the pipeline executed. We match each activity to a known job instance in the same workspace using two criteria:

**Name matching** -- pipeline activities typically reference the target item by name. If the activity is called `Transform_Sales_Data` and there's a notebook item called `Transform_Sales_Data` in the workspace, that's a match.

**Time matching** -- even when names don't align perfectly, we can match on execution timing. If the activity started at 22:01:15 and a notebook job instance in the same workspace started within 60 seconds of that timestamp, we have strong evidence they're the same execution.

Here's the actual matching logic from our correlation engine:

```typescript
// Strategy 1: Match activity runs to non-pipeline jobs
for (const activity of activityRuns) {
  for (const job of nonPipelineJobs) {
    if (claimedJobIds.has(job.id)) continue;
    if (job.workspaceId !== pipelineJob.workspaceId) continue;

    // Name-based match: activity references the item
    const nameMatch =
      activity.activityName === job.itemDisplayName ||
      activity.activityName.includes(job.itemDisplayName) ||
      job.itemDisplayName.includes(activity.activityName);

    // Time-based match: started within 60 seconds of each other
    let timeOverlap = false;
    if (activity.startTime && job.startTimeUtc) {
      const activityStart = new Date(activity.startTime).getTime();
      const jobStart = new Date(job.startTimeUtc).getTime();
      timeOverlap = Math.abs(activityStart - jobStart) < 60_000;
    }

    if (nameMatch || timeOverlap) {
      children.push(job);
      claimedJobIds.add(job.id);
    }
  }
}
```

A few things to note about this code. We use a `claimedJobIds` set to prevent a single notebook execution from being claimed by multiple pipeline chains. Once a job is matched, it's off the table. We also scope matches to the same workspace -- cross-workspace correlation is a different problem requiring the Scanner API and lineage data.

The `queryactivityruns` endpoint has a quirk worth knowing: the response fields may use either camelCase or PascalCase depending on your Fabric region and API version. Our client normalizes both:

```typescript
private normalizeActivityRun(raw: RawActivityRun): PipelineActivityRun {
  const startTime = raw.activityRunStart ?? raw.startTime ?? null;
  const endTime = raw.activityRunEnd ?? raw.endTime ?? null;

  let durationMs: number | null = null;
  if (raw.durationInMs != null) {
    durationMs = raw.durationInMs;
  } else if (startTime && endTime) {
    durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  }

  return {
    activityName: raw.activityName ?? raw.ActivityName ?? "Unknown",
    activityType: raw.activityType ?? raw.ActivityType ?? "Unknown",
    status: raw.status ?? raw.Status ?? "Unknown",
    startTime,
    endTime,
    durationMs,
    error: raw.error ?? null,
    input: raw.input ?? null,
    output: raw.output ?? null,
  };
}
```

If you're calling this API yourself, handle both casing variants or you'll get `undefined` values in certain environments.

### Strategy 2: rootActivityId Matching (Medium Signal)

Every job instance returned by the Fabric Jobs API includes a `rootActivityId` field:

```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances
```

```json
{
  "value": [
    {
      "id": "a1b2c3d4-...",
      "itemId": "notebook-item-id",
      "jobType": "SparkJob",
      "status": "Completed",
      "rootActivityId": "f9e8d7c6-...",
      "startTimeUtc": "2026-03-08T22:01:17.000Z",
      "endTimeUtc": "2026-03-08T22:14:30.000Z"
    }
  ]
}
```

When a pipeline triggers a notebook, both the pipeline job instance and the notebook job instance *sometimes* share the same `rootActivityId`. This isn't documented as a guaranteed behavior, but in practice it's a reliable correlation signal for pipeline-triggered executions.

We index all non-pipeline jobs by their `rootActivityId` for O(1) lookup:

```typescript
// Index non-pipeline jobs by rootActivityId
const byRootActivity = new Map<string, EnrichedJob[]>();
for (const job of nonPipelineJobs) {
  if (job.rootActivityId) {
    const existing = byRootActivity.get(job.rootActivityId) ?? [];
    existing.push(job);
    byRootActivity.set(job.rootActivityId, existing);
  }
}

// Strategy 2: Match on shared rootActivityId
if (pipelineJob.rootActivityId) {
  const matchedByRoot = byRootActivity.get(pipelineJob.rootActivityId) ?? [];
  for (const child of matchedByRoot) {
    if (claimedJobIds.has(child.id)) continue;
    if (child.workspaceId === pipelineJob.workspaceId) {
      children.push(child);
      claimedJobIds.add(child.id);
    }
  }
}
```

This catches cases where the activity runs endpoint isn't available (some pipeline types don't support it, and you'll get a 400 or 405 response) but the rootActivityId propagated correctly.

### Strategy 3: Time-Window Overlap (Fallback)

For cases where neither activity run data nor rootActivityId matching yields results -- which happens with certain Dataflow Gen2 triggers, Copy activities, and older pipeline configurations -- we fall back to temporal correlation.

The logic: if a non-pipeline job in the same workspace started during the pipeline's execution window (with a 30-second tolerance on both ends), it's a candidate child.

```typescript
// Strategy 3: Time-window overlap within same workspace
if (children.length === 0 && pipelineJob.startTimeUtc && pipelineJob.endTimeUtc) {
  const pipelineStart = new Date(pipelineJob.startTimeUtc).getTime();
  const pipelineEnd = new Date(pipelineJob.endTimeUtc).getTime();

  for (const job of nonPipelineJobs) {
    if (claimedJobIds.has(job.id)) continue;
    if (job.workspaceId !== pipelineJob.workspaceId) continue;
    if (!job.startTimeUtc) continue;

    const jobStart = new Date(job.startTimeUtc).getTime();
    const tolerance = 30_000; // 30 seconds

    if (jobStart >= pipelineStart - tolerance && jobStart <= pipelineEnd + tolerance) {
      children.push(job);
      claimedJobIds.add(job.id);
    }
  }
}
```

This strategy is intentionally a fallback -- `children.length === 0` ensures it only fires when Strategies 1 and 2 found nothing. Time overlap is the weakest signal because unrelated jobs might coincidentally run during the same window. But in workspaces with clear pipeline-driven patterns, it catches the remaining 5-10% of correlations that the stronger strategies miss.

## The CorrelationChain Data Model

Each matched set of jobs becomes a `CorrelationChain`:

```typescript
interface CorrelationChain {
  pipelineJob: EnrichedJob;       // The root pipeline execution
  childJobs: EnrichedJob[];       // Notebooks, Spark jobs, refreshes it triggered
  activityRuns: PipelineActivityRun[]; // Raw activity-level detail from the API
  totalDurationMs: number;        // Wall-clock time from earliest start to latest end
}
```

The `totalDurationMs` is computed across all jobs in the chain -- pipeline and children -- giving you the true end-to-end duration, not just the pipeline's own execution time. A pipeline might report a 2-minute duration if it fires off an async notebook and moves on, but the chain's total duration captures the notebook's 25-minute execution too.

## Querying Correlation Data with KQL

Once correlation chains are ingested into an Eventhouse, they unlock queries that are impossible against the raw Fabric monitoring tools. Here are the ones we run most often.

### Find All Children of a Specific Pipeline Run

```kql
CorrelationChains
| where PipelineJobId == "a1b2c3d4-..."
| mv-expand ChildJob = ChildJobs
| project
    PipelineName = PipelineItemName,
    ChildItemName = tostring(ChildJob.itemDisplayName),
    ChildItemType = tostring(ChildJob.itemType),
    ChildStatus = tostring(ChildJob.status),
    ChildStartUtc = todatetime(ChildJob.startTimeUtc),
    ChildEndUtc = todatetime(ChildJob.endTimeUtc),
    ChildDurationMin = datetime_diff('minute', todatetime(ChildJob.endTimeUtc), todatetime(ChildJob.startTimeUtc))
| order by ChildStartUtc asc
```

### Identify Pipeline Chains With Mixed Success/Failure

This is the "what chains had partial failures" query -- the pipeline succeeded but a child didn't, or vice versa:

```kql
CorrelationChains
| where Timestamp > ago(7d)
| mv-expand ChildJob = ChildJobs
| extend ChildStatus = tostring(ChildJob.status)
| summarize
    PipelineStatus = take_any(PipelineStatus),
    ChildStatuses = make_set(ChildStatus),
    ChildCount = dcount(tostring(ChildJob.id))
    by PipelineJobId, PipelineItemName
| where ChildStatuses has "Failed" or (PipelineStatus == "Failed" and ChildStatuses has "Completed")
| order by PipelineItemName asc
```

This catches the scenario from our first blog post -- where a pipeline "succeeds" but a child notebook silently fails, and downstream items refresh on stale data.

### End-to-End Duration Trends by Pipeline

```kql
CorrelationChains
| where Timestamp > ago(30d)
| summarize
    AvgChainDurationMin = avg(TotalDurationMs) / 60000.0,
    P95ChainDurationMin = percentile(TotalDurationMs, 95) / 60000.0,
    MaxChainDurationMin = max(TotalDurationMs) / 60000.0,
    RunCount = count()
    by PipelineItemName, bin(Timestamp, 1d)
| order by PipelineItemName asc, Timestamp asc
```

### Blast Radius: Which Items Are Affected by a Pipeline Failure?

```kql
CorrelationChains
| where PipelineStatus == "Failed" and Timestamp > ago(7d)
| mv-expand ChildJob = ChildJobs
| summarize
    AffectedItems = make_set(tostring(ChildJob.itemDisplayName)),
    AffectedTypes = make_set(tostring(ChildJob.itemType)),
    FailureCount = count()
    by PipelineItemName
| extend BlastRadius = array_length(AffectedItems)
| order by BlastRadius desc
```

This ranks your pipelines by blast radius -- how many downstream items are affected when each one fails. High blast-radius pipelines are where you invest in reliability first.

### Correlation Coverage: How Many Jobs Are We Linking?

```kql
let TotalJobs = FabricJobs | where Timestamp > ago(7d) | count;
let CorrelatedJobs = CorrelationChains
    | where Timestamp > ago(7d)
    | mv-expand ChildJob = ChildJobs
    | summarize CorrelatedCount = dcount(tostring(ChildJob.id));
CorrelatedJobs
| extend TotalJobs = toscalar(TotalJobs)
| extend CoveragePercent = round(100.0 * CorrelatedCount / TotalJobs, 1)
```

We track correlation coverage as a health metric for the engine itself. In a well-structured workspace where pipelines orchestrate most work, coverage should be above 80%. If it drops, something changed in the workspace topology.

## Collecting the Data: The Full Pipeline

The correlation engine doesn't work in isolation. It sits at step 3 of our collection cycle:

1. **Discover workspaces** -- `GET /workspaces` with pagination
2. **Collect all job instances** -- iterate every item that supports the Jobs API (DataPipeline, Notebook, CopyJob, Lakehouse, SemanticModel, Dataflow, SparkJobDefinition, MLExperiment, MLModel), collect their job instances
3. **Query activity runs** -- for each pipeline job, call `queryactivityruns` to get activity-level detail
4. **Build correlation chains** -- run the three-strategy matching
5. **Compute SLO metrics** -- success rates, duration percentiles, freshness per item

Step 2 is where most of the API calls happen. The Fabric Jobs API uses pagination with `continuationToken`, and rate limits are real -- we handle 429 responses with exponential backoff:

```typescript
// Rate-limit handling in our Fabric client
if (response.status === 429) {
  const retryAfter =
    parseInt(response.headers.get("Retry-After") ?? "", 10) * 1000 || 10_000;
  await sleep(retryAfter);
  continue; // retry the request
}
```

Step 3 can fail for certain pipeline types. Not all pipelines support the `queryactivityruns` endpoint -- some return 400 or 405. We swallow those gracefully and fall back to Strategies 2 and 3.

## Limitations and What's Next

This approach has known limitations we're actively working on:

**Cross-workspace correlation.** Our current engine correlates within a single workspace. Pipelines that trigger items in other workspaces (via cross-workspace references) need the Scanner API's lineage data to map. That's on the roadmap.

**Dataflow Gen2 gaps.** Dataflow Gen2 executions don't always expose job instances through the standard Jobs API, and their relationship to triggering pipelines is harder to trace. We're exploring the Dataflow-specific endpoints for better coverage.

**Time-window false positives.** Strategy 3 can incorrectly correlate unrelated jobs that happen to overlap in time. In high-throughput workspaces with many concurrent scheduled jobs, we're looking at narrowing the tolerance window and adding item-type filtering to reduce noise.

**The rootActivityId question.** We've observed that rootActivityId propagation is inconsistent across Fabric runtime versions. Some job types propagate it reliably; others don't. We're building a compatibility matrix based on our telemetry.

## Try It Yourself

The full correlation engine, Fabric REST API client, and collection pipeline are open source. You can read the implementation, run it against your own workspace, or contribute improvements:

{% embed https://github.com/tenfingerseddy/FabricWorkloads %}

The two files that contain everything discussed in this post:

- `src/collector.ts` -- the correlation engine and collection orchestrator
- `src/fabric-client.ts` -- the typed Fabric REST API client with pagination and rate-limit handling

If you're building your own Fabric observability tooling, fork the repo and adapt the correlation strategies to your workspace topology. If you find a new correlation signal we're not using, open an issue -- we want to hear about it.

In the next post, we'll go deeper on the SLO metrics computation -- how we calculate success rates, duration percentiles, and data freshness scores across every item in a workspace, and how to set meaningful reliability targets for Fabric workloads.

---

*This post is by the team behind [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- an open-source native Fabric workload for production observability in Microsoft Fabric. Follow the project on [GitHub](https://github.com/tenfingerseddy/FabricWorkloads) and join the conversation.*
