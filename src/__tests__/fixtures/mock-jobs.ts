/**
 * Mock job instances for testing.
 */
import type { EnrichedJob, PipelineActivityRun } from "../../fabric-client.ts";

// ── Helper to create enriched jobs quickly ──────────────────────────

let jobCounter = 0;

interface JobOptions {
  workspaceId?: string;
  itemId?: string;
  itemDisplayName?: string;
  itemType?: string;
  jobType?: string;
  status?: string;
  rootActivityId?: string;
  startTimeUtc?: string;
  endTimeUtc?: string | null;
  invokeType?: string;
  failureReason?: string | null;
}

export function makeJob(opts: JobOptions = {}): EnrichedJob {
  jobCounter++;
  return {
    id: `job-${String(jobCounter).padStart(3, "0")}`,
    workspaceId: opts.workspaceId ?? "ws-001",
    itemId: opts.itemId ?? "item-pipeline-001",
    itemDisplayName: opts.itemDisplayName ?? "ETL-Daily-Load",
    itemType: opts.itemType ?? "DataPipeline",
    jobType: opts.jobType ?? "Pipeline",
    invokeType: opts.invokeType ?? "Scheduled",
    status: opts.status ?? "Completed",
    failureReason: opts.failureReason ?? null,
    rootActivityId: opts.rootActivityId ?? `root-${jobCounter}`,
    startTimeUtc: opts.startTimeUtc ?? "2026-03-09T08:00:00.000Z",
    endTimeUtc: opts.endTimeUtc === undefined ? "2026-03-09T08:05:00.000Z" : opts.endTimeUtc,
  };
}

/** Reset the counter between tests */
export function resetJobCounter(): void {
  jobCounter = 0;
}

// ── Pre-built job sets ──────────────────────────────────────────────

/**
 * A pipeline job with two related notebook child jobs in the same workspace.
 * The pipeline runs from 08:00 to 08:10.
 * Notebook 1 starts at 08:01 (within pipeline window).
 * Notebook 2 starts at 08:04 (within pipeline window).
 */
export function makePipelineWithChildren(): {
  pipelineJob: EnrichedJob;
  notebookJob1: EnrichedJob;
  notebookJob2: EnrichedJob;
} {
  const rootActivity = "shared-root-activity-abc";
  const pipelineJob = makeJob({
    workspaceId: "ws-001",
    itemId: "item-pipeline-001",
    itemDisplayName: "ETL-Daily-Load",
    itemType: "DataPipeline",
    jobType: "Pipeline",
    status: "Completed",
    rootActivityId: rootActivity,
    startTimeUtc: "2026-03-09T08:00:00.000Z",
    endTimeUtc: "2026-03-09T08:10:00.000Z",
  });

  const notebookJob1 = makeJob({
    workspaceId: "ws-001",
    itemId: "item-notebook-001",
    itemDisplayName: "Transform-Sales-Data",
    itemType: "Notebook",
    jobType: "SparkJob",
    status: "Completed",
    rootActivityId: rootActivity,
    startTimeUtc: "2026-03-09T08:01:00.000Z",
    endTimeUtc: "2026-03-09T08:06:00.000Z",
  });

  const notebookJob2 = makeJob({
    workspaceId: "ws-001",
    itemId: "item-notebook-002",
    itemDisplayName: "Validate-Inventory",
    itemType: "Notebook",
    jobType: "SparkJob",
    status: "Completed",
    rootActivityId: rootActivity,
    startTimeUtc: "2026-03-09T08:04:00.000Z",
    endTimeUtc: "2026-03-09T08:09:00.000Z",
  });

  return { pipelineJob, notebookJob1, notebookJob2 };
}

/**
 * A pipeline job with a child that overlaps in time but has no shared rootActivityId.
 * This tests the time-window fallback strategy (strategy 3).
 */
export function makePipelineWithTimeOverlapChild(): {
  pipelineJob: EnrichedJob;
  childJob: EnrichedJob;
} {
  const pipelineJob = makeJob({
    workspaceId: "ws-001",
    itemId: "item-pipeline-001",
    itemDisplayName: "ETL-Daily-Load",
    itemType: "DataPipeline",
    jobType: "Pipeline",
    status: "Completed",
    rootActivityId: "pipeline-only-root",
    startTimeUtc: "2026-03-09T10:00:00.000Z",
    endTimeUtc: "2026-03-09T10:15:00.000Z",
  });

  const childJob = makeJob({
    workspaceId: "ws-001",
    itemId: "item-notebook-001",
    itemDisplayName: "Transform-Sales-Data",
    itemType: "Notebook",
    jobType: "SparkJob",
    status: "Completed",
    rootActivityId: "unrelated-root",  // different root, no match via strategy 2
    startTimeUtc: "2026-03-09T10:02:00.000Z",
    endTimeUtc: "2026-03-09T10:12:00.000Z",
  });

  return { pipelineJob, childJob };
}

