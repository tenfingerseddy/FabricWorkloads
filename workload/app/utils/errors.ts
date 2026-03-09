/**
 * Error Utilities -- Observability Workbench
 *
 * Provides typed error classes for the service layer and a centralized
 * error sanitization function that ensures no stack traces, internal
 * paths, connection strings, or other sensitive details leak to API
 * clients.
 *
 * Pattern:
 *   - Services throw typed errors (NotFoundError, ValidationError, etc.)
 *   - Controllers catch errors, log full details server-side, and return
 *     sanitized messages to clients via `toSafeApiResponse()`
 *   - Every error response includes a `requestId` for correlation between
 *     client-visible responses and server-side logs
 *
 * Security finding: H7 -- Stack traces exposed in production error responses
 */

import { ApiResponse } from "../types/workloadItems";

// ================================================================
// Request ID Generator
// ================================================================

/**
 * Generate a short request ID for correlating client responses with
 * server-side logs. Not a UUID -- kept short for readability in
 * user-facing error messages.
 */
export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `req-${ts}-${rand}`;
}

// ================================================================
// Typed Error Classes (Service Layer)
// ================================================================

/**
 * Base class for all Observability Workbench application errors.
 * Carries a machine-readable `code` and a `safeMessage` that is
 * suitable for returning to external callers.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly safeMessage: string;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: string,
    safeMessage: string,
    statusCode: number = 500,
    cause?: Error
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.statusCode = statusCode;
    if (cause) {
      this.cause = cause;
    }
  }
}

/** Resource not found (e.g., item ID does not exist) */
export class NotFoundError extends AppError {
  constructor(resourceType: string, resourceId?: string) {
    const safe = resourceId
      ? `${resourceType} not found`
      : `${resourceType} not found`;
    super(
      `${resourceType} ${resourceId ?? ""} not found`.trim(),
      "NOT_FOUND",
      safe,
      404
    );
    this.name = "NotFoundError";
  }
}

