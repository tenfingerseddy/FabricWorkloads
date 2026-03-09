/**
 * Item Controller -- Observability Workbench
 *
 * Controller layer for CRUD operations on our three Fabric item types.
 * This controller is invoked from the Fabric Workload SDK action handler
 * (index.worker.ts) and from frontend React components via the route
 * dispatch layer.
 *
 * Responsibilities:
 *   - Parse and validate incoming action data
 *   - Delegate to ItemService for business logic
 *   - Return structured ApiResponse envelopes
 *
 * The controller does NOT handle auth directly -- the WorkloadClientAPI
 * already carries the user's delegated token.
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemService, getItemService } from "../services/itemService";
import { getAuditService } from "../services/auditService";
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
} from "../types/workloadItems";
import { WorkbenchDashboardDefinition } from "../items/WorkbenchDashboard/WorkbenchDashboardDefinition";
import { AlertRuleDefinition } from "../items/AlertRule/AlertRuleDefinition";
import { SLODefinitionDefinition } from "../items/SLODefinition/SLODefinitionDefinition";

// ════════════════════════════════════════════════════════════════
// Item Controller
// ════════════════════════════════════════════════════════════════

export class ItemController {
  private itemService: ItemService;

  constructor(workloadClient: WorkloadClientAPI) {
    const auditLogger = getAuditService();
    this.itemService = getItemService(workloadClient, auditLogger);
  }

  // ──────────────────────────────────────────────────────────────
  // Dashboard CRUD
  // ──────────────────────────────────────────────────────────────

  async createDashboard(
    workspaceId: string,
    request: CreateItemRequest<WorkbenchDashboardDefinition>
  ): Promise<ApiResponse<WorkloadItem<WorkbenchDashboardDefinition>>> {
    return this.itemService.createDashboard(workspaceId, request);
  }

  async getDashboard(
    itemId: string
  ): Promise<ApiResponse<WorkloadItem<WorkbenchDashboardDefinition>>> {
    return this.itemService.getItem<WorkbenchDashboardDefinition>(itemId);
  }

  async listDashboards(
    workspaceId: string
  ): Promise<ApiResponse<PaginatedList<WorkloadItemMetadata>>> {
    return this.itemService.listItems(workspaceId, ITEM_TYPES.WORKBENCH_DASHBOARD);
  }

  async updateDashboard(
    workspaceId: string,
    itemId: string,
    request: UpdateItemRequest<WorkbenchDashboardDefinition>
  ): Promise<ApiResponse<WorkloadItem<WorkbenchDashboardDefinition>>> {
    return this.itemService.updateItem<WorkbenchDashboardDefinition>(workspaceId, itemId, request);
  }

  async deleteDashboard(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<void>> {
    return this.itemService.deleteItem(workspaceId, itemId);
  }

  // ──────────────────────────────────────────────────────────────
  // AlertRule CRUD
  // ──────────────────────────────────────────────────────────────

  async createAlertRule(
    workspaceId: string,
    request: CreateItemRequest<AlertRuleDefinition>
  ): Promise<ApiResponse<WorkloadItem<AlertRuleDefinition>>> {
    return this.itemService.createAlertRule(workspaceId, request);
  }

  async getAlertRule(
    itemId: string
  ): Promise<ApiResponse<WorkloadItem<AlertRuleDefinition>>> {
    return this.itemService.getItem<AlertRuleDefinition>(itemId);
  }

  async listAlertRules(
    workspaceId: string
  ): Promise<ApiResponse<PaginatedList<WorkloadItemMetadata>>> {
    return this.itemService.listItems(workspaceId, ITEM_TYPES.ALERT_RULE);
  }

  async updateAlertRule(
    workspaceId: string,
    itemId: string,
    request: UpdateItemRequest<AlertRuleDefinition>
  ): Promise<ApiResponse<WorkloadItem<AlertRuleDefinition>>> {
    return this.itemService.updateItem<AlertRuleDefinition>(workspaceId, itemId, request);
  }

  async deleteAlertRule(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<void>> {
    return this.itemService.deleteItem(workspaceId, itemId);
  }

  // ──────────────────────────────────────────────────────────────
  // SLODefinition CRUD
  // ──────────────────────────────────────────────────────────────

  async createSloDefinition(
    workspaceId: string,
    request: CreateItemRequest<SLODefinitionDefinition>
  ): Promise<ApiResponse<WorkloadItem<SLODefinitionDefinition>>> {
    return this.itemService.createSloDefinition(workspaceId, request);
  }

  async getSloDefinition(
    itemId: string
  ): Promise<ApiResponse<WorkloadItem<SLODefinitionDefinition>>> {
    return this.itemService.getItem<SLODefinitionDefinition>(itemId);
  }

  async listSloDefinitions(
    workspaceId: string
  ): Promise<ApiResponse<PaginatedList<WorkloadItemMetadata>>> {
    return this.itemService.listItems(workspaceId, ITEM_TYPES.SLO_DEFINITION);
  }

  async updateSloDefinition(
    workspaceId: string,
    itemId: string,
    request: UpdateItemRequest<SLODefinitionDefinition>
  ): Promise<ApiResponse<WorkloadItem<SLODefinitionDefinition>>> {
    return this.itemService.updateItem<SLODefinitionDefinition>(workspaceId, itemId, request);
  }

  async deleteSloDefinition(
    workspaceId: string,
    itemId: string
  ): Promise<ApiResponse<void>> {
    return this.itemService.deleteItem(workspaceId, itemId);
  }

  // ──────────────────────────────────────────────────────────────
  // Generic (type-agnostic) Operations
  // ──────────────────────────────────────────────────────────────

  /**
   * Generic get by item ID (returns raw definition as unknown).
   * Useful when the caller does not know the item type in advance.
   */
  async getAnyItem(itemId: string): Promise<ApiResponse<WorkloadItem<unknown>>> {
    return this.itemService.getItem<unknown>(itemId);
  }

  /**
   * Generic delete by workspace and item ID.
   */
  async deleteAnyItem(workspaceId: string, itemId: string): Promise<ApiResponse<void>> {
    return this.itemService.deleteItem(workspaceId, itemId);
  }

  /**
   * Resolve an item type short name to its full qualified type.
   */
  resolveItemType(shortName: string): ObservabilityItemType | undefined {
    const entry = Object.entries(ITEM_TYPE_SHORT_NAMES).find(
      ([_, v]) => v.toLowerCase() === shortName.toLowerCase()
    );
    return entry ? (entry[0] as ObservabilityItemType) : undefined;
  }
}

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _itemControllerInstance: ItemController | null = null;

export function getItemController(workloadClient: WorkloadClientAPI): ItemController {
  if (!_itemControllerInstance) {
    _itemControllerInstance = new ItemController(workloadClient);
  }
  return _itemControllerInstance;
}

export function resetItemController(): void {
  _itemControllerInstance = null;
}
