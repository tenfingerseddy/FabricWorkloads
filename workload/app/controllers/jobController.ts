/**
 * Job Controller -- Observability Workbench
 *
 * Controller layer for job submission, status tracking, and cancellation.
 * Jobs are Fabric job instances that surface in the Monitoring Hub and
 * execute data-collection, correlation, SLO evaluation, and alerting.
 *
 * Responsibilities:
 *   - Validate incoming job requests
 *   - Delegate to JobService for orchestration
 *   - Return structured ApiResponse envelopes
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { JobService, getJobService } from "../services/jobService";
import { getAuditService } from "../services/auditService";
import {
  JOB_TYPES,
  ObservabilityJobType,
  JOB_TYPE_DESCRIPTIONS,
  SubmitJobRequest,
  ObservabilityJobInstance,
  JobActivitySummary,
  JobScheduleConfig,
} from "../types/jobs";
import { ApiResponse } from "../types/workloadItems";

// ════════════════════════════════════════════════════════════════
// Job Controller
// ════════════════════════════════════════════════════════════════

export class JobController {
  private jobService: JobService;

  constructor(workloadClient: WorkloadClientAPI) {
    const auditLogger = getAuditService();
    this.jobService = getJobService(workloadClient, auditLogger);
  }

  // ──────────────────────────────────────────────────────────────
  // Submit
  // ──────────────────────────────────────────────────────────────

  /**
   * Submit an on-demand data collection job.
   * This is the most common job type -- ingests monitoring hub data.
   */
  async submitDataCollection(
    workspaceId: string,
    itemId: string,
    options?: { workspaceIds?: string[]; timeRange?: string; fullSync?: boolean }
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.submitJob(workspaceId, itemId, {
      jobType: JOB_TYPES.DATA_COLLECTION,
      workspaceIds: options?.workspaceIds,
      timeRange: options?.timeRange ?? "24h",
      fullSync: options?.fullSync ?? false,
    });
  }

  /**
   * Submit a correlation-build job.
   * Computes cross-item correlations from recently ingested events.
   */
  async submitCorrelationBuild(
    workspaceId: string,
    itemId: string,
    options?: { timeRange?: string }
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.submitJob(workspaceId, itemId, {
      jobType: JOB_TYPES.CORRELATION_BUILD,
      timeRange: options?.timeRange ?? "7d",
    });
  }

  /**
   * Submit an SLO evaluation job.
   * Evaluates all active SLO definitions and produces snapshots.
   */
  async submitSloEvaluation(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.submitJob(workspaceId, itemId, {
      jobType: JOB_TYPES.SLO_EVALUATION,
    });
  }

  /**
   * Submit an alert evaluation job.
   * Evaluates alert rules and triggers notifications for breaches.
   */
  async submitAlertEvaluation(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.submitJob(workspaceId, itemId, {
      jobType: JOB_TYPES.ALERT_EVALUATION,
    });
  }

  /**
   * Generic job submission with explicit job type.
   */
  async submitJob(
    workspaceId: string,
    itemId: string,
    request: SubmitJobRequest
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.submitJob(workspaceId, itemId, request);
  }

  // ──────────────────────────────────────────────────────────────
  // Status
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the current status of a specific job instance.
   */
  async getJobStatus(
    workspaceId: string,
    itemId: string,
    jobInstanceId: string
  ): Promise<ApiResponse<ObservabilityJobInstance>> {
    return this.jobService.getJobStatus(workspaceId, itemId, jobInstanceId);
  }

  /**
   * List all job instances for an item.
   */
  async listJobs(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<ObservabilityJobInstance[]>> {
    return this.jobService.listJobs(workspaceId, itemId);
  }

  /**
   * Get an activity summary (counts by status, average duration).
   */
  async getJobSummary(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<JobActivitySummary>> {
    return this.jobService.getJobSummary(workspaceId, itemId);
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
    jobInstanceId: string,
    reason?: string
  ): Promise<ApiResponse<void>> {
    return this.jobService.cancelJob(workspaceId, itemId, {
      jobInstanceId,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Scheduling
  // ──────────────────────────────────────────────────────────────

  /**
   * Create a recurring schedule for a job type.
   */
  async createSchedule(
    workspaceId: string,
    itemId: string,
    config: JobScheduleConfig
  ): Promise<ApiResponse<{ scheduleId: string }>> {
    return this.jobService.createSchedule(workspaceId, itemId, config);
  }

  /**
   * List schedules for an item and job type.
   */
  async listSchedules(
    workspaceId: string,
    itemId: string,
    jobType: ObservabilityJobType
  ): Promise<ApiResponse<{ schedules: Array<{ id: string; enabled: boolean }> }>> {
    return this.jobService.listSchedules(workspaceId, itemId, jobType);
  }

  // ──────────────────────────────────────────────────────────────
  // Reference Data
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the list of available job types with descriptions.
   * Used by the frontend to populate job-type selectors.
   */
  getAvailableJobTypes(): Array<{ type: ObservabilityJobType; description: string }> {
    return Object.entries(JOB_TYPE_DESCRIPTIONS).map(([type, description]) => ({
      type: type as ObservabilityJobType,
      description,
    }));
  }
}

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _jobControllerInstance: JobController | null = null;

export function getJobController(workloadClient: WorkloadClientAPI): JobController {
  if (!_jobControllerInstance) {
    _jobControllerInstance = new JobController(workloadClient);
  }
  return _jobControllerInstance;
}

export function resetJobController(): void {
  _jobControllerInstance = null;
}
