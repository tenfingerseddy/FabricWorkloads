/**
 * KQL Query Service — Observability Workbench
 *
 * Queries the live Eventhouse (EH_Observability) via the Kusto REST v2 API
 * and returns strongly typed data for the dashboard React components.
 *
 * Auth: acquires a token via the Fabric Workload SDK OBO flow, scoped to
 * the Kusto cluster. Falls back to sample data when the cluster is
 * unreachable (dev mode, offline, or permission issues).
 *
 * Sprint 03 — Task B1 (P0)
 */

import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { FabricAuthenticationService } from "../clients/FabricAuthenticationService";
import { redactSensitive } from "../utils/errors";
import {
  DashboardData,
  SLOCardData,
  SloStatusResponse,
  IncidentRow,
  AlertHistoryResponse,
  CorrelationResponse,
  CorrelationChain,
  CorrelationLink,
  WasteScoreResponse,
  WasteItemData,
  AggregateWaste,
  FailedJobsResponse,
  FailedJobRow,
  WorkspaceOverview,
  KqlServiceConfig,
  KqlQueryRequest,
  KqlQueryResponse,
  KqlResponseTable,
  KqlColumn,
  TimeRange,
  timeRangeToKql,
  HealthStatus,
} from "../types/observability";

// ════════════════════════════════════════════════════════════════
// Default Configuration
// ════════════════════════════════════════════════════════════════

// TODO: In the production workload, queryEndpoint and database should come from
// the workload manifest / workload configuration at runtime rather than being
// hardcoded here. The Fabric Workload SDK will provide these values through the
// WorkloadClientAPI.getWorkloadConfig() method once the Extensibility Toolkit
// migration is complete. Until then, callers must pass config overrides.
const DEFAULT_CONFIG: KqlServiceConfig = {
  queryEndpoint: "",
  database: "EH_Observability",
  useFallbackData: true,
  timeoutMs: 30_000,
};

/** Kusto cluster scope for OBO token acquisition */
const KUSTO_SCOPE = "https://kusto.kusto.windows.net/.default";

// ════════════════════════════════════════════════════════════════
// KQL Query Service
// ════════════════════════════════════════════════════════════════

export class KqlQueryService {
  private config: KqlServiceConfig;
  private authService: FabricAuthenticationService;
  private workloadClient: WorkloadClientAPI;

