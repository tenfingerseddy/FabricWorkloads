/**
 * Job Types -- Observability Workbench
 *
 * Types for the data-collection and computation jobs that run as
 * Fabric job instances and surface in the Monitoring Hub.
 *
 * Job categories:
 *   - DataCollection   : ingests monitoring hub data and workspace inventory
 *   - CorrelationBuild : computes cross-item event correlations
 *   - SloEvaluation    : evaluates SLO snapshots and triggers alerts
 *   - AlertEvaluation  : evaluates alert rules and sends notifications
 */

// ════════════════════════════════════════════════════════════════
// Job Type Constants
// ════════════════════════════════════════════════════════════════

export const JOB_TYPES = {
  DATA_COLLECTION: "DataCollection",
  CORRELATION_BUILD: "CorrelationBuild",
  SLO_EVALUATION: "SloEvaluation",
  ALERT_EVALUATION: "AlertEvaluation",
} as const;

export type ObservabilityJobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

export const JOB_TYPE_DESCRIPTIONS: Record<ObservabilityJobType, string> = {
  [JOB_TYPES.DATA_COLLECTION]:
    "Ingests monitoring hub events and workspace inventory into the Eventhouse",
  [JOB_TYPES.CORRELATION_BUILD]:
    "Computes cross-item correlations from ingested events",
  [JOB_TYPES.SLO_EVALUATION]:
    "Evaluates SLO definitions and produces snapshots",
  [JOB_TYPES.ALERT_EVALUATION]:
    "Evaluates alert rules and triggers notifications",
};

// ════════════════════════════════════════════════════════════════
// Job Status
// ════════════════════════════════════════════════════════════════

export type JobStatus =
  | "NotStarted"
  | "Queued"
  | "InProgress"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | "Deduped";

export function isTerminalStatus(status: JobStatus): boolean {
  return status === "Completed" || status === "Failed" || status === "Cancelled";
}

// ════════════════════════════════════════════════════════════════
// Job Requests
// ════════════════════════════════════════════════════════════════

/** Parameters passed when submitting a job */
export interface SubmitJobRequest {
  jobType: ObservabilityJobType;
  /** Target workspace IDs; empty means all monitored workspaces */
  workspaceIds?: string[];
  /** Time window to collect/evaluate (e.g. "1h", "24h") */
  timeRange?: string;
  /** Whether to force a full re-sync instead of incremental */
  fullSync?: boolean;
}

/** Parameters for cancelling a running job */
export interface CancelJobRequest {
  jobInstanceId: string;
  reason?: string;
}

// ════════════════════════════════════════════════════════════════
// Job Instance (tracked state)
// ════════════════════════════════════════════════════════════════

/** Our enriched job instance that wraps the Fabric ItemJobInstance */
export interface ObservabilityJobInstance {
  /** Fabric job instance ID */
  id: string;
  /** The workload item that owns this job */
  itemId: string;
  workspaceId: string;
  jobType: ObservabilityJobType;
  status: JobStatus;
  /** How the job was triggered */
  invokeType: "Manual" | "Scheduled";
  /** UTC timestamps */
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Duration in seconds (computed on terminal status) */
  durationSeconds?: number;
  /** Root activity ID for Fabric monitoring hub correlation */
  rootActivityId?: string;
  /** Error details when status === "Failed" */
  failureReason?: string;
  /** Execution parameters that were passed at submit time */
  executionParams?: SubmitJobRequest;
  /** Notebook run ID if this job triggered a Spark notebook */
  notebookRunId?: string;
}

/** Summary of recent job activity for the dashboard */
export interface JobActivitySummary {
  totalJobs: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageDurationSeconds: number;
  lastRunAt?: string;
}

// ════════════════════════════════════════════════════════════════
// Schedule Configuration
// ════════════════════════════════════════════════════════════════

/** Configuration for scheduling recurring jobs */
export interface JobScheduleConfig {
  jobType: ObservabilityJobType;
  enabled: boolean;
  /** Cron expression (e.g. "0 0/15 * * *" for every 15 minutes) */
  cronExpression?: string;
  /** Time zone (e.g. "Australia/Sydney") */
  timeZone: string;
  /** Start / end bounds for the schedule */
  startDateTime: string;
  endDateTime?: string;
  /** Default execution parameters */
  defaultParams?: SubmitJobRequest;
}

// ════════════════════════════════════════════════════════════════
// Notebook Integration
// ════════════════════════════════════════════════════════════════

/** Known notebook IDs in the ObservabilityWorkbench-Dev workspace */
export const OBSERVABILITY_NOTEBOOKS = {
  INGESTION: "b157ef6d-0000-0000-0000-000000000000",
  CORRELATION: "177c7991-0000-0000-0000-000000000000",
  ALERTS: "d0899650-0000-0000-0000-000000000000",
} as const;

/** Maps each job type to the notebook it should execute */
export const JOB_NOTEBOOK_MAP: Partial<Record<ObservabilityJobType, string>> = {
  [JOB_TYPES.DATA_COLLECTION]: OBSERVABILITY_NOTEBOOKS.INGESTION,
  [JOB_TYPES.CORRELATION_BUILD]: OBSERVABILITY_NOTEBOOKS.CORRELATION,
  [JOB_TYPES.ALERT_EVALUATION]: OBSERVABILITY_NOTEBOOKS.ALERTS,
};
