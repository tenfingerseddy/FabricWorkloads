/**
 * Health Controller -- Observability Workbench
 *
 * Provides health-check and diagnostic endpoints for the workload.
 * Used by:
 *   - Fabric platform to verify the workload is operational
 *   - The dashboard UI to show connection status indicators
 *   - DevOps monitoring for liveness/readiness probes
 *
 * Checks performed:
 *   1. Workload SDK connectivity (can we call the platform?)
 *   2. Eventhouse (KQL) reachability and query latency
 *   3. Auth service status (token cache health)
 *   4. Audit service buffer status
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { getKqlQueryService } from "../services/kqlQueryService";
import { getAuthService } from "../services/authService";
import { getAuditService } from "../services/auditService";
import { ApiResponse } from "../types/workloadItems";
import { sanitizeHealthMessage } from "../utils/errors";

// ════════════════════════════════════════════════════════════════
// Health Status Types
// ════════════════════════════════════════════════════════════════

export type ComponentStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  latencyMs?: number;
  message?: string;
  lastCheckedAt: string;
}

export interface HealthReport {
  status: ComponentStatus;
  version: string;
  uptime: string;
  components: ComponentHealth[];
  environment: {
    workloadName: string;
    buildTime?: string;
  };
}

// ════════════════════════════════════════════════════════════════
// Health Controller
// ════════════════════════════════════════════════════════════════

const WORKLOAD_VERSION = "1.0.0";
const startTime = Date.now();

export class HealthController {
  private workloadClient: WorkloadClientAPI;

  constructor(workloadClient: WorkloadClientAPI) {
    this.workloadClient = workloadClient;
  }

  // ──────────────────────────────────────────────────────────────
  // Health Check Endpoints
  // ──────────────────────────────────────────────────────────────

  /**
   * Comprehensive health check across all components.
   * Returns an aggregate status based on individual component checks.
   */
  async getHealthReport(): Promise<ApiResponse<HealthReport>> {
    const components: ComponentHealth[] = [];

    // Check each component in parallel for speed
    const [kqlHealth, authHealth, auditHealth, sdkHealth] = await Promise.allSettled([
      this.checkKqlHealth(),
      this.checkAuthHealth(),
      this.checkAuditHealth(),
      this.checkSdkHealth(),
    ]);

    components.push(
      kqlHealth.status === "fulfilled"
        ? kqlHealth.value
        : this.failedComponent("eventhouse", kqlHealth.reason)
    );
    components.push(
      authHealth.status === "fulfilled"
        ? authHealth.value
        : this.failedComponent("auth", authHealth.reason)
    );
    components.push(
      auditHealth.status === "fulfilled"
        ? auditHealth.value
        : this.failedComponent("audit", auditHealth.reason)
    );
    components.push(
      sdkHealth.status === "fulfilled"
        ? sdkHealth.value
        : this.failedComponent("workload-sdk", sdkHealth.reason)
    );

    // Aggregate status: unhealthy if any component is unhealthy,
    // degraded if any is degraded, otherwise healthy
    const aggregateStatus = this.aggregateStatus(components);

    const report: HealthReport = {
      status: aggregateStatus,
      version: WORKLOAD_VERSION,
      uptime: this.formatUptime(Date.now() - startTime),
      components,
      environment: {
        workloadName: process.env.WORKLOAD_NAME ?? "ObservabilityWorkbench",
        buildTime: process.env.BUILD_TIME,
      },
    };

    return {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Lightweight liveness check (no external calls).
   * Returns 200 if the workload process is running.
   */
  async getLivenessCheck(): Promise<ApiResponse<{ alive: true }>> {
    return {
      success: true,
      data: { alive: true },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check -- confirms the workload can serve requests.
   * Verifies that the WorkloadClientAPI is initialized.
   */
  async getReadinessCheck(): Promise<ApiResponse<{ ready: boolean; reason?: string }>> {
    const ready = !!this.workloadClient;
    return {
      success: ready,
      data: {
        ready,
        reason: ready ? undefined : "WorkloadClientAPI not initialized",
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Individual Component Checks
  // ──────────────────────────────────────────────────────────────

  /**
   * Check Eventhouse (KQL) connectivity and query latency.
   */
  private async checkKqlHealth(): Promise<ComponentHealth> {
    const now = new Date().toISOString();
    try {
      const kqlService = getKqlQueryService(this.workloadClient);
      const result = await kqlService.healthCheck();

      return {
        name: "eventhouse",
        status: result.reachable
          ? result.latencyMs < 5000
            ? "healthy"
            : "degraded"
          : "unhealthy",
        latencyMs: result.latencyMs,
        message: result.reachable
          ? `KQL endpoint reachable (${result.latencyMs}ms)`
          : "KQL endpoint unreachable",
        lastCheckedAt: now,
      };
    } catch (error) {
      // Log full error server-side for diagnostics
      console.error("[HealthController] KQL health check failed:", error instanceof Error ? error.message : error);
      return {
        name: "eventhouse",
        status: "unhealthy",
        message: sanitizeHealthMessage(
          `Health check failed: ${error instanceof Error ? error.message : "unknown error"}`
        ),
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Check auth service status.
   */
  private async checkAuthHealth(): Promise<ComponentHealth> {
    const now = new Date().toISOString();
    try {
      const authService = getAuthService(this.workloadClient);
      const isUser = authService.isUserAuth();
      const cacheSize = authService.cacheSize;

      return {
        name: "auth",
        status: "healthy",
        message: `Auth mode: ${isUser ? "delegated (OBO)" : "service principal"}, cached tokens: ${cacheSize}`,
        lastCheckedAt: now,
      };
    } catch (error) {
      console.error("[HealthController] Auth health check failed:", error instanceof Error ? error.message : error);
      return {
        name: "auth",
        status: "degraded",
        message: "Auth service health check failed",
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Check audit service buffer status.
   */
  private async checkAuditHealth(): Promise<ComponentHealth> {
    const now = new Date().toISOString();
    try {
      const auditService = getAuditService();
      const summary = auditService.getSummary();

      return {
        name: "audit",
        status: "healthy",
        message: `Buffer: ${summary.total} entries (${summary.successes} success, ${summary.failures} failure)`,
        lastCheckedAt: now,
      };
    } catch (error) {
      console.error("[HealthController] Audit health check failed:", error instanceof Error ? error.message : error);
      return {
        name: "audit",
        status: "degraded",
        message: "Audit service health check failed",
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Check WorkloadClientAPI SDK connectivity.
   */
  private async checkSdkHealth(): Promise<ComponentHealth> {
    const now = new Date().toISOString();

    if (!this.workloadClient) {
      return {
        name: "workload-sdk",
        status: "unhealthy",
        message: "WorkloadClientAPI not available",
        lastCheckedAt: now,
      };
    }

    return {
      name: "workload-sdk",
      status: "healthy",
      message: "WorkloadClientAPI initialized",
      lastCheckedAt: now,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  private failedComponent(name: string, error: unknown): ComponentHealth {
    // Log the full error server-side for debugging
    console.error(`[HealthController] Component ${name} check threw:`, error instanceof Error ? error.message : error);
    return {
      name,
      status: "unhealthy",
      message: `${name} health check failed`,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  private aggregateStatus(components: ComponentHealth[]): ComponentStatus {
    if (components.some((c) => c.status === "unhealthy")) return "unhealthy";
    if (components.some((c) => c.status === "degraded")) return "degraded";
    if (components.some((c) => c.status === "unknown")) return "degraded";
    return "healthy";
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _healthControllerInstance: HealthController | null = null;

export function getHealthController(workloadClient: WorkloadClientAPI): HealthController {
  if (!_healthControllerInstance) {
    _healthControllerInstance = new HealthController(workloadClient);
  }
  return _healthControllerInstance;
}

export function resetHealthController(): void {
  _healthControllerInstance = null;
}