/** Input validation failed */
export class ValidationError extends AppError {
  public readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(
    fieldErrors: Array<{ field: string; message: string }>,
    detailMessage?: string
  ) {
    const messages = fieldErrors.map((e) => e.message).join("; ");
    super(
      detailMessage ?? `Validation failed: ${messages}`,
      "VALIDATION_FAILED",
      `Validation failed: ${messages}`,
      400
    );
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Authentication or authorization failure */
export class AuthError extends AppError {
  constructor(internalMessage: string, cause?: Error) {
    super(
      internalMessage,
      "AUTH_FAILED",
      "Authentication failed. Please re-authenticate and try again.",
      401,
      cause
    );
    this.name = "AuthError";
  }
}

/** Insufficient permissions */
export class ForbiddenError extends AppError {
  constructor(internalMessage: string) {
    super(
      internalMessage,
      "FORBIDDEN",
      "You do not have permission to perform this action.",
      403
    );
    this.name = "ForbiddenError";
  }
}

/** External service failure (Fabric API, KQL, etc.) */
export class ServiceUnavailableError extends AppError {
  constructor(serviceName: string, internalMessage: string, cause?: Error) {
    super(
      `${serviceName} error: ${internalMessage}`,
      "SERVICE_UNAVAILABLE",
      `The ${serviceName} service is temporarily unavailable. Please try again later.`,
      503,
      cause
    );
    this.name = "ServiceUnavailableError";
  }
}

/** Operation-specific failure with a safe user-facing message */
export class OperationError extends AppError {
  constructor(
    code: string,
    safeMessage: string,
    internalMessage: string,
    statusCode: number = 500,
    cause?: Error
  ) {
    super(internalMessage, code, safeMessage, statusCode, cause);
    this.name = "OperationError";
  }
}

// ================================================================
// Error Sanitization
// ================================================================

/**
 * Map of error codes to generic safe messages for errors that do not
 * carry their own safe message (i.e., raw `Error` instances).
 */
const SAFE_MESSAGES: Record<string, string> = {
  CREATE_FAILED: "Failed to create the item. Please try again.",
  READ_FAILED: "Failed to retrieve the item. Please try again.",
  UPDATE_FAILED: "Failed to update the item. Please try again.",
  DELETE_FAILED: "Failed to delete the item. Please try again.",
  LIST_FAILED: "Failed to list items. Please try again.",
  JOB_SUBMIT_FAILED: "Failed to submit the job. Please try again.",
  JOB_STATUS_FAILED: "Failed to retrieve job status. Please try again.",
  JOB_CANCEL_FAILED: "Failed to cancel the job. Please try again.",
  JOB_LIST_FAILED: "Failed to list jobs. Please try again.",
  JOB_SUMMARY_FAILED: "Failed to retrieve job summary. Please try again.",
  SCHEDULE_CREATE_FAILED: "Failed to create the schedule. Please try again.",
  SCHEDULE_LIST_FAILED: "Failed to list schedules. Please try again.",
  ACTION_ERROR: "An unexpected error occurred while processing the request.",
  UNKNOWN_ACTION: "The requested action is not recognized.",
  INTERNAL_ERROR: "An internal error occurred. Please try again later.",
};

/**
 * Extract a safe, client-facing message from an error.
 *
 * For AppError subclasses, uses the pre-defined `safeMessage`.
 * For raw Error instances, returns a generic message based on the
 * provided error code, or a fallback generic message.
 *
 * NEVER returns: stack traces, file paths, connection strings,
 * internal service names/URLs, or raw exception messages from
 * third-party libraries.
 */
export function getSafeErrorMessage(error: unknown, code?: string): string {
  if (error instanceof AppError) {
    return error.safeMessage;
  }
  if (code && SAFE_MESSAGES[code]) {
    return SAFE_MESSAGES[code];
  }
  return "An unexpected error occurred. Please try again later.";
}

/**
 * Get the error code from a typed error or fall back to a default.
 */
export function getErrorCode(error: unknown, fallbackCode: string): string {
  if (error instanceof AppError) {
    return error.code;
  }
  return fallbackCode;
}

/**
 * Build a sanitized ApiResponse for error cases.
 *
 * This is the single point where error responses are constructed
 * for client consumption. It guarantees that:
 *   1. No stack traces are included
 *   2. No internal paths or connection strings are exposed
 *   3. A requestId is always present for log correlation
 *   4. The response shape is consistent: { error, code, requestId }
 */
export function toSafeErrorResponse(
  error: unknown,
  fallbackCode: string,
  requestId?: string
): ApiResponse<never> {
  const rid = requestId ?? generateRequestId();
  const code = getErrorCode(error, fallbackCode);
  const message = getSafeErrorMessage(error, code);

  return {
    success: false,
    error: {
      code,
      message,
      requestId: rid,
    },
    timestamp: new Date().toISOString(),
  };
}

// ================================================================
// Server-side Error Logging
// ================================================================

/**
 * Patterns that indicate sensitive information that should not be
 * logged at INFO level (only at DEBUG / in controlled environments).
 */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /client_secret=[^\s&]+/gi,
  /password=[^\s&]+/gi,
  /token=[^\s&]+/gi,
];

/**
 * Redact known sensitive patterns from a string before logging.
 */
export function redactSensitive(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const eqIdx = match.indexOf("=");
      if (eqIdx > 0) {
        return match.substring(0, eqIdx + 1) + "[REDACTED]";
      }
      return "Bearer [REDACTED]";
    });
  }
  return result;
}

/**
 * Log a full error server-side with the requestId for correlation.
 * This is where stack traces and internal details are captured --
 * they never leave the server logs.
 */
export function logServerError(
  context: string,
  error: unknown,
  requestId: string,
  extras?: Record<string, unknown>
): void {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const logEntry: Record<string, unknown> = {
    level: "error",
    context,
    requestId,
    message: redactSensitive(errorMessage),
    ...extras,
  };

  if (stack) {
    logEntry.stack = redactSensitive(stack);
  }

  // In production, this would go to a structured logging service.
  // The key point: stack traces are logged server-side only.
  console.error(`[${context}] Error (${requestId}):`, redactSensitive(errorMessage));
  if (stack && process.env.NODE_ENV !== "production") {
    console.error(`[${context}] Stack (${requestId}):`, redactSensitive(stack));
  }
}

/**
 * Sanitize a component health message to remove potentially sensitive
 * internal details (connection strings, file paths, etc.).
 *
 * Used by the HealthController to clean up error messages before
 * including them in health-check responses.
 */
export function sanitizeHealthMessage(message: string): string {
  // Remove file paths (Unix and Windows)
  let sanitized = message
    .replace(/[A-Z]:\\[^\s:]+/gi, "[path]")
    .replace(/\/(?:usr|home|var|etc|opt|tmp|app|src|node_modules)[^\s:]+/gi, "[path]");

  // Remove URLs that look like internal endpoints
  sanitized = sanitized.replace(
    /https?:\/\/[^\s]+\.(kusto|fabric|windows|azure|microsoft)\.[^\s]+/gi,
    "[endpoint]"
  );

  // Remove connection strings
  sanitized = sanitized.replace(
    /(?:Server|Data Source|Host|Endpoint)=[^\s;]+/gi,
    "[connection]"
  );

  // Redact tokens/secrets
  sanitized = redactSensitive(sanitized);

  return sanitized;
}
