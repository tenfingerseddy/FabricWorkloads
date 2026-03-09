/**
 * Auth Service -- Observability Workbench
 *
 * Manages authentication flows for the workload backend.
 * All user-facing operations use OBO (On-Behalf-Of) delegated access
 * through the Fabric Workload SDK. Service principal auth is only
 * used for background jobs and system-level operations.
 *
 * Security principles enforced:
 *   - Least privilege: each operation requests only the scopes it needs
 *   - OBO-first: user context is preserved for audit trails
 *   - Token caching: avoids redundant token acquisitions within a session
 *   - Scope validation: prevents over-broad scope requests
 */

import { WorkloadClientAPI, AccessToken } from "@ms-fabric/workload-client";
import { FabricAuthenticationService } from "../clients/FabricAuthenticationService";
import { SCOPES, FABRIC_BASE_SCOPES } from "../clients/FabricPlatformScopes";
import { AUDIT_ACTIONS, IAuditLogger } from "../types/audit";
import { redactSensitive } from "../utils/errors";

// ════════════════════════════════════════════════════════════════
// Scope Definitions for Observability Workbench Operations
// ════════════════════════════════════════════════════════════════

/**
 * Named scope sets for different operation categories.
 * Each set requests the minimum scopes required.
 */
export const OBS_SCOPES = {
  /** Read item metadata and definitions */
  ITEM_READ: [
    FABRIC_BASE_SCOPES.ITEM_READ,
    FABRIC_BASE_SCOPES.WORKSPACE_READ,
  ].join(" "),

  /** Create, update, delete items */
  ITEM_WRITE: [
    FABRIC_BASE_SCOPES.ITEM_READWRITE,
    FABRIC_BASE_SCOPES.WORKSPACE_READ,
  ].join(" "),

  /** Submit and manage jobs */
  JOB_EXECUTE: [
    FABRIC_BASE_SCOPES.ITEM_EXECUTE,
    FABRIC_BASE_SCOPES.ITEM_READ,
    FABRIC_BASE_SCOPES.WORKSPACE_READ,
  ].join(" "),

  /** Query KQL / Eventhouse */
  KQL_QUERY: "https://kusto.kusto.windows.net/.default",

  /** OneLake storage operations (archive to Lakehouse) */
  ONELAKE_WRITE: [
    FABRIC_BASE_SCOPES.ONELAKE_READWRITE,
    FABRIC_BASE_SCOPES.ITEM_READ,
  ].join(" "),

  /** Read workspace and capacity info */
  WORKSPACE_READ: SCOPES.WORKSPACE_READ,

  /** Comprehensive scopes for admin-level operations */
  ADMIN: SCOPES.DEFAULT,
} as const;

export type ObsScopeKey = keyof typeof OBS_SCOPES;

// ════════════════════════════════════════════════════════════════
// Token Cache
// ════════════════════════════════════════════════════════════════

interface CachedToken {
  token: AccessToken;
  acquiredAt: number;
  scopes: string;
}

/** How long to consider a cached token valid (4 minutes, well under typical 1h expiry) */
const TOKEN_CACHE_TTL_MS = 4 * 60 * 1000;

// ════════════════════════════════════════════════════════════════
// Auth Service
// ════════════════════════════════════════════════════════════════

export class AuthService {
  private fabricAuth: FabricAuthenticationService;
  private tokenCache: Map<string, CachedToken> = new Map();
  private auditLogger?: IAuditLogger;

  constructor(workloadClient: WorkloadClientAPI, auditLogger?: IAuditLogger) {
    this.fabricAuth = new FabricAuthenticationService(workloadClient);
    this.auditLogger = auditLogger;
  }

  // ──────────────────────────────────────────────────────────────
  // Token Acquisition
  // ──────────────────────────────────────────────────────────────

  /**
   * Acquire a delegated (OBO) token for the specified scope set.
   * Uses in-memory caching to reduce round-trips.
   *
   * @param scopeKey Named scope set from OBS_SCOPES
   * @returns AccessToken with the bearer token string
   */
  async acquireToken(scopeKey: ObsScopeKey): Promise<AccessToken> {
    const scopes = OBS_SCOPES[scopeKey];
    return this.acquireTokenForScopes(scopes);
  }