  constructor(
    workloadClient: WorkloadClientAPI,
    config?: Partial<KqlServiceConfig>
  ) {
    this.workloadClient = workloadClient;
    this.authService = new FabricAuthenticationService(workloadClient);
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!this.config.queryEndpoint) {
      throw new Error(
        "KqlQueryService requires a queryEndpoint. Pass it via config or " +
          "ensure the workload manifest provides it at runtime."
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Low-level KQL execution
  // ──────────────────────────────────────────────────────────────

  /**
   * Execute a KQL query against the Eventhouse and return typed rows.
   * Handles token acquisition, HTTP transport, and row-to-object mapping.
   */
  private async executeQuery<T extends Record<string, unknown>>(
    kql: string
  ): Promise<T[]> {
    const token = await this.authService.acquireAccessToken(KUSTO_SCOPE);

    const body: KqlQueryRequest = {
      db: this.config.database,
      csl: kql,
      properties: {
        Options: {
          queryconsistency: "strongconsistency",
          servertimeout: "00:00:30",
        },
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    try {
      const response = await fetch(
        `${this.config.queryEndpoint}/v2/rest/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        // Log full response body server-side for debugging; do not include in thrown error
        console.error(
          `[KqlQueryService] Query failed: HTTP ${response.status}`,
          redactSensitive(errorText.substring(0, 500))
        );
        throw new KqlQueryError(
          `KQL query failed: HTTP ${response.status}`,
          response.status,
          // Do not store raw response body -- it may contain internal infrastructure details
          ""
        );
      }

      const json: KqlQueryResponse = await response.json();
      return this.parseResponse<T>(json);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Parse a Kusto v2 REST response into an array of typed objects.
   * The v2 format returns an array of frames; we find the PrimaryResult
   * table and map each row using the column descriptors.
   */
  private parseResponse<T extends Record<string, unknown>>(
    response: KqlQueryResponse
  ): T[] {
    // v2 progressive frames format
    const frames: KqlResponseTable[] =
      response.frames ?? response.Tables ?? [];

    // The PrimaryResult table carries the query data
    const dataTable = frames.find(
      (f) =>
        f.TableName === "PrimaryResult" ||
        f.FrameType === "DataTable" ||
        f.TableId === 0
    );

    if (!dataTable || !dataTable.Columns || !dataTable.Rows) {
      return [];
    }

    const columns: KqlColumn[] = dataTable.Columns;

    return dataTable.Rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        obj[col.ColumnName] = row[idx];
      });
      return obj as T;
    });
  }

  /**
   * Safely execute a query with optional fallback data.
   * When `useFallbackData` is enabled and the query fails, the
   * provided fallback function is called instead of throwing.
   */
  private async safeQuery<T extends Record<string, unknown>>(
    kql: string,
    fallback: () => T[]
  ): Promise<{ rows: T[]; isLive: boolean }> {
    try {
      const rows = await this.executeQuery<T>(kql);
      return { rows, isLive: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        "[KqlQueryService] Query failed, using fallback data:",
        redactSensitive(errorMsg)
      );
      if (this.config.useFallbackData) {
        return { rows: fallback(), isLive: false };
      }
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Public Query Functions
  // ──────────────────────────────────────────────────────────────

  /**
   * Fetch the complete dashboard dataset in a single call.
   * Runs multiple KQL queries in parallel for performance.
   */
  async getDashboardData(timeRange: TimeRange = "24h"): Promise<DashboardData> {
    const [sloStatus, alertHistory, wasteScores, failedJobs, overviews] =
      await Promise.all([
        this.getSloStatus(timeRange),
        this.getAlertHistory(timeRange),
        this.getWasteScores(),
        this.getFailedJobs(timeRange),
        this.getWorkspaceOverviews(timeRange),
      ]);

    return {
      sloCards: sloStatus.cards,
      incidents: alertHistory.alerts,
      failedJobs: failedJobs.jobs,
      wasteItems: wasteScores.items,
      aggregateWaste: wasteScores.aggregate,
      workspaceOverviews: overviews,
      lastRefreshed: new Date().toISOString(),
    };
  }

  /**
   * SLO status cards with success rate, duration percentiles,
   * freshness, and error budget remaining.
   */
  async getSloStatus(timeRange: TimeRange = "7d"): Promise<SloStatusResponse> {
    const ago = timeRangeToKql(timeRange);

    // Combined query: success rates + duration percentiles + freshness
    const kql = `
let SuccessRates = FabricEvents
| where StartTimeUtc > ago(${ago})
| where Status in ("Completed", "Failed")
| summarize
    TotalRuns = count(),
    SuccessfulRuns = countif(Status == "Completed")
    by ItemId, ItemName, ItemType
| extend SuccessRate = round(todouble(SuccessfulRuns) / TotalRuns * 100, 2);
let Durations = FabricEvents
| where StartTimeUtc > ago(${ago})
| where Status == "Completed" and DurationSeconds > 0
| summarize
    P50 = percentile(DurationSeconds, 50),
    P95 = percentile(DurationSeconds, 95)
    by ItemId;
let Freshness = FabricEvents
| where Status == "Completed"
| summarize LastSuccess = max(EndTimeUtc) by ItemId
| extend HoursSinceSuccess = round(datetime_diff('second', now(), LastSuccess) / 3600.0, 1);
let Targets = SloDefinitions
| where IsActive == true
| where MetricType == "SuccessRate"
| project ItemId, TargetValue;
let Budgets = SloSnapshots
| summarize arg_max(ComputedAt, *) by ItemId
| where MetricType == "SuccessRate"
| project ItemId, ErrorBudgetRemaining;
SuccessRates
| join kind=leftouter Durations on ItemId
| join kind=leftouter Freshness on ItemId
| join kind=leftouter Targets on ItemId
| join kind=leftouter Budgets on ItemId
| project
    ItemName,
    ItemType,
    SuccessRate,
    TargetValue = coalesce(TargetValue, 99.5),
    P50 = coalesce(P50, 0.0),
    P95 = coalesce(P95, 0.0),
    HoursSinceSuccess = coalesce(HoursSinceSuccess, 0.0),
    ErrorBudgetRemaining = coalesce(ErrorBudgetRemaining, 100.0)
| order by SuccessRate asc`;

    interface SloRow {
      ItemName: string;
      ItemType: string;
      SuccessRate: number;
      TargetValue: number;
      P50: number;
      P95: number;
      HoursSinceSuccess: number;
      ErrorBudgetRemaining: number;
    }

    const { rows } = await this.safeQuery<SloRow>(kql, () =>
      SAMPLE_SLO_ROWS
    );

    const cards: SLOCardData[] = rows.map((r) => ({
      name: r.ItemName,
      itemType: r.ItemType,
      successRate: r.SuccessRate,
      successTarget: r.TargetValue,
      p50Duration: formatDuration(r.P50),
      p95Duration: formatDuration(r.P95),
      freshness: formatFreshness(r.HoursSinceSuccess),
      freshnessStatus: getFreshnessStatus(r.HoursSinceSuccess, r.ItemType),
      errorBudgetRemaining: Math.round(r.ErrorBudgetRemaining),
    }));

    const breachingCount = cards.filter(
      (c) => c.successRate < c.successTarget
    ).length;
    const warningCount = cards.filter(
      (c) =>
        c.successRate >= c.successTarget &&
        c.successRate < c.successTarget + 1
    ).length;

    return {
      cards,
      breachingCount,
      warningCount,
      healthyCount: cards.length - breachingCount - warningCount,
    };
  }

  /**
   * Alert/incident history from the AlertLog table.
   */
  async getAlertHistory(
    timeRange: TimeRange = "24h"
  ): Promise<AlertHistoryResponse> {
    const ago = timeRangeToKql(timeRange);

    const kql = `
AlertLog
| where Timestamp > ago(${ago})
| project
    Timestamp,
    ItemName,
    Kind,
    Severity,
    Message,
    Value,
    Threshold,
    NotificationSent
| order by Timestamp desc
| take 50`;

    interface AlertRow {
      Timestamp: string;
      ItemName: string;
      Kind: string;
      Severity: string;
      Message: string;
      Value: number;
      Threshold: number;
      NotificationSent: boolean;
    }

    const { rows } = await this.safeQuery<AlertRow>(kql, () =>
      SAMPLE_ALERT_ROWS
    );

    const alerts: IncidentRow[] = rows.map((r) => ({
      timestamp: formatTimestamp(r.Timestamp),
      sloName: r.ItemName,
      metric: r.Kind,
      severity: (r.Severity === "critical" ? "critical" : "warning") as "warning" | "critical",
      detail: r.Message || `Value ${r.Value} crossed threshold ${r.Threshold}`,
      resolved: r.NotificationSent,
    }));

    return {
      alerts,
      activeCount: alerts.filter((a) => !a.resolved).length,
      resolvedCount: alerts.filter((a) => a.resolved).length,
    };
  }

  /**
   * Cross-item correlation chains from pipeline to downstream items.
   */
  async getCorrelations(
    timeRange: TimeRange = "7d"
  ): Promise<CorrelationResponse> {
    const ago = timeRangeToKql(timeRange);

    // Chain summary: pipeline -> child counts with mixed success/failure
    const chainsKql = `
let Pipelines = FabricEvents
| where StartTimeUtc > ago(${ago})
| where ItemType == "DataPipeline";
let Downstream = FabricEvents
| where StartTimeUtc > ago(${ago})
| where ItemType in ("Notebook", "Dataflow", "CopyJob");
Pipelines
| join kind=inner (Downstream) on WorkspaceId
| where StartTimeUtc1 between (StartTimeUtc - 30s .. EndTimeUtc + 30s)
| summarize
    ChildCount = count(),
    SucceededChildren = countif(Status1 == "Completed"),
    FailedChildren = countif(Status1 == "Failed")
    by EventId, ItemName, Status, WorkspaceName
| extend ChainDurationMinutes = 0.0
| project
    PipelineName = ItemName,
    WorkspaceName,
    ChildCount,
    SucceededChildren,
    FailedChildren,
    ChainDurationMinutes
| order by ChildCount desc
| take 20`;

    // Individual links: pipeline -> each downstream item
    const linksKql = `
let Pipelines = FabricEvents
| where StartTimeUtc > ago(${ago})
| where ItemType == "DataPipeline"
| where Status in ("Completed", "Failed");
let Downstream = FabricEvents
| where StartTimeUtc > ago(${ago})
| where ItemType in ("Notebook", "Dataflow", "CopyJob", "Lakehouse");
Pipelines
| join kind=inner (Downstream) on WorkspaceId
| where StartTimeUtc1 between (StartTimeUtc - 30s .. EndTimeUtc + 30s)
| project
    PipelineName = ItemName,
    PipelineStatus = Status,
    PipelineStart = StartTimeUtc,
    ChildName = ItemName1,
    ChildType = ItemType1,
    ChildStatus = Status1,
    ChildStart = StartTimeUtc1,
    ChildDuration = DurationSeconds1
| order by PipelineStart desc
| take 100`;

    interface ChainRow {
      PipelineName: string;
      WorkspaceName: string;
      ChildCount: number;
      SucceededChildren: number;
      FailedChildren: number;
      ChainDurationMinutes: number;
    }
    interface LinkRow {
      PipelineName: string;
      PipelineStatus: string;
      PipelineStart: string;
      ChildName: string;
      ChildType: string;
      ChildStatus: string;
      ChildStart: string;
      ChildDuration: number;
    }

    const [chainsResult, linksResult] = await Promise.all([
      this.safeQuery<ChainRow>(chainsKql, () => []),
      this.safeQuery<LinkRow>(linksKql, () => []),
    ]);

    const chains: CorrelationChain[] = chainsResult.rows.map((r) => ({
      pipelineName: r.PipelineName,
      workspaceName: r.WorkspaceName,
      childCount: r.ChildCount,
      succeededChildren: r.SucceededChildren,
      failedChildren: r.FailedChildren,
      chainDurationMinutes: r.ChainDurationMinutes,
    }));

    const links: CorrelationLink[] = linksResult.rows.map((r) => ({
      pipelineName: r.PipelineName,
      pipelineStatus: r.PipelineStatus,
      pipelineStart: r.PipelineStart,
      childName: r.ChildName,
      childType: r.ChildType,
      childStatus: r.ChildStatus,
      childStart: r.ChildStart,
      childDuration: r.ChildDuration,
    }));

    return { chains, links };
  }

  /**
   * CU waste scores: per-item retry waste + duration regression waste.
   * Uses the F64 CU rate ($0.0032/CU-second) for cost estimation.
   */
  async getWasteScores(): Promise<WasteScoreResponse> {
    const kql = `
let CU_RATE_PER_SECOND = 0.0032;
let RetryWaste = FabricEvents
| where coalesce(StartTimeUtc, IngestedAt) > ago(7d)
| where Status == "Failed" and DurationSeconds > 0
| summarize
    FailedRuns = count(),
    FailedDurationSeconds = sum(DurationSeconds)
    by ItemId, ItemName, ItemType, WorkspaceName
| extend RetryWasteCost = round(FailedDurationSeconds * CU_RATE_PER_SECOND, 2);
let DurationWaste = (
    let Baseline = FabricEvents
    | where coalesce(StartTimeUtc, IngestedAt) between (ago(30d) .. ago(7d))
    | where Status == "Completed" and DurationSeconds > 0
    | summarize BaselineP95 = percentile(DurationSeconds, 95) by ItemId;
    FabricEvents
    | where coalesce(StartTimeUtc, IngestedAt) > ago(7d)
    | where Status == "Completed" and DurationSeconds > 0
    | summarize
        CurrentP95 = percentile(DurationSeconds, 95),
        RunCount = count(),
        TotalDuration = sum(DurationSeconds)
        by ItemId, ItemName, ItemType, WorkspaceName
    | join kind=leftouter Baseline on ItemId
    | extend DurationRatio = iff(isnotnull(BaselineP95) and BaselineP95 > 0, CurrentP95 / BaselineP95, 1.0)
    | extend ExcessSeconds = iff(DurationRatio > 1.5, (CurrentP95 - BaselineP95) * RunCount, 0.0)
    | extend DurationWasteCost = round(ExcessSeconds * CU_RATE_PER_SECOND, 2)
);
RetryWaste
| join kind=fullouter DurationWaste on ItemId
| extend
    FinalItemName = coalesce(RetryWaste.ItemName, DurationWaste.ItemName),
    FinalItemType = coalesce(RetryWaste.ItemType, DurationWaste.ItemType),
    RetryWasteCost = coalesce(RetryWasteCost, 0.0),
    DurationWasteCost = coalesce(DurationWasteCost, 0.0)
| extend TotalWasteCost = RetryWasteCost + DurationWasteCost
| extend MonthlyProjected = round(TotalWasteCost * (30.0 / 7.0), 2)
| project
    ItemName = FinalItemName,
    ItemType = FinalItemType,
    RetryWasteCost,
    DurationWasteCost,
    TotalWasteCost,
    MonthlyProjected
| order by TotalWasteCost desc`;

    interface WasteRow {
      ItemName: string;
      ItemType: string;
      RetryWasteCost: number;
      DurationWasteCost: number;
      TotalWasteCost: number;
      MonthlyProjected: number;
    }

    const { rows } = await this.safeQuery<WasteRow>(kql, () =>
      SAMPLE_WASTE_ROWS
    );

    const totalWeekly = rows.reduce((sum, r) => sum + r.TotalWasteCost, 0);
    const totalMonthly = rows.reduce((sum, r) => sum + r.MonthlyProjected, 0);

    // Waste score: 100 = no waste, 0 = maximum waste
    // Score based on monthly projected cost relative to $500/mo threshold
    const computeScore = (monthlyProjected: number): number => {
      const ratio = Math.min(monthlyProjected / 500, 1);
      return Math.round((1 - ratio) * 100);
    };

    const items: WasteItemData[] = rows.map((r) => ({
      name: r.ItemName,
      itemType: r.ItemType,
      wasteScore: computeScore(r.MonthlyProjected),
      retryWaste: r.RetryWasteCost,
      durationWaste: r.DurationWasteCost,
      totalWaste: r.TotalWasteCost,
      monthlyProjected: r.MonthlyProjected,
    }));

    const aggregate: AggregateWaste = {
      score: totalMonthly > 0 ? computeScore(totalMonthly) : 100,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      totalWeekly: Math.round(totalWeekly * 100) / 100,
    };

    return { items, aggregate };
  }

  /**
   * Failed jobs with error messages from the specified time window.
   */
  async getFailedJobs(
    timeRange: TimeRange = "7d"
  ): Promise<FailedJobsResponse> {
    const ago = timeRangeToKql(timeRange);

    const kql = `
FabricEvents
| where StartTimeUtc > ago(${ago})
| where Status == "Failed"
| project
    StartTimeUtc,
    ItemName,
    ItemType,
    FailureReason,
    DurationSeconds
| order by StartTimeUtc desc
| take 50`;

    interface FailedRow {
      StartTimeUtc: string;
      ItemName: string;
      ItemType: string;
      FailureReason: string;
      DurationSeconds: number;
    }

    const { rows } = await this.safeQuery<FailedRow>(kql, () =>
      SAMPLE_FAILED_ROWS
    );

    const jobs: FailedJobRow[] = rows.map((r) => ({
      timestamp: formatTimestamp(r.StartTimeUtc),
      itemName: r.ItemName,
      itemType: r.ItemType,
      errorMessage: r.FailureReason || "Unknown error",
      duration: formatDuration(r.DurationSeconds),
    }));

    return { jobs, totalCount: jobs.length };
  }

  /**
   * Workspace-level success rate overview.
   */
  async getWorkspaceOverviews(
    timeRange: TimeRange = "24h"
  ): Promise<WorkspaceOverview[]> {
    const ago = timeRangeToKql(timeRange);

    const kql = `
FabricEvents
| where StartTimeUtc > ago(${ago})
| where Status != ""
| summarize
    TotalJobs = count(),
    Succeeded = countif(Status == "Completed"),
    Failed = countif(Status == "Failed"),
    InProgress = countif(Status == "InProgress"),
    Cancelled = countif(Status == "Cancelled")
    by WorkspaceName
| extend SuccessRate = round(todouble(Succeeded) / TotalJobs * 100, 1)
| order by TotalJobs desc`;

    interface OverviewRow {
      WorkspaceName: string;
      TotalJobs: number;
      Succeeded: number;
      Failed: number;
      InProgress: number;
      Cancelled: number;
      SuccessRate: number;
    }

    const { rows } = await this.safeQuery<OverviewRow>(kql, () => []);

    return rows.map((r) => ({
      workspaceName: r.WorkspaceName,
      totalJobs: r.TotalJobs,
      succeeded: r.Succeeded,
      failed: r.Failed,
      inProgress: r.InProgress,
      cancelled: r.Cancelled,
      successRate: r.SuccessRate,
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // Configuration
  // ──────────────────────────────────────────────────────────────

  /** Update the service configuration at runtime */
  updateConfig(config: Partial<KqlServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Check whether the Kusto endpoint is reachable */
  async healthCheck(): Promise<{ reachable: boolean; latencyMs: number }> {
    const start = performance.now();
    try {
      await this.executeQuery<{ Result: number }>('print Result = 1');
      return {
        reachable: true,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch {
      return {
        reachable: false,
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }
}

// ════════════════════════════════════════════════════════════════
// Custom Error
// ════════════════════════════════════════════════════════════════

export class KqlQueryError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "KqlQueryError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ════════════════════════════════════════════════════════════════
// Formatting Helpers
// ════════════════════════════════════════════════════════════════

/** Format seconds into a human-readable duration string (e.g. "4m 12s") */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Format hours-since-last-success into a freshness label */
function formatFreshness(hoursSince: number): string {
  if (hoursSince < 1) {
    const mins = Math.round(hoursSince * 60);
    return `${mins} min ago`;
  }
  if (hoursSince < 24) {
    const h = Math.floor(hoursSince);
    const m = Math.round((hoursSince - h) * 60);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const days = Math.round(hoursSince / 24);
  return `${days}d ago`;
}

/** Determine freshness health status based on item type thresholds */
function getFreshnessStatus(
  hoursSince: number,
  itemType: string
): HealthStatus {
  const thresholds: Record<string, { warning: number; critical: number }> = {
    DataPipeline: { warning: 12, critical: 24 },
    Pipeline: { warning: 12, critical: 24 },
    Notebook: { warning: 3, critical: 6 },
    Dataflow: { warning: 6, critical: 12 },
  };
  const t = thresholds[itemType] ?? { warning: 24, critical: 48 };

  if (hoursSince >= t.critical) return "critical";
  if (hoursSince >= t.warning) return "warning";
  return "healthy";
}

/** Format a KQL datetime string to the dashboard display format */
function formatTimestamp(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${mins}`;
  } catch {
    return isoDate;
  }
}

// ════════════════════════════════════════════════════════════════
// Sample / Fallback Data
// ════════════════════════════════════════════════════════════════
// These match the exact shapes that the dashboard component
// (WorkbenchDashboardDefaultView) renders so that dev mode
// is fully functional without a live Eventhouse connection.

interface SampleSloRow {
  ItemName: string;
  ItemType: string;
  SuccessRate: number;
  TargetValue: number;
  P50: number;
  P95: number;
  HoursSinceSuccess: number;
  ErrorBudgetRemaining: number;
}

const SAMPLE_SLO_ROWS: SampleSloRow[] = [
  {
    ItemName: "Sales Pipeline Daily",
    ItemType: "Pipeline",
    SuccessRate: 99.7,
    TargetValue: 99.5,
    P50: 252,
    P95: 525,
    HoursSinceSuccess: 0.2,
    ErrorBudgetRemaining: 82,
  },
  {
    ItemName: "Customer 360 Dataflow",
    ItemType: "Dataflow",
    SuccessRate: 98.1,
    TargetValue: 99.0,
    P50: 750,
    P95: 1330,
    HoursSinceSuccess: 2.25,
    ErrorBudgetRemaining: 12,
  },
  {
    ItemName: "Inventory Notebook",
    ItemType: "Notebook",
    SuccessRate: 95.2,
    TargetValue: 99.0,
    P50: 2718,
    P95: 4320,
    HoursSinceSuccess: 6,
    ErrorBudgetRemaining: 0,
  },
  {
    ItemName: "Finance Lakehouse Refresh",
    ItemType: "Pipeline",
    SuccessRate: 99.9,
    TargetValue: 99.5,
    P50: 128,
    P95: 230,
    HoursSinceSuccess: 0.083,
    ErrorBudgetRemaining: 95,
  },
];

interface SampleAlertRow {
  Timestamp: string;
  ItemName: string;
  Kind: string;
  Severity: string;
  Message: string;
  Value: number;
  Threshold: number;
  NotificationSent: boolean;
}

const SAMPLE_ALERT_ROWS: SampleAlertRow[] = [
  {
    Timestamp: "2026-03-09T08:42:00Z",
    ItemName: "Inventory Notebook",
    Kind: "Success Rate",
    Severity: "critical",
    Message: "Dropped to 95.2% (target: 99.0%)",
    Value: 95.2,
    Threshold: 99.0,
    NotificationSent: false,
  },
  {
    Timestamp: "2026-03-09T06:15:00Z",
    ItemName: "Customer 360 Dataflow",
    Kind: "Data Freshness",
    Severity: "warning",
    Message: "Last refresh 2h 15m ago (target: 1h)",
    Value: 2.25,
    Threshold: 1.0,
    NotificationSent: false,
  },
  {
    Timestamp: "2026-03-08T22:10:00Z",
    ItemName: "Sales Pipeline Daily",
    Kind: "P95 Duration",
    Severity: "warning",
    Message: "P95 exceeded 8m threshold",
    Value: 525,
    Threshold: 480,
    NotificationSent: true,
  },
];

interface SampleFailedRow {
  StartTimeUtc: string;
  ItemName: string;
  ItemType: string;
  FailureReason: string;
  DurationSeconds: number;
}

const SAMPLE_FAILED_ROWS: SampleFailedRow[] = [
  {
    StartTimeUtc: "2026-03-09T08:38:00Z",
    ItemName: "Inventory Notebook",
    ItemType: "Notebook",
    FailureReason:
      "OutOfMemoryError: Spark executor exceeded 8GB limit",
    DurationSeconds: 2842,
  },
  {
    StartTimeUtc: "2026-03-09T03:12:00Z",
    ItemName: "Customer 360 Dataflow",
    ItemType: "Dataflow",
    FailureReason:
      "Connection timeout to source system (SAP)",
    DurationSeconds: 904,
  },
  {
    StartTimeUtc: "2026-03-08T21:55:00Z",
    ItemName: "Sales Pipeline Daily",
    ItemType: "Pipeline",
    FailureReason:
      "Schema drift detected in staging table",
    DurationSeconds: 525,
  },
];

interface SampleWasteRow {
  ItemName: string;
  ItemType: string;
  RetryWasteCost: number;
  DurationWasteCost: number;
  TotalWasteCost: number;
  MonthlyProjected: number;
}

const SAMPLE_WASTE_ROWS: SampleWasteRow[] = [
  {
    ItemName: "Inventory Notebook",
    ItemType: "Notebook",
    RetryWasteCost: 18.4,
    DurationWasteCost: 12.8,
    TotalWasteCost: 31.2,
    MonthlyProjected: 133.71,
  },
  {
    ItemName: "Customer 360 Dataflow",
    ItemType: "Dataflow",
    RetryWasteCost: 4.2,
    DurationWasteCost: 8.9,
    TotalWasteCost: 13.1,
    MonthlyProjected: 56.14,
  },
  {
    ItemName: "Sales Pipeline Daily",
    ItemType: "Pipeline",
    RetryWasteCost: 1.8,
    DurationWasteCost: 2.4,
    TotalWasteCost: 4.2,
    MonthlyProjected: 18.0,
  },
  {
    ItemName: "Finance Lakehouse Refresh",
    ItemType: "Pipeline",
    RetryWasteCost: 0.6,
    DurationWasteCost: 0.0,
    TotalWasteCost: 0.6,
    MonthlyProjected: 2.57,
  },
];

// ════════════════════════════════════════════════════════════════
// Singleton Factory
// ════════════════════════════════════════════════════════════════

let _instance: KqlQueryService | null = null;

/**
 * Get or create the singleton KqlQueryService instance.
 * Call this from React components or hooks.
 */
export function getKqlQueryService(
  workloadClient: WorkloadClientAPI,
  config?: Partial<KqlServiceConfig>
): KqlQueryService {
  if (!_instance) {
    _instance = new KqlQueryService(workloadClient, config);
  }
  return _instance;
}

/**
 * Reset the singleton (useful for testing or when the
 * workload client changes).
 */
export function resetKqlQueryService(): void {
  _instance = null;
}
