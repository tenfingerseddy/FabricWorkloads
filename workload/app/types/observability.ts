/**
 * Observability Workbench — Domain Type Definitions
 *
 * Strongly typed interfaces that map 1:1 to the KQL table schemas in
 * EH_Observability and to the shapes consumed by the dashboard UI.
 *
 * Table sources:
 *   FabricEvents, SloDefinitions, SloSnapshots, AlertLog,
 *   EventCorrelations, WorkspaceInventory
 */

// ════════════════════════════════════════════════════════════════
// KQL Table Row Types (raw rows returned by queries)
// ════════════════════════════════════════════════════════════════

/** Raw row from the FabricEvents table */
export interface FabricEvent {
  EventId: string;
  WorkspaceId: string;
  WorkspaceName: string;
  ItemId: string;
  ItemName: string;
  ItemType: string;
  JobType: string;
  InvokeType: string;
  Status: string;
  FailureReason: string;
  RootActivityId: string;
  StartTimeUtc: string;
  EndTimeUtc: string;
  DurationSeconds: number;
  CorrelationGroup: string;
  IngestedAt: string;
}

/** Raw row from the SloDefinitions table */
export interface SloDefinition {
  SloId: string;
  WorkspaceId: string;
  ItemId: string;
  ItemName: string;
  MetricType: string;
  TargetValue: number;
  WarningThreshold: number;
  EvaluationWindow: string;
  CreatedAt: string;
  IsActive: boolean;
}

/** Raw row from the SloSnapshots table */
export interface SloSnapshot {
  SnapshotId: string;
  SloId: string;
  ItemId: string;
  MetricType: string;
  CurrentValue: number;
  TargetValue: number;
  IsBreaching: boolean;
  ErrorBudgetRemaining: number;
  ComputedAt: string;
}

/** Raw row from the AlertLog table */
export interface AlertLogEntry {
  AlertId: string;
  Kind: string;
  Severity: string;
  WorkspaceId: string;
  WorkspaceName: string;
  ItemId: string;
  ItemName: string;
  Message: string;
  Value: number;
  Threshold: number;
  NotificationSent: boolean;
  Timestamp: string;
}

/** Raw row from the EventCorrelations table */
export interface EventCorrelation {
  UpstreamEventId: string;
  DownstreamEventId: string;
  RelationshipType: string;
  ConfidenceScore: number;
  DetectedAt: string;
}

// ════════════════════════════════════════════════════════════════
// Dashboard View Models (shaped for the React UI components)
// ════════════════════════════════════════════════════════════════

/** Health status used throughout the dashboard */
export type HealthStatus = "healthy" | "warning" | "critical";

/** Alert/incident severity levels */
export type AlertSeverity = "warning" | "critical";

// ── SLO Card ────────────────────────────────────────────────────

/** SLO card rendered in the dashboard grid */
export interface SLOCardData {
  name: string;
  itemType: string;
  successRate: number;
  successTarget: number;
  p50Duration: string;
  p95Duration: string;
  freshness: string;
  freshnessStatus: HealthStatus;
  errorBudgetRemaining: number;
}

// ── Incident Row ────────────────────────────────────────────────

/** A single row in the incident timeline table */
export interface IncidentRow {
  timestamp: string;
  sloName: string;
  metric: string;
  severity: AlertSeverity;
  detail: string;
  resolved: boolean;
}

// ── Failed Job Row ──────────────────────────────────────────────

/** A single row in the failed jobs table */
export interface FailedJobRow {
  timestamp: string;
  itemName: string;
  itemType: string;
  errorMessage: string;
  duration: string;
}

// ── CU Waste Score ──────────────────────────────────────────────

/** Per-item waste breakdown */
export interface WasteItemData {
  name: string;
  itemType: string;
  wasteScore: number;
  retryWaste: number;
  durationWaste: number;
  totalWaste: number;
  monthlyProjected: number;
}

/** Aggregate waste metrics */
export interface AggregateWaste {
  score: number;
  totalMonthly: number;
  totalWeekly: number;
}