  /**
   * Acquire a token for arbitrary scopes (escape hatch).
   * Prefer acquireToken(scopeKey) for type safety.
   */
  async acquireTokenForScopes(scopes: string): Promise<AccessToken> {
    // Check cache first
    const cached = this.tokenCache.get(scopes);
    if (cached && Date.now() - cached.acquiredAt < TOKEN_CACHE_TTL_MS) {
      return cached.token;
    }

    const startMs = Date.now();

    try {
      const token = await this.fabricAuth.acquireAccessToken(scopes);
      const durationMs = Date.now() - startMs;

      // Cache the token
      this.tokenCache.set(scopes, {
        token,
        acquiredAt: Date.now(),
        scopes,
      });

      this.emitAudit(AUDIT_ACTIONS.AUTH_TOKEN_ACQUIRED, "Success", durationMs, {
        scopes: this.redactScopes(scopes),
      });

      return token;
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log the full error server-side (redacting any embedded secrets)
      console.error(
        `[AuthService] Token acquisition failed for scopes [${this.redactScopes(scopes)}]:`,
        redactSensitive(errorMessage)
      );

      this.emitAudit(AUDIT_ACTIONS.AUTH_TOKEN_FAILED, "Failure", durationMs, {
        scopes: this.redactScopes(scopes),
        error: redactSensitive(errorMessage),
      });

      // Throw with a safe message -- no raw error details in the message
      throw new AuthServiceError(
        `Token acquisition failed for scopes [${this.redactScopes(scopes)}]`,
        "AUTH_TOKEN_ACQUISITION_FAILED",
        error instanceof Error ? error : undefined
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Token Validation Helpers
  // ──────────────────────────────────────────────────────────────

  /**
   * Validate that a scope key is legitimate before requesting tokens.
   * Prevents scope-injection attacks from untrusted input.
   */
  isValidScopeKey(key: string): key is ObsScopeKey {
    return key in OBS_SCOPES;
  }

  /**
   * Get the raw scope string for a named scope key.
   */
  getScopesForKey(key: ObsScopeKey): string {
    return OBS_SCOPES[key];
  }

  // ──────────────────────────────────────────────────────────────
  // Cache Management
  // ──────────────────────────────────────────────────────────────

  /** Clear all cached tokens (e.g. on user context change) */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /** Get the number of cached tokens (for diagnostics) */
  get cacheSize(): number {
    return this.tokenCache.size;
  }

  // ──────────────────────────────────────────────────────────────
  // Auth Mode Queries
  // ──────────────────────────────────────────────────────────────

  /** Whether current auth is delegated user token (OBO) */
  isUserAuth(): boolean {
    return this.fabricAuth.isUserTokenAuth();
  }

  /** Whether current auth is service principal (background jobs) */
  isServicePrincipalAuth(): boolean {
    return this.fabricAuth.isServicePrincipalAuth();
  }

  // ──────────────────────────────────────────────────────────────
  // Internal Helpers
  // ──────────────────────────────────────────────────────────────

  /**
   * Redact scope URLs for safe logging.
   * "https://api.fabric.microsoft.com/Item.Read.All" -> "Item.Read.All"
   */
  private redactScopes(scopes: string): string {
    return scopes
      .split(" ")
      .map((s) => {
        const lastSlash = s.lastIndexOf("/");
        return lastSlash >= 0 ? s.substring(lastSlash + 1) : s;
      })
      .join(", ");
  }

  /**
   * Emit an audit entry for auth operations.
   */
  private emitAudit(
    action: typeof AUDIT_ACTIONS.AUTH_TOKEN_ACQUIRED | typeof AUDIT_ACTIONS.AUTH_TOKEN_FAILED,
    outcome: "Success" | "Failure",
    durationMs: number,
    details?: Record<string, unknown>
  ): void {
    if (!this.auditLogger) return;

    this.auditLogger.log({
      auditId: crypto.randomUUID?.() ?? `auth-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      actor: "system",
      actorType: "System",
      resourceType: "auth",
      outcome,
      durationMs,
      details,
    });
  }
}

// ════════════════════════════════════════════════════════════════
// Custom Error
// ════════════════════════════════════════════════════════════════

export class AuthServiceError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
    this.cause = cause;
  }
}

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _authInstance: AuthService | null = null;

export function getAuthService(
  workloadClient: WorkloadClientAPI,
  auditLogger?: IAuditLogger
): AuthService {
  if (!_authInstance) {
    _authInstance = new AuthService(workloadClient, auditLogger);
  }
  return _authInstance;
}

export function resetAuthService(): void {
  _authInstance?.clearCache();
  _authInstance = null;
}
