/**
 * Workload Item Types -- Observability Workbench
 *
 * Type definitions for the three custom Fabric item types:
 *   - WorkbenchDashboard
 *   - AlertRule
 *   - SLODefinition
 *
 * These types power the backend controller and service layers,
 * mapping between Fabric's generic item model and our domain-specific
 * definitions stored in item payload.json.
 */

import { WorkbenchDashboardDefinition } from "../items/WorkbenchDashboard/WorkbenchDashboardDefinition";
import { AlertRuleDefinition } from "../items/AlertRule/AlertRuleDefinition";
import { SLODefinitionDefinition } from "../items/SLODefinition/SLODefinitionDefinition";

// ════════════════════════════════════════════════════════════════
// Item Type Constants
// ════════════════════════════════════════════════════════════════

/** Fully qualified Fabric item type identifiers (workloadName.itemTypeName) */
export const ITEM_TYPES = {
  WORKBENCH_DASHBOARD: "ObservabilityWorkbench.WorkbenchDashboard",
  ALERT_RULE: "ObservabilityWorkbench.AlertRule",
  SLO_DEFINITION: "ObservabilityWorkbench.SLODefinition",
} as const;

export type ObservabilityItemType = typeof ITEM_TYPES[keyof typeof ITEM_TYPES];

/** Short names used in route paths and logging */
export const ITEM_TYPE_SHORT_NAMES: Record<ObservabilityItemType, string> = {
  [ITEM_TYPES.WORKBENCH_DASHBOARD]: "WorkbenchDashboard",
  [ITEM_TYPES.ALERT_RULE]: "AlertRule",
  [ITEM_TYPES.SLO_DEFINITION]: "SLODefinition",
};

// ════════════════════════════════════════════════════════════════
// Generic Item Envelope
// ════════════════════════════════════════════════════════════════

/** Base metadata common to all workload items (mirrors Fabric Item properties) */
export interface WorkloadItemMetadata {
  id: string;
  workspaceId: string;
  type: ObservabilityItemType;
  displayName: string;
  description?: string;
  folderId?: string;
}

/** A workload item with its typed definition payload */
export interface WorkloadItem<T> extends WorkloadItemMetadata {
  definition: T;
}

/** Union of all concrete workload item shapes */
export type AnyWorkloadItem =
  | WorkloadItem<WorkbenchDashboardDefinition>
  | WorkloadItem<AlertRuleDefinition>
  | WorkloadItem<SLODefinitionDefinition>;

// ════════════════════════════════════════════════════════════════
// Request / Response Shapes
// ════════════════════════════════════════════════════════════════

/** Request body for creating a new workload item */
export interface CreateItemRequest<T = unknown> {
  displayName: string;
  description?: string;
  definition?: T;
  folderId?: string;
}

/** Request body for updating an existing workload item */
export interface UpdateItemRequest<T = unknown> {
  displayName?: string;
  description?: string;
  definition?: T;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

/** Structured error information */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
  requestId?: string;
}

/** Paginated list response */
export interface PaginatedList<T> {
  items: T[];
  totalCount: number;
  continuationToken?: string;
}

// ════════════════════════════════════════════════════════════════
// Validation Rules
// ════════════════════════════════════════════════════════════════

/** Validation result from service-layer checks */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ════════════════════════════════════════════════════════════════
// Default Definitions
// ════════════════════════════════════════════════════════════════

/** Default definition applied when creating a new WorkbenchDashboard */
export const DEFAULT_DASHBOARD_DEFINITION: WorkbenchDashboardDefinition = {
  workspaceIds: [],
  timeRange: "24h",
  pinnedSLOs: [],
  filters: {},
};

/** Default definition applied when creating a new AlertRule */
export const DEFAULT_ALERT_RULE_DEFINITION: AlertRuleDefinition = {
  condition: "LessThan",
  threshold: 99.0,
  notificationType: "email",
  cooldown: 3600,
  enabled: true,
};

/** Default definition applied when creating a new SLODefinition */
export const DEFAULT_SLO_DEFINITION: SLODefinitionDefinition = {
  metricType: "SuccessRate",
  targetValue: 99.5,
  warningThreshold: 99.0,
  evaluationWindow: "7d",
};
