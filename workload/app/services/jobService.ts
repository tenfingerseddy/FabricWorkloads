/**
 * Job Service -- Observability Workbench
 *
 * Orchestrates data-collection and computation jobs that run as
 * Fabric job instances and surface in the Monitoring Hub.
 *
 * Job flow:
 *   1. Frontend submits a job request (manual or scheduled trigger)
 *   2. This service validates the request and maps it to the correct
 *      Fabric notebook or data pipeline
 *   3. The job is submitted via the Fabric Job Scheduler API
 *   4. Status is polled/tracked and returned to the caller
 *
 * All jobs use OBO auth so the user's permissions govern what
 * workspaces and data they can access.
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { JobSchedulerClient } from "../clients/JobSchedulerClient";
import {
  ItemJobInstance,
  RunOnDemandItemJobRequest,
} from "../clients/FabricPlatformTypes";
import {
  JOB_TYPES,
  ObservabilityJobType,
  JOB_TYPE_DESCRIPTIONS,
  JOB_NOTEBOOK_MAP,
  JobStatus,
  isTerminalStatus,
  SubmitJobRequest,
  CancelJobRequest,
  ObservabilityJobInstance,
  JobActivitySummary,
  JobScheduleConfig,
} from "../types/jobs";
import { ApiResponse } from "../types/workloadItems";
import { AUDIT_ACTIONS, IAuditLogger } from "../types/audit";
import { createAuditEntry } from "./auditService";
import {
  generateRequestId,
  logServerError,
  getSafeErrorMessage,
} from "../utils/errors";

// ════════════════════════════════════════════════════════════════
// Job Service
// ════════════════════════════════════════════════════════════════

export class JobService {
  private workloadClient: WorkloadClientAPI;
  private jobSchedulerClient: JobSchedulerClient;
  private auditLogger: IAuditLogger;

  /** In-memory cache of job instances we have submitted (keyed by job instance ID) */
  private submittedJobs: Map<string, ObservabilityJobInstance> = new Map();

  constructor(workloadClient: WorkloadClientAPI, auditLogger: IAuditLogger) {
    this.workloadClient = workloadClient;
    this.jobSchedulerClient = new JobSchedulerClient(workloadClient);
    this.auditLogger = auditLogger;
  }

  // ──────────────────────────────────────────────────────────────
  // Submit
  // ──────────────────────────────────────────────────────────────

  /**
   * Submit an on-demand job for a workload item.
   *
   * The item is typically a WorkbenchDashboard that owns the data-collection
   * cycle. The jobType determines which notebook/pipeline gets triggered.
   *
   * @param workspaceId  The workspace where the item lives
   * @param itemId       The workload item ID (e.g. a WorkbenchDashboard)
   * @param request      Job parameters
   */
  async submitJob(
    workspaceId: string,
    itemId: string,
    request: SubmitJobRequest
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    const startMs = Date.now();

    // Validate job type
    if (!Object.values(JOB_TYPES).includes(request.jobType)) {
      return this.errorResponse(
        "INVALID_JOB_TYPE",
        `Unknown job type: ${request.jobType}. Valid types: ${Object.values(JOB_TYPES).join(", ")}`
      );
    }

    try {
      // Build execution data payload for the Fabric job
      const executionData: Record<string, unknown> = {
        jobType: request.jobType,
        workspaceIds: request.workspaceIds ?? [],
        timeRange: request.timeRange ?? "24h",
        fullSync: request.fullSync ?? false,
        submittedAt: new Date().toISOString(),
      };

      const fabricRequest: RunOnDemandItemJobRequest = {
        executionData,
      };

      // Determine the Fabric job type to use.
      // For notebook-backed jobs, we use "SparkJob".
      // For generic data pipeline jobs, we use "Pipeline".
      const fabricJobType = JOB_NOTEBOOK_MAP[request.jobType]
        ? "SparkJob"
        : "Pipeline";

      // Submit via Fabric Job Scheduler API
      const jobInstanceId = await this.jobSchedulerClient.runOnDemandItemJob(
        workspaceId,
        itemId,
        fabricJobType,
        fabricRequest
      );

      // Build our enriched job instance
      const jobInstance: ObservabilityJobInstance = {
        id: jobInstanceId,
        itemId,
        workspaceId,
        jobType: request.jobType,
        status: "Queued",
        invokeType: "Manual",
        submittedAt: new Date().toISOString(),
        executionParams: request,
        notebookRunId: JOB_NOTEBOOK_MAP[request.jobType],
      };

      // Cache for status tracking
      this.submittedJobs.set(jobInstanceId, jobInstance);

      this.emitAudit(
        AUDIT_ACTIONS.JOB_SUBMIT,
        request.jobType,
        jobInstanceId,
        workspaceId,
        "Success",
        Date.now() - startMs,
        { itemId, fabricJobType }
      );

      return this.successResponse(jobInstance);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("JobService.submitJob", error, requestId, { workspaceId, itemId, jobType: request.jobType });

      this.emitAudit(
        AUDIT_ACTIONS.JOB_SUBMIT,
        request.jobType,
        undefined,
        workspaceId,
        "Failure",
        Date.now() - startMs,
        { error: internalMessage, itemId, requestId }
      );

      return this.errorResponse("JOB_SUBMIT_FAILED", getSafeErrorMessage(error, "JOB_SUBMIT_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Status
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the current status of a job instance.
   */
  async getJobStatus(
    workspaceId: string,
    itemId: string,
    jobInstanceId: string
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    const startMs = Date.now();

    try {
      // Fetch from Fabric API
      const fabricJob = await this.jobSchedulerClient.getItemJobInstance(
        workspaceId,
        itemId,
        jobInstanceId
      );

      // Merge with our cached enrichment data
      const cached = this.submittedJobs.get(jobInstanceId);

      const jobInstance: ObservabilityJobInstance = {
        id: fabricJob.id,
        itemId: fabricJob.itemId,
        workspaceId,
        jobType: (cached?.jobType ?? fabricJob.jobType) as ObservabilityJobType,
        status: this.mapFabricStatus(fabricJob.status),
        invokeType: fabricJob.invokeType ?? cached?.invokeType ?? "Manual",
        submittedAt: cached?.submittedAt ?? new Date().toISOString(),
        startedAt: fabricJob.startTimeUtc,
        completedAt: fabricJob.endTimeUtc,
        durationSeconds: this.computeDuration(fabricJob.startTimeUtc, fabricJob.endTimeUtc),
        rootActivityId: fabricJob.rootActivityId,
        failureReason: fabricJob.failureReason?.error?.message,
        executionParams: cached?.executionParams,
        notebookRunId: cached?.notebookRunId,
      };

      // Update cache with latest status
      if (cached) {
        this.submittedJobs.set(jobInstanceId, jobInstance);
      }

      this.emitAudit(
        AUDIT_ACTIONS.JOB_STATUS,
        jobInstance.jobType,
        jobInstanceId,
        workspaceId,
        "Success",
        Date.now() - startMs,
        { status: jobInstance.status }
      );

      return this.successResponse(jobInstance);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("JobService.getJobStatus", error, requestId, { workspaceId, itemId, jobInstanceId });

      this.emitAudit(
        AUDIT_ACTIONS.JOB_STATUS,
        "unknown",
        jobInstanceId,
        workspaceId,
        "Failure",
        Date.now() - startMs,
        { error: internalMessage, requestId }
      );

      return this.errorResponse("JOB_STATUS_FAILED", getSafeErrorMessage(error, "JOB_STATUS_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Cancel
  // ──────────────────────────────────────────────────────────────

  /**
   * Cancel a running job instance.
   */
  async cancelJob(
    workspaceId: string,
    itemId: string,
    request: CancelJobRequest
  ): Promise<ApiResponse<void>> {
    const startMs = Date.now();

    try {
      await this.jobSchedulerClient.cancelItemJobInstance(
        workspaceId,
        itemId,
        request.jobInstanceId
      );

      // Update cache
      const cached = this.submittedJobs.get(request.jobInstanceId);
      if (cached) {
        cached.status = "Cancelled";
        cached.completedAt = new Date().toISOString();
        this.submittedJobs.set(request.jobInstanceId, cached);
      }

      this.emitAudit(
        AUDIT_ACTIONS.JOB_CANCEL,
        cached?.jobType ?? "unknown",
        request.jobInstanceId,
        workspaceId,
        "Success",
        Date.now() - startMs,
        { reason: request.reason }
      );

      return this.successResponse(undefined);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("JobService.cancelJob", error, requestId, { workspaceId, itemId, jobInstanceId: request.jobInstanceId });

      this.emitAudit(
        AUDIT_ACTIONS.JOB_CANCEL,
        "unknown",
        request.jobInstanceId,
        workspaceId,
        "Failure",
        Date.now() - startMs,
        { error: internalMessage, requestId }
      );

      return this.errorResponse("JOB_CANCEL_FAILED", getSafeErrorMessage(error, "JOB_CANCEL_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // List / History
  // ──────────────────────────────────────────────────────────────

  /**
   * List recent job instances for an item.
   */
  async listJobs(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<ObservabilityJobInstance[]>> {
    try {
      const fabricJobs = await this.jobSchedulerClient.getAllItemJobInstances(
        workspaceId,
        itemId
      );

      const jobs: ObservabilityJobInstance[] = fabricJobs.map((fj) => {
        const cached = this.submittedJobs.get(fj.id);
        return {
          id: fj.id,
          itemId: fj.itemId,
          workspaceId,
          jobType: (cached?.jobType ?? fj.jobType) as ObservabilityJobType,
          status: this.mapFabricStatus(fj.status),
          invokeType: fj.invokeType ?? "Manual",
          submittedAt: cached?.submittedAt ?? fj.startTimeUtc ?? "",
          startedAt: fj.startTimeUtc,
          completedAt: fj.endTimeUtc,
          durationSeconds: this.computeDuration(fj.startTimeUtc, fj.endTimeUtc),
          rootActivityId: fj.rootActivityId,
          failureReason: fj.failureReason?.error?.message,
          executionParams: cached?.executionParams,
        };
      });

      return this.successResponse(jobs);
    } catch (error) {
      const requestId = generateRequestId();
      logServerError("JobService.listJobs", error, requestId, { workspaceId, itemId });
      return this.errorResponse("JOB_LIST_FAILED", getSafeErrorMessage(error, "JOB_LIST_FAILED"), requestId);
    }
  }

  /**
   * Get a summary of job activity for an item.
   */
  async getJobSummary(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<JobActivitySummary>> {
    try {
      const fabricJobs = await this.jobSchedulerClient.getAllItemJobInstances(
        workspaceId,
        itemId
      );

      const running = fabricJobs.filter((j) => j.status === "InProgress").length;
      const completed = fabricJobs.filter((j) => j.status === "Completed").length;
      const failed = fabricJobs.filter((j) => j.status === "Failed").length;
      const cancelled = fabricJobs.filter((j) => j.status === "Cancelled").length;

      const completedJobs = fabricJobs.filter(
        (j) => j.status === "Completed" && j.startTimeUtc && j.endTimeUtc
      );
      const totalDuration = completedJobs.reduce(
        (sum, j) => sum + (this.computeDuration(j.startTimeUtc, j.endTimeUtc) ?? 0),
        0
      );

      const lastRun = fabricJobs
        .filter((j) => j.startTimeUtc)
        .sort((a, b) => (b.startTimeUtc ?? "").localeCompare(a.startTimeUtc ?? ""))[0];

      return this.successResponse({
        totalJobs: fabricJobs.length,
        running,
        completed,
        failed,
        cancelled,
        averageDurationSeconds: completedJobs.length > 0 ? Math.round(totalDuration / completedJobs.length) : 0,
        lastRunAt: lastRun?.startTimeUtc,
      });
    } catch (error) {
      const requestId = generateRequestId();
      logServerError("JobService.getJobSummary", error, requestId, { workspaceId, itemId });
      return this.errorResponse("JOB_SUMMARY_FAILED", getSafeErrorMessage(error, "JOB_SUMMARY_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Schedule Management
  // ──────────────────────────────────────────────────────────────

  /**
   * Create a recurring schedule for a job type.
   */
  async createSchedule(
    workspaceId: string,
    itemId: string,
    config: JobScheduleConfig
  ): Promise<ApiResponse<{ scheduleId: string }>> {
    try {
      const schedule = await this.jobSchedulerClient.createItemSchedule(
        workspaceId,
        itemId,
        config.jobType,
        {
          enabled: config.enabled,
          configuration: {
            type: "Cron" as const,
            startDateTime: config.startDateTime,
            endDateTime: config.endDateTime ?? "9999-12-31T23:59:59Z",
            localTimeZoneId: config.timeZone,
          },
        }
      );

      return this.successResponse({ scheduleId: schedule.id });
    } catch (error) {
      const requestId = generateRequestId();
      logServerError("JobService.createSchedule", error, requestId, { workspaceId, itemId, jobType: config.jobType });
      return this.errorResponse("SCHEDULE_CREATE_FAILED", getSafeErrorMessage(error, "SCHEDULE_CREATE_FAILED"), requestId);
    }
  }

  /**
   * List schedules for an item and job type.
   */
  async listSchedules(
    workspaceId: string,
    itemId: string,
    jobType: ObservabilityJobType
  ): Promise<ApiResponse<{ schedules: Array<{ id: string; enabled: boolean }> }>> {
    try {
      const schedules = await this.jobSchedulerClient.getAllItemSchedules(
        workspaceId,
        itemId,
        jobType
      );

      return this.successResponse({
        schedules: schedules.map((s) => ({ id: s.id, enabled: s.enabled })),
      });
    } catch (error) {
      const requestId = generateRequestId();
      logServerError("JobService.listSchedules", error, requestId, { workspaceId, itemId, jobType });
      return this.errorResponse("SCHEDULE_LIST_FAILED", getSafeErrorMessage(error, "SCHEDULE_LIST_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Internal Helpers
  // ──────────────────────────────────────────────────────────────

  /**
   * Map Fabric's job status string to our JobStatus union.
   */
  private mapFabricStatus(
    fabricStatus: string | undefined
  ): JobStatus {
    const mapping: Record<string, JobStatus> = {
      NotStarted: "NotStarted",
      InProgress: "InProgress",
      Completed: "Completed",
      Failed: "Failed",
      Cancelled: "Cancelled",
      Deduped: "Deduped",
    };
    return mapping[fabricStatus ?? ""] ?? "NotStarted";
  }

  /**
   * Compute duration in seconds between two ISO timestamps.
   */
  private computeDuration(
    start?: string,
    end?: string
  ): number | undefined {
    if (!start || !end) return undefined;
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (isNaN(startMs) || isNaN(endMs)) return undefined;
    return Math.round((endMs - startMs) / 1000);
  }

  private successResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private errorResponse(code: string, message: string, requestId?: string): ApiResponse<any> {
    return {
      success: false,
      error: { code, message, requestId },
      timestamp: new Date().toISOString(),
    };
  }

  private emitAudit(
    action: string,
    resourceType: string,
    resourceId: string | undefined,
    workspaceId: string | undefined,
    outcome: "Success" | "Failure",
    durationMs: number,
    details?: Record<string, unknown>
  ): void {
    this.auditLogger.log(
      createAuditEntry(action, resourceType, outcome, {
        resourceId,
        workspaceId,
        durationMs,
        details,
      })
    );
  }
}

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _jobServiceInstance: JobService | null = null;

export function getJobService(
  workloadClient: WorkloadClientAPI,
  auditLogger: IAuditLogger
): JobService {
  if (!_jobServiceInstance) {
    _jobServiceInstance = new JobService(workloadClient, auditLogger);
  }
  return _jobServiceInstance;
}

export function resetJobService(): void {
  _jobServiceInstance = null;
}
