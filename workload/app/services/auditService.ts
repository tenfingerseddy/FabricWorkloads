/**
 * Audit Service -- Observability Workbench
 *
 * Implements the IAuditLogger interface to capture all item and job
 * operations for compliance, debugging, and telemetry.
 *
 * Current implementation: in-memory ring buffer + console logging.
 * Future: ingests audit entries into the Eventhouse ObsAuditLog table
 * via the KQL ingestion endpoint.
 */

import { AuditEntry, IAuditLogger } from "../types/audit";

// ════════════════════════════════════════════════════════════════
// Audit Service
// ════════════════════════════════════════════════════════════════

const MAX_BUFFER_SIZE = 1000;

export class AuditService implements IAuditLogger {
  private buffer: AuditEntry[] = [];
  private readonly maxSize: number;
  private readonly enableConsole: boolean;

  constructor(options?: { maxSize?: number; enableConsole?: boolean }) {
    this.maxSize = options?.maxSize ?? MAX_BUFFER_SIZE;
    this.enableConsole = options?.enableConsole ?? true;
  }

  /**
   * Log an audit entry.
   * Adds to the ring buffer and optionally writes to console.
   */
  log(entry: AuditEntry): void {
    // Ensure timestamp is present
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    // Ensure auditId is present
    if (!entry.auditId) {
      entry.auditId = crypto.randomUUID?.() ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    // Ring buffer: drop oldest when full
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(entry);

    // Console output for development
    if (this.enableConsole) {
      const level = entry.outcome === "Failure" ? "warn" : "log";
      console[level](
        `[Audit] ${entry.action} | ${entry.outcome} | ${entry.resourceType}${entry.resourceId ? `/${entry.resourceId}` : ""} | ${entry.actor} (${entry.actorType})${entry.durationMs ? ` | ${entry.durationMs}ms` : ""}`
      );
    }
  }

  /**
   * Get the most recent audit entries.
   * @param limit Max entries to return (default 50)
   */
  getRecentEntries(limit: number = 50): AuditEntry[] {
    const start = Math.max(0, this.buffer.length - limit);
    return this.buffer.slice(start).reverse();
  }

  /**
   * Get audit entries filtered by action.
   */
  getEntriesByAction(action: string, limit: number = 50): AuditEntry[] {
    return this.buffer
      .filter((e) => e.action === action)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit entries filtered by resource.
   */
  getEntriesByResource(
    resourceType: string,
    resourceId?: string,
    limit: number = 50
  ): AuditEntry[] {
    return this.buffer
      .filter(
        (e) =>
          e.resourceType === resourceType &&
          (!resourceId || e.resourceId === resourceId)
      )
      .slice(-limit)
      .reverse();
  }

  /**
   * Get failure entries only.
   */
  getFailures(limit: number = 50): AuditEntry[] {
    return this.buffer
      .filter((e) => e.outcome === "Failure")
      .slice(-limit)
      .reverse();
  }

  /**
   * Get total counts by outcome.
   */
  getSummary(): { total: number; successes: number; failures: number } {
    const successes = this.buffer.filter((e) => e.outcome === "Success").length;
    return {
      total: this.buffer.length,
      successes,
      failures: this.buffer.length - successes,
    };
  }

  /**
   * Clear the audit buffer.
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get the current buffer size.
   */
  get size(): number {
    return this.buffer.length;
  }
}

// ════════════════════════════════════════════════════════════════
// Helper: Create Audit Entry
// ════════════════════════════════════════════════════════════════

/**
 * Factory for creating audit entries with common defaults.
 */
export function createAuditEntry(
  action: string,
  resourceType: string,
  outcome: "Success" | "Failure",
  overrides?: Partial<AuditEntry>
): AuditEntry {
  return {
    auditId: crypto.randomUUID?.() ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    action: action as AuditEntry["action"],
    actor: overrides?.actor ?? "unknown",
    actorType: overrides?.actorType ?? "System",
    resourceType,
    outcome,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Singleton
// ════════════════════════════════════════════════════════════════

let _auditInstance: AuditService | null = null;

export function getAuditService(
  options?: { maxSize?: number; enableConsole?: boolean }
): AuditService {
  if (!_auditInstance) {
    _auditInstance = new AuditService(options);
  }
  return _auditInstance;
}

export function resetAuditService(): void {
  _auditInstance?.clear();
  _auditInstance = null;
}
