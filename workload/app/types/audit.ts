/**
 * Audit Types -- Observability Workbench
 *
 * Every item operation (create, update, delete) and job submission
 * produces an audit record for compliance and troubleshooting.
 *
 * Audit entries are stored in the Eventhouse (ObsAuditLog table)
 * for long retention and correlation with other telemetry.
 */

// ════════════════════════════════════════════════════════════════
// Audit Actions
// ════════════════════════════════════════════════════════════════

export const AUDIT_ACTIONS = {
  // Item lifecycle
  ITEM_CREATE: "item.create",
  ITEM_READ: "item.read",
  ITEM_UPDATE: "item.update",
  ITEM_DELETE: "item.delete",
  ITEM_LIST: "item.list",

  // Job lifecycle
  JOB_SUBMIT: "job.submit",
  JOB_CANCEL: "job.cancel",
  JOB_STATUS: "job.status",

  // Auth events
  AUTH_TOKEN_ACQUIRED: "auth.token_acquired",
  AUTH_TOKEN_FAILED: "auth.token_failed",

  // Configuration
  CONFIG_UPDATE: "config.update",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ════════════════════════════════════════════════════════════════
// Audit Entry
// ════════════════════════════════════════════════════════════════

export interface AuditEntry {
  /** Unique ID for this audit record */
  auditId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Action performed */
  action: AuditAction;
  /** Who performed the action (user principal name or service principal ID) */
  actor: string;
  actorType: "User" | "ServicePrincipal" | "System";
  /** Target resource */
  resourceType: string;
  resourceId?: string;
  workspaceId?: string;
  /** Whether the operation succeeded */
  outcome: "Success" | "Failure";
  /** Duration of the operation in milliseconds */
  durationMs?: number;
  /** Error details when outcome === "Failure" */
  errorCode?: string;
  errorMessage?: string;
  /** Additional context (serialized as JSON in KQL) */
  details?: Record<string, unknown>;
  /** Correlation ID for tracing across services */
  correlationId?: string;
}

// ════════════════════════════════════════════════════════════════
// Audit Logger Interface
// ════════════════════════════════════════════════════════════════

/**
 * Contract for audit logging implementations.
 * The default implementation writes to console + in-memory buffer.
 * Production implementation will ingest into the Eventhouse.
 */
export interface IAuditLogger {
  log(entry: AuditEntry): void;
  getRecentEntries(limit?: number): AuditEntry[];
}
