/**
 * Action Routes -- Observability Workbench
 *
 * Maps Fabric Workload SDK action strings to controller methods.
 *
 * In the Extensibility Toolkit model, there is no Express server.
 * The Fabric iframe communicates via `workloadClient.action.onAction()`.
 * This module provides a structured dispatch layer on top of that.
 *
 * Action naming convention:
 *   "<domain>.<operation>"
 *
 * Examples:
 *   "dashboard.create"     -> ItemController.createDashboard
 *   "job.submit"           -> JobController.submitJob
 *   "health.check"         -> HealthController.getHealthReport
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { getItemController } from "../controllers/itemController";
import { getJobController } from "../controllers/jobController";
import { getHealthController } from "../controllers/healthController";
import { ApiResponse } from "../types/workloadItems";

// ════════════════════════════════════════════════════════════════
// Action Handler Type
// ════════════════════════════════════════════════════════════════

export type ActionHandler = (data: any) => Promise<ApiResponse<any>>;

export interface RouteDefinition {
  action: string;
  description: string;
  handler: ActionHandler;
}

// ════════════════════════════════════════════════════════════════
// Route Registry
// ════════════════════════════════════════════════════════════════

/**
 * Build the complete route table for the workload.
 * Called once during worker initialization with the WorkloadClientAPI.
 */