/**
 * Two completely unrelated jobs in different workspaces that should NOT correlate.
 */
export function makeUnrelatedJobs(): {
  pipelineJob: EnrichedJob;
  unrelatedJob: EnrichedJob;
} {
  const pipelineJob = makeJob({
    workspaceId: "ws-001",
    itemId: "item-pipeline-001",
    itemDisplayName: "ETL-Daily-Load",
    itemType: "DataPipeline",
    jobType: "Pipeline",
    status: "Completed",
    rootActivityId: "root-ws1",
    startTimeUtc: "2026-03-09T08:00:00.000Z",
    endTimeUtc: "2026-03-09T08:10:00.000Z",
  });

  const unrelatedJob = makeJob({
    workspaceId: "ws-002",  // different workspace
    itemId: "item-notebook-003",
    itemDisplayName: "Experiment-Notebook",
    itemType: "Notebook",
    jobType: "SparkJob",
    status: "Completed",
    rootActivityId: "root-ws2",  // different root
    startTimeUtc: "2026-03-09T08:01:00.000Z",
    endTimeUtc: "2026-03-09T08:08:00.000Z",
  });

  return { pipelineJob, unrelatedJob };
}

/**
 * Build a set of jobs with mixed statuses for SLO metric testing.
 * Returns 10 jobs: 7 completed, 2 failed, 1 cancelled.
 */
export function makeMixedStatusJobs(): EnrichedJob[] {
  const base = {
    workspaceId: "ws-001",
    itemId: "item-pipeline-001",
    itemDisplayName: "ETL-Daily-Load",
    itemType: "DataPipeline",
    jobType: "Pipeline",
  };

  return [
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T01:00:00.000Z", endTimeUtc: "2026-03-09T01:05:00.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T02:00:00.000Z", endTimeUtc: "2026-03-09T02:03:00.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T03:00:00.000Z", endTimeUtc: "2026-03-09T03:04:00.000Z" }),
    makeJob({ ...base, status: "Failed", failureReason: "Timeout", startTimeUtc: "2026-03-09T04:00:00.000Z", endTimeUtc: "2026-03-09T04:10:00.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T05:00:00.000Z", endTimeUtc: "2026-03-09T05:02:00.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T06:00:00.000Z", endTimeUtc: "2026-03-09T06:06:00.000Z" }),
    makeJob({ ...base, status: "Failed", failureReason: "OOM", startTimeUtc: "2026-03-09T07:00:00.000Z", endTimeUtc: "2026-03-09T07:01:00.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T08:00:00.000Z", endTimeUtc: "2026-03-09T08:04:00.000Z" }),
    makeJob({ ...base, status: "Cancelled", startTimeUtc: "2026-03-09T09:00:00.000Z", endTimeUtc: "2026-03-09T09:00:30.000Z" }),
    makeJob({ ...base, status: "Completed", startTimeUtc: "2026-03-09T10:00:00.000Z", endTimeUtc: "2026-03-09T10:05:00.000Z" }),
  ];
}

/**
 * Build jobs that are all failures — for consecutive failure testing.
 */
export function makeConsecutiveFailures(count: number): EnrichedJob[] {
  const jobs: EnrichedJob[] = [];
  for (let i = 0; i < count; i++) {
    jobs.push(
      makeJob({
        workspaceId: "ws-001",
        itemId: "item-pipeline-001",
        itemDisplayName: "ETL-Daily-Load",
        itemType: "DataPipeline",
        jobType: "Pipeline",
        status: "Failed",
        failureReason: `Error ${i + 1}`,
        startTimeUtc: `2026-03-09T${String(i + 1).padStart(2, "0")}:00:00.000Z`,
        endTimeUtc: `2026-03-09T${String(i + 1).padStart(2, "0")}:05:00.000Z`,
      })
    );
  }
  return jobs;
}

/**
 * Sample activity runs for a pipeline execution.
 */
export function makePipelineActivityRuns(): PipelineActivityRun[] {
  return [
    {
      activityName: "Transform-Sales-Data",
      activityType: "NotebookActivity",
      status: "Succeeded",
      startTime: "2026-03-09T08:01:00.000Z",
      endTime: "2026-03-09T08:06:00.000Z",
      durationMs: 300_000,
      error: null,
      input: null,
      output: null,
      activityRunId: "act-run-001",
      pipelineRunId: "pipeline-run-001",
    },
    {
      activityName: "Validate-Inventory",
      activityType: "NotebookActivity",
      status: "Succeeded",
      startTime: "2026-03-09T08:04:00.000Z",
      endTime: "2026-03-09T08:09:00.000Z",
      durationMs: 300_000,
      error: null,
      input: null,
      output: null,
      activityRunId: "act-run-002",
      pipelineRunId: "pipeline-run-001",
    },
  ];
}
