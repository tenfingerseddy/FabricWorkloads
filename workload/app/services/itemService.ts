/**
 * Item Service -- Observability Workbench
 *
 * Business logic for CRUD operations on our three Fabric item types:
 *   - WorkbenchDashboard
 *   - AlertRule
 *   - SLODefinition
 *
 * This service:
 *   1. Validates incoming requests (names, definitions, required fields)
 *   2. Delegates to the Fabric Workload SDK for persistence
 *   3. Emits audit entries for every operation
 *   4. Merges default definitions with user-provided overrides
 *
 * All operations use delegated (OBO) auth through the WorkloadClientAPI,
 * preserving the calling user's identity in the Fabric audit trail.
 */

import { WorkloadClientAPI, PayloadType } from "@ms-fabric/workload-client";
import {
  callUpdateItemDefinition,
  getWorkloadItem,
  ItemDefinitionPath,
} from "../controller/ItemCRUDController";
import { ItemClient } from "../clients/ItemClient";
import {
  ITEM_TYPES,
  ObservabilityItemType,
  ITEM_TYPE_SHORT_NAMES,
  WorkloadItem,
  WorkloadItemMetadata,
  CreateItemRequest,
  UpdateItemRequest,
  ApiResponse,
  PaginatedList,
  ValidationResult,
  ValidationError,
  DEFAULT_DASHBOARD_DEFINITION,
  DEFAULT_ALERT_RULE_DEFINITION,
  DEFAULT_SLO_DEFINITION,
} from "../types/workloadItems";
import { WorkbenchDashboardDefinition } from "../items/WorkbenchDashboard/WorkbenchDashboardDefinition";
import { AlertRuleDefinition } from "../items/AlertRule/AlertRuleDefinition";
import { SLODefinitionDefinition } from "../items/SLODefinition/SLODefinitionDefinition";
import { AUDIT_ACTIONS, IAuditLogger } from "../types/audit";
import { createAuditEntry } from "./auditService";
import {
  generateRequestId,
  logServerError,
  getSafeErrorMessage,
} from "../utils/errors";

// ════════════════════════════════════════════════════════════════
// Item Service
// ════════════════════════════════════════════════════════════════

export class ItemService {
  private workloadClient: WorkloadClientAPI;
  private itemClient: ItemClient;
  private auditLogger: IAuditLogger;

  constructor(
    workloadClient: WorkloadClientAPI,
    auditLogger: IAuditLogger
  ) {
    this.workloadClient = workloadClient;
    this.itemClient = new ItemClient(workloadClient);
    this.auditLogger = auditLogger;
  }

  // ──────────────────────────────────────────────────────────────
  // Create
  // ──────────────────────────────────────────────────────────────

  /**
   * Create a new WorkbenchDashboard item.
   */
  async createDashboard(
    workspaceId: string,
    request: CreateItemRequest<WorkbenchDashboardDefinition>
  ): Promise<ApiResponse<WorkloadItem<WorkbenchDashboardDefinition>>> {
    return this.createItem(
      workspaceId,
      ITEM_TYPES.WORKBENCH_DASHBOARD,
      request,
      DEFAULT_DASHBOARD_DEFINITION
    );
  }

  /**
   * Create a new AlertRule item.
   */
  async createAlertRule(
    workspaceId: string,
    request: CreateItemRequest<AlertRuleDefinition>
  ): Promise<ApiResponse<WorkloadItem<AlertRuleDefinition>>> {
    return this.createItem(
      workspaceId,
      ITEM_TYPES.ALERT_RULE,
      request,
      DEFAULT_ALERT_RULE_DEFINITION
    );
  }

  /**
   * Create a new SLODefinition item.
   */
  async createSloDefinition(
    workspaceId: string,
    request: CreateItemRequest<SLODefinitionDefinition>
  ): Promise<ApiResponse<WorkloadItem<SLODefinitionDefinition>>> {
    return this.createItem(
      workspaceId,
      ITEM_TYPES.SLO_DEFINITION,
      request,
      DEFAULT_SLO_DEFINITION
    );
  }