export function buildActionRoutes(workloadClient: WorkloadClientAPI): Map<string, RouteDefinition> {
  const itemCtrl = getItemController(workloadClient);
  const jobCtrl = getJobController(workloadClient);
  const healthCtrl = getHealthController(workloadClient);

  const routes: RouteDefinition[] = [
    // ── Dashboard ──────────────────────────────────────────────
    {
      action: "dashboard.create",
      description: "Create a new WorkbenchDashboard",
      handler: (data) => itemCtrl.createDashboard(data.workspaceId, data.request),
    },
    {
      action: "dashboard.get",
      description: "Get a WorkbenchDashboard by ID",
      handler: (data) => itemCtrl.getDashboard(data.itemId),
    },
    {
      action: "dashboard.list",
      description: "List WorkbenchDashboards in a workspace",
      handler: (data) => itemCtrl.listDashboards(data.workspaceId),
    },
    {
      action: "dashboard.update",
      description: "Update a WorkbenchDashboard",
      handler: (data) => itemCtrl.updateDashboard(data.workspaceId, data.itemId, data.request),
    },
    {
      action: "dashboard.delete",
      description: "Delete a WorkbenchDashboard",
      handler: (data) => itemCtrl.deleteDashboard(data.workspaceId, data.itemId),
    },

    // ── AlertRule ──────────────────────────────────────────────
    {
      action: "alertRule.create",
      description: "Create a new AlertRule",
      handler: (data) => itemCtrl.createAlertRule(data.workspaceId, data.request),
    },
    {
      action: "alertRule.get",
      description: "Get an AlertRule by ID",
      handler: (data) => itemCtrl.getAlertRule(data.itemId),
    },
    {
      action: "alertRule.list",
      description: "List AlertRules in a workspace",
      handler: (data) => itemCtrl.listAlertRules(data.workspaceId),
    },
    {
      action: "alertRule.update",
      description: "Update an AlertRule",
      handler: (data) => itemCtrl.updateAlertRule(data.workspaceId, data.itemId, data.request),
    },
    {
      action: "alertRule.delete",
      description: "Delete an AlertRule",
      handler: (data) => itemCtrl.deleteAlertRule(data.workspaceId, data.itemId),
    },

    // ── SLODefinition ─────────────────────────────────────────
    {
      action: "sloDefinition.create",
      description: "Create a new SLODefinition",
      handler: (data) => itemCtrl.createSloDefinition(data.workspaceId, data.request),
    },
    {
      action: "sloDefinition.get",
      description: "Get an SLODefinition by ID",
      handler: (data) => itemCtrl.getSloDefinition(data.itemId),
    },
    {
      action: "sloDefinition.list",
      description: "List SLODefinitions in a workspace",
      handler: (data) => itemCtrl.listSloDefinitions(data.workspaceId),
    },
    {
      action: "sloDefinition.update",
      description: "Update an SLODefinition",
      handler: (data) => itemCtrl.updateSloDefinition(data.workspaceId, data.itemId, data.request),
    },
    {
      action: "sloDefinition.delete",
      description: "Delete an SLODefinition",
      handler: (data) => itemCtrl.deleteSloDefinition(data.workspaceId, data.itemId),
    },

    // ── Generic Item ──────────────────────────────────────────
    {
      action: "item.get",
      description: "Get any item by ID (type-agnostic)",
      handler: (data) => itemCtrl.getAnyItem(data.itemId),
    },
    {
      action: "item.delete",
      description: "Delete any item by workspace and item ID",
      handler: (data) => itemCtrl.deleteAnyItem(data.workspaceId, data.itemId),
    },

    // ── Jobs ──────────────────────────────────────────────────
    {
      action: "job.submit",
      description: "Submit an on-demand job",
      handler: (data) => jobCtrl.submitJob(data.workspaceId, data.itemId, data.request),
    },
    {
      action: "job.submitDataCollection",
      description: "Submit a data collection job",
      handler: (data) => jobCtrl.submitDataCollection(data.workspaceId, data.itemId, data.options),
    },
    {
      action: "job.submitCorrelation",
      description: "Submit a correlation build job",
      handler: (data) => jobCtrl.submitCorrelationBuild(data.workspaceId, data.itemId, data.options),
    },
    {
      action: "job.submitSloEval",
      description: "Submit an SLO evaluation job",
      handler: (data) => jobCtrl.submitSloEvaluation(data.workspaceId, data.itemId),
    },
    {
      action: "job.submitAlertEval",
      description: "Submit an alert evaluation job",
      handler: (data) => jobCtrl.submitAlertEvaluation(data.workspaceId, data.itemId),
    },
    {
      action: "job.status",
      description: "Get job instance status",
      handler: (data) => jobCtrl.getJobStatus(data.workspaceId, data.itemId, data.jobInstanceId),
    },
    {
      action: "job.list",
      description: "List job instances for an item",
      handler: (data) => jobCtrl.listJobs(data.workspaceId, data.itemId),
    },
    {
      action: "job.summary",
      description: "Get job activity summary for an item",
      handler: (data) => jobCtrl.getJobSummary(data.workspaceId, data.itemId),
    },
    {
      action: "job.cancel",
      description: "Cancel a running job",
      handler: (data) => jobCtrl.cancelJob(data.workspaceId, data.itemId, data.jobInstanceId, data.reason),
    },
    {
      action: "job.types",
      description: "Get available job types",
      handler: async () => ({
        success: true,
        data: jobCtrl.getAvailableJobTypes(),
        timestamp: new Date().toISOString(),
      }),
    },

    // ── Scheduling ────────────────────────────────────────────
    {
      action: "schedule.create",
      description: "Create a recurring job schedule",
      handler: (data) => jobCtrl.createSchedule(data.workspaceId, data.itemId, data.config),
    },
    {
      action: "schedule.list",
      description: "List schedules for an item and job type",
      handler: (data) => jobCtrl.listSchedules(data.workspaceId, data.itemId, data.jobType),
    },

    // ── Health ─────────────────────────────────────────────────
    {
      action: "health.check",
      description: "Comprehensive health report",
      handler: () => healthCtrl.getHealthReport(),
    },
    {
      action: "health.liveness",
      description: "Lightweight liveness check",
      handler: () => healthCtrl.getLivenessCheck(),
    },
    {
      action: "health.readiness",
      description: "Readiness check",
      handler: () => healthCtrl.getReadinessCheck(),
    },
  ];

  // Build the lookup map
  const routeMap = new Map<string, RouteDefinition>();
  for (const route of routes) {
    routeMap.set(route.action, route);
  }
  return routeMap;
}

// ════════════════════════════════════════════════════════════════
// Action Dispatcher
// ════════════════════════════════════════════════════════════════

/**
 * Dispatch an action to the appropriate controller handler.
 * Returns a structured ApiResponse or an error response for unknown actions.
 */
export async function dispatchAction(
  routes: Map<string, RouteDefinition>,
  action: string,
  data: any
): Promise<ApiResponse<any>> {
  const route = routes.get(action);

  if (!route) {
    console.warn(`[ActionRoutes] Unknown action: ${action}`);
    return {
      success: false,
      error: {
        code: "UNKNOWN_ACTION",
        message: `No handler registered for action: ${action}`,
        details: `Available actions: ${Array.from(routes.keys()).join(", ")}`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    console.log(`[ActionRoutes] Dispatching: ${action}`);
    const result = await route.handler(data);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ActionRoutes] Error in ${action}:`, error);

    return {
      success: false,
      error: {
        code: "ACTION_ERROR",
        message: `Action ${action} failed: ${message}`,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