// ── Correlation Chain ───────────────────────────────────────────

/** A single upstream -> downstream correlation link */
export interface CorrelationLink {
  pipelineName: string;
  pipelineStatus: string;
  pipelineStart: string;
  childName: string;
  childType: string;
  childStatus: string;
  childStart: string;
  childDuration: number;
}

/** Aggregated chain summary for a pipeline run */
export interface CorrelationChain {
  pipelineName: string;
  workspaceName: string;
  childCount: number;
  succeededChildren: number;
  failedChildren: number;
  chainDurationMinutes: number;
}

// ── Workspace Overview ──────────────────────────────────────────

/** Per-workspace success rate summary */
export interface WorkspaceOverview {
  workspaceName: string;
  totalJobs: number;
  succeeded: number;
  failed: number;
  inProgress: number;
  cancelled: number;
  successRate: number;
}

// ════════════════════════════════════════════════════════════════
// Composite Response Types (returned by service functions)
// ════════════════════════════════════════════════════════════════

/** Full dashboard data envelope */
export interface DashboardData {
  sloCards: SLOCardData[];
  incidents: IncidentRow[];
  failedJobs: FailedJobRow[];
  wasteItems: WasteItemData[];
  aggregateWaste: AggregateWaste;
  workspaceOverviews: WorkspaceOverview[];
  lastRefreshed: string;
}

/** SLO status response */
export interface SloStatusResponse {
  cards: SLOCardData[];
  breachingCount: number;
  warningCount: number;
  healthyCount: number;
}

/** Alert history response */
export interface AlertHistoryResponse {
  alerts: IncidentRow[];
  activeCount: number;
  resolvedCount: number;
}

/** Correlation analysis response */
export interface CorrelationResponse {
  chains: CorrelationChain[];
  links: CorrelationLink[];
}

/** Waste score response */
export interface WasteScoreResponse {
  items: WasteItemData[];
  aggregate: AggregateWaste;
}

/** Failed jobs response */
export interface FailedJobsResponse {
  jobs: FailedJobRow[];
  totalCount: number;
}

// ════════════════════════════════════════════════════════════════
// KQL Query Infrastructure Types
// ════════════════════════════════════════════════════════════════

/** KQL query request body sent to the Kusto REST endpoint */
export interface KqlQueryRequest {
  db: string;
  csl: string;
  properties?: {
    Options?: Record<string, string | number | boolean>;
  };
}

/** A single column descriptor in a KQL response frame */
export interface KqlColumn {
  ColumnName: string;
  ColumnType: string;
  DataType: string;
}

/** KQL v2 response table frame */
export interface KqlResponseTable {
  FrameType: string;
  TableId: number;
  TableName: string;
  Columns: KqlColumn[];
  Rows: unknown[][];
}

/** Full KQL v2 REST response */
export interface KqlQueryResponse {
  Tables?: KqlResponseTable[];
  /** V2 progressive frames */
  frames?: KqlResponseTable[];
}

// ════════════════════════════════════════════════════════════════
// Service Configuration
// ════════════════════════════════════════════════════════════════

/** Configuration for the KQL query service */
export interface KqlServiceConfig {
  /** KQL query endpoint URL (e.g. https://trd-....kusto.fabric.microsoft.com) */
  queryEndpoint: string;
  /** Database name in the Eventhouse */
  database: string;
  /** Whether to fall back to sample data when KQL is unreachable */
  useFallbackData: boolean;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/** Time range selector values */
export type TimeRange = "1h" | "6h" | "12h" | "24h" | "7d" | "30d";

/** Maps a TimeRange to a KQL ago() expression */
export function timeRangeToKql(range: TimeRange): string {
  const mapping: Record<TimeRange, string> = {
    "1h": "1h",
    "6h": "6h",
    "12h": "12h",
    "24h": "24h",
    "7d": "7d",
    "30d": "30d"
  };
  return mapping[range];
}