  /**
   * Generic create: validates, merges defaults, persists via Fabric API,
   * then saves the definition payload.
   */
  private async createItem<T>(
    workspaceId: string,
    itemType: ObservabilityItemType,
    request: CreateItemRequest<T>,
    defaultDefinition: T
  ): Promise<ApiResponse<WorkloadItem<T>>> {
    const startMs = Date.now();
    const shortName = ITEM_TYPE_SHORT_NAMES[itemType];

    // Validate
    const validation = this.validateCreateRequest(request, itemType);
    if (!validation.valid) {
      this.emitAudit(AUDIT_ACTIONS.ITEM_CREATE, shortName, undefined, workspaceId, "Failure", Date.now() - startMs, {
        errors: validation.errors,
      });
      return this.errorResponse("VALIDATION_FAILED", validation.errors.map((e) => e.message).join("; "));
    }

    try {
      // Step 1: Create the item in Fabric (metadata only)
      const fabricItem = await this.itemClient.createItem(workspaceId, {
        displayName: request.displayName,
        description: request.description,
        type: itemType,
        folderId: request.folderId,
      });

      // Step 2: Merge user definition with defaults and save payload
      const mergedDefinition: T = {
        ...defaultDefinition,
        ...(request.definition ?? {}),
      };

      await this.saveDefinition(fabricItem.id, mergedDefinition);

      const result: WorkloadItem<T> = {
        id: fabricItem.id,
        workspaceId: fabricItem.workspaceId,
        type: itemType,
        displayName: fabricItem.displayName,
        description: fabricItem.description,
        folderId: fabricItem.folderId,
        definition: mergedDefinition,
      };

      this.emitAudit(AUDIT_ACTIONS.ITEM_CREATE, shortName, fabricItem.id, workspaceId, "Success", Date.now() - startMs);

      return this.successResponse(result);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("ItemService.createItem", error, requestId, { workspaceId, itemType, shortName });
      this.emitAudit(AUDIT_ACTIONS.ITEM_CREATE, shortName, undefined, workspaceId, "Failure", Date.now() - startMs, {
        error: internalMessage,
        requestId,
      });
      return this.errorResponse("CREATE_FAILED", getSafeErrorMessage(error, "CREATE_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Read
  // ──────────────────────────────────────────────────────────────

  /**
   * Get a single item by ID with its full definition.
   */
  async getItem<T>(itemId: string): Promise<ApiResponse<WorkloadItem<T>>> {
    const startMs = Date.now();

    try {
      const workloadItem = await getWorkloadItem<T>(this.workloadClient, itemId);

      if (!workloadItem) {
        return this.errorResponse("NOT_FOUND", `Item ${itemId} not found`);
      }

      const result: WorkloadItem<T> = {
        id: workloadItem.id,
        workspaceId: workloadItem.workspaceId,
        type: workloadItem.type as ObservabilityItemType,
        displayName: workloadItem.displayName,
        description: workloadItem.description,
        definition: workloadItem.definition,
      };

      this.emitAudit(AUDIT_ACTIONS.ITEM_READ, workloadItem.type, itemId, workloadItem.workspaceId, "Success", Date.now() - startMs);

      return this.successResponse(result);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("ItemService.getItem", error, requestId, { itemId });
      this.emitAudit(AUDIT_ACTIONS.ITEM_READ, "unknown", itemId, undefined, "Failure", Date.now() - startMs, {
        error: internalMessage,
        requestId,
      });
      return this.errorResponse("READ_FAILED", getSafeErrorMessage(error, "READ_FAILED"), requestId);
    }
  }

  /**
   * List all items of a specific type in a workspace.
   */
  async listItems<T>(
    workspaceId: string,
    itemType: ObservabilityItemType
  ): Promise<ApiResponse<PaginatedList<WorkloadItemMetadata>>> {
    const startMs = Date.now();
    const shortName = ITEM_TYPE_SHORT_NAMES[itemType];

    try {
      const fabricItems = await this.itemClient.getItemsByType(workspaceId, itemType);

      const items: WorkloadItemMetadata[] = fabricItems.map((fi) => ({
        id: fi.id,
        workspaceId: fi.workspaceId,
        type: itemType,
        displayName: fi.displayName,
        description: fi.description,
        folderId: fi.folderId,
      }));

      this.emitAudit(AUDIT_ACTIONS.ITEM_LIST, shortName, undefined, workspaceId, "Success", Date.now() - startMs, {
        count: items.length,
      });

      return this.successResponse({
        items,
        totalCount: items.length,
      });
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("ItemService.listItems", error, requestId, { workspaceId, itemType });
      this.emitAudit(AUDIT_ACTIONS.ITEM_LIST, shortName, undefined, workspaceId, "Failure", Date.now() - startMs, {
        error: internalMessage,
        requestId,
      });
      return this.errorResponse("LIST_FAILED", getSafeErrorMessage(error, "LIST_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Update
  // ──────────────────────────────────────────────────────────────

  /**
   * Update an item's metadata and/or definition.
   */
  async updateItem<T>(
    workspaceId: string,
    itemId: string,
    request: UpdateItemRequest<T>
  ): Promise<ApiResponse<WorkloadItem<T>>> {
    const startMs = Date.now();

    try {
      // Update metadata if display name or description changed
      if (request.displayName || request.description) {
        await this.itemClient.updateItem(workspaceId, itemId, {
          displayName: request.displayName,
          description: request.description,
        });
      }

      // Update definition if provided
      if (request.definition) {
        // Get existing definition to merge
        const existing = await getWorkloadItem<T>(this.workloadClient, itemId);
        const mergedDefinition: T = {
          ...(existing?.definition ?? {} as T),
          ...request.definition,
        };
        await this.saveDefinition(itemId, mergedDefinition);
      }

      // Fetch the updated item to return
      const updated = await getWorkloadItem<T>(this.workloadClient, itemId);

      const result: WorkloadItem<T> = {
        id: updated.id,
        workspaceId: updated.workspaceId,
        type: updated.type as ObservabilityItemType,
        displayName: updated.displayName,
        description: updated.description,
        definition: updated.definition,
      };

      this.emitAudit(AUDIT_ACTIONS.ITEM_UPDATE, updated.type, itemId, workspaceId, "Success", Date.now() - startMs);

      return this.successResponse(result);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("ItemService.updateItem", error, requestId, { workspaceId, itemId });
      this.emitAudit(AUDIT_ACTIONS.ITEM_UPDATE, "unknown", itemId, workspaceId, "Failure", Date.now() - startMs, {
        error: internalMessage,
        requestId,
      });
      return this.errorResponse("UPDATE_FAILED", getSafeErrorMessage(error, "UPDATE_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Delete
  // ──────────────────────────────────────────────────────────────

  /**
   * Delete an item from Fabric.
   */
  async deleteItem(workspaceId: string, itemId: string): Promise<ApiResponse<void>> {
    const startMs = Date.now();

    try {
      await this.itemClient.deleteItem(workspaceId, itemId);

      this.emitAudit(AUDIT_ACTIONS.ITEM_DELETE, "item", itemId, workspaceId, "Success", Date.now() - startMs);

      return this.successResponse(undefined);
    } catch (error) {
      const requestId = generateRequestId();
      const internalMessage = error instanceof Error ? error.message : String(error);
      logServerError("ItemService.deleteItem", error, requestId, { workspaceId, itemId });
      this.emitAudit(AUDIT_ACTIONS.ITEM_DELETE, "item", itemId, workspaceId, "Failure", Date.now() - startMs, {
        error: internalMessage,
        requestId,
      });
      return this.errorResponse("DELETE_FAILED", getSafeErrorMessage(error, "DELETE_FAILED"), requestId);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────

  /**
   * Validate a create request.
   */
  private validateCreateRequest<T>(
    request: CreateItemRequest<T>,
    itemType: ObservabilityItemType
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Display name is required and must be 1-256 characters
    if (!request.displayName || request.displayName.trim().length === 0) {
      errors.push({
        field: "displayName",
        message: "Display name is required",
        code: "REQUIRED",
      });
    } else if (request.displayName.length > 256) {
      errors.push({
        field: "displayName",
        message: "Display name must be 256 characters or fewer",
        code: "MAX_LENGTH",
      });
    }

    // Description max length
    if (request.description && request.description.length > 4000) {
      errors.push({
        field: "description",
        message: "Description must be 4000 characters or fewer",
        code: "MAX_LENGTH",
      });
    }

    // Item-type-specific validation
    if (itemType === ITEM_TYPES.ALERT_RULE && request.definition) {
      const def = request.definition as unknown as AlertRuleDefinition;
      if (def.threshold !== undefined && def.threshold < 0) {
        errors.push({
          field: "definition.threshold",
          message: "Threshold must be non-negative",
          code: "INVALID_VALUE",
        });
      }
      if (def.cooldown !== undefined && def.cooldown < 0) {
        errors.push({
          field: "definition.cooldown",
          message: "Cooldown must be non-negative",
          code: "INVALID_VALUE",
        });
      }
    }

    if (itemType === ITEM_TYPES.SLO_DEFINITION && request.definition) {
      const def = request.definition as unknown as SLODefinitionDefinition;
      if (def.targetValue !== undefined && (def.targetValue < 0 || def.targetValue > 100)) {
        errors.push({
          field: "definition.targetValue",
          message: "Target value must be between 0 and 100",
          code: "INVALID_VALUE",
        });
      }
      if (
        def.warningThreshold !== undefined &&
        def.targetValue !== undefined &&
        def.warningThreshold > def.targetValue
      ) {
        errors.push({
          field: "definition.warningThreshold",
          message: "Warning threshold must not exceed target value",
          code: "INVALID_VALUE",
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ──────────────────────────────────────────────────────────────
  // Internal Helpers
  // ──────────────────────────────────────────────────────────────

  /**
   * Save a definition payload to an item via the Workload SDK.
   */
  private async saveDefinition<T>(itemId: string, definition: T): Promise<void> {
    const definitionPart = {
      path: ItemDefinitionPath.Default,
      payload: btoa(JSON.stringify(definition, null, 2)),
      payloadType: PayloadType.InlineBase64,
    };

    await callUpdateItemDefinition(this.workloadClient, itemId, [definitionPart], false);
  }

  /**
   * Build a success response envelope.
   */
  private successResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build an error response envelope.
   */
  private errorResponse(code: string, message: string, requestId?: string): ApiResponse<any> {
    return {
      success: false,
      error: { code, message, requestId },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Emit an audit entry.
   */
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

let _itemServiceInstance: ItemService | null = null;

export function getItemService(
  workloadClient: WorkloadClientAPI,
  auditLogger: IAuditLogger
): ItemService {
  if (!_itemServiceInstance) {
    _itemServiceInstance = new ItemService(workloadClient, auditLogger);
  }
  return _itemServiceInstance;
}

export function resetItemService(): void {
  _itemServiceInstance = null;
}
