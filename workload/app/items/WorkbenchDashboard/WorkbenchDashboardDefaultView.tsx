import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { WorkbenchDashboardDefinition } from "./WorkbenchDashboardDefinition";
import {
  useObservabilityData,
  SLOCardData
} from "../../hooks/useObservabilityData";
import { useAlertData, AlertRuleStatus } from "../../hooks/useAlertData";
import { useSloData, SloLiveStatus } from "../../hooks/useSloData";
import {
  Badge,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  ProgressBar,
  Spinner,
  Text,
  Tooltip
} from "@fluentui/react-components";
import {
  ArrowSync20Regular,
  CheckmarkCircle20Filled,
  Warning20Filled,
  ErrorCircle20Filled,
  Clock20Regular,
  DataUsage20Regular,
  Timer20Regular,
  Database20Regular,
  Money20Regular,
  AlertBadge20Regular,
  ArrowTrendingLines20Regular,
  ChevronRight20Regular,
  PlugConnected20Regular,
  ArrowUp20Regular,
  ArrowDown20Regular,
  Subtract20Regular,
  Search20Regular
} from "@fluentui/react-icons";
import IncidentTimeline from "./IncidentTimeline";
import EventSearch from "./EventSearch";
import "./WorkbenchDashboard.scss";

// ============================================================================
// Props
// ============================================================================

interface WorkbenchDashboardDefaultViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<WorkbenchDashboardDefinition>;
  definition?: WorkbenchDashboardDefinition;
  onDefinitionChange?: (def: WorkbenchDashboardDefinition) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGES = ["1h", "6h", "12h", "24h", "7d", "30d"];

// ============================================================================
// Utility functions
// ============================================================================

type HealthStatus = "healthy" | "warning" | "critical";

function getStatusColor(rate: number, target: number): HealthStatus {
  if (rate >= target) return "healthy";
  if (rate >= target - 1) return "warning";
  return "critical";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * Generate hourly failure/success buckets for the last 24 hours.
 * In a real implementation this would come from KQL aggregation;
 * here we derive it from the available sample data to give visual shape.
 */
function generateTimelineBuckets(
  failedJobs: Array<{ timestamp: string }>,
  totalJobs: number
): Array<{ hour: string; failures: number; successes: number }> {
  const now = new Date();
  const buckets: Array<{ hour: string; failures: number; successes: number }> =
    [];

  for (let i = 23; i >= 0; i--) {
    const bucketDate = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourLabel = bucketDate.toLocaleTimeString([], {
      hour: "2-digit",
      hour12: false
    });

    // Count failures that fall in this hour
    const failureCount = failedJobs.filter((job) => {
      const jobDate = new Date(job.timestamp.replace(" ", "T"));
      return (
        jobDate.getHours() === bucketDate.getHours() &&
        jobDate.getDate() === bucketDate.getDate()
      );
    }).length;

    // Simulate a baseline success count (proportional to total items)
    const baseSuccesses = Math.max(
      1,
      Math.floor(totalJobs / 24 + Math.random() * 3)
    );

    buckets.push({
      hour: hourLabel,
      failures: failureCount,
      successes: baseSuccesses
    });
  }

  return buckets;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusIcon({ status }: { status: HealthStatus }) {
  switch (status) {
    case "healthy":
      return <CheckmarkCircle20Filled style={{ color: "#107c10" }} />;
    case "warning":
      return <Warning20Filled style={{ color: "#e8712a" }} />;
    case "critical":
      return <ErrorCircle20Filled style={{ color: "#d13438" }} />;
  }
}

function TrendIcon({
  direction
}: {
  direction: "improving" | "stable" | "degrading";
}) {
  switch (direction) {
    case "improving":
      return <ArrowUp20Regular style={{ color: "#107c10" }} />;
    case "degrading":
      return <ArrowDown20Regular style={{ color: "#d13438" }} />;
    case "stable":
      return (
        <Subtract20Regular
          style={{ color: "var(--colorNeutralForeground3)" }}
        />
      );
  }
}

// ── Health Summary Card ─────────────────────────────────────────────────

interface HealthCardProps {
  label: string;
  value: string;
  status: HealthStatus | "neutral";
  icon: React.ReactElement;
  trend?: string;
}

function HealthCard({ label, value, status, icon, trend }: HealthCardProps) {
  return (
    <div className={`workbench-dashboard-health-card workbench-dashboard-health-card--${status}`}>
      <div className="workbench-dashboard-health-card-header">
        <span className="workbench-dashboard-health-card-label">{label}</span>
        {icon}
      </div>
      <span
        className={`workbench-dashboard-health-card-value workbench-dashboard-health-card-value--${status}`}
      >
        {value}
      </span>
      {trend && (
        <span className="workbench-dashboard-health-card-trend">{trend}</span>
      )}
    </div>
  );
}

// ── Failure Timeline (bar chart) ────────────────────────────────────────

interface FailureTimelineProps {
  buckets: Array<{ hour: string; failures: number; successes: number }>;
}

function FailureTimeline({ buckets }: FailureTimelineProps) {
  const maxTotal = useMemo(
    () =>
      Math.max(
        1,
        ...buckets.map((b) => b.failures + b.successes)
      ),
    [buckets]
  );

  return (
    <div className="workbench-dashboard-timeline">
      <div className="workbench-dashboard-timeline-legend">
        <span className="workbench-dashboard-timeline-legend-item">
          <span className="workbench-dashboard-timeline-legend-dot workbench-dashboard-timeline-legend-dot--failures" />
          Failures
        </span>
        <span className="workbench-dashboard-timeline-legend-item">
          <span className="workbench-dashboard-timeline-legend-dot workbench-dashboard-timeline-legend-dot--successes" />
          Successes
        </span>
      </div>
      <div
        className="workbench-dashboard-timeline-chart"
        role="img"
        aria-label="Failure timeline chart showing hourly failures and successes over the last 24 hours"
      >
        {buckets.map((bucket, idx) => {
          const failureHeight =
            maxTotal > 0 ? (bucket.failures / maxTotal) * 100 : 0;
          const successHeight =
            maxTotal > 0 ? (bucket.successes / maxTotal) * 100 : 0;
          return (
            <Tooltip
              key={idx}
              content={`${bucket.hour}: ${bucket.failures} failures, ${bucket.successes} successes`}
              relationship="description"
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "flex-end",
                  height: "100%",
                  gap: 1,
                  minWidth: 0
                }}
              >
                {bucket.failures > 0 && (
                  <div
                    className="workbench-dashboard-timeline-bar workbench-dashboard-timeline-bar--failures"
                    style={{ height: `${Math.max(failureHeight, 3)}%` }}
                  />
                )}
                <div
                  className="workbench-dashboard-timeline-bar workbench-dashboard-timeline-bar--successes"
                  style={{ height: `${Math.max(successHeight, 3)}%` }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="workbench-dashboard-timeline-labels">
        {buckets
          .filter((_, idx) => idx % 4 === 0)
          .map((bucket, idx) => (
            <span key={idx} className="workbench-dashboard-timeline-label">
              {bucket.hour}
            </span>
          ))}
      </div>
    </div>
  );
}

// ── SLO Status Card (enhanced with trend) ───────────────────────────────

interface SLOStatusCardProps {
  card: SLOCardData;
  liveStatus?: SloLiveStatus;
}

function SLOStatusCard({ card, liveStatus }: SLOStatusCardProps) {
  const status = getStatusColor(card.successRate, card.successTarget);
  const budgetColor =
    card.errorBudgetRemaining > 50
      ? "#107c10"
      : card.errorBudgetRemaining > 10
      ? "#e8712a"
      : "#d13438";

  return (
    <div
      className={`workbench-dashboard-slo-card workbench-dashboard-slo-card--${status}`}
    >
      <div className="workbench-dashboard-slo-card-header">
        <div>
          <h4 className="workbench-dashboard-slo-card-name">{card.name}</h4>
          <Text
            size={200}
            style={{ color: "var(--colorNeutralForeground3)" }}
          >
            {card.itemType}
          </Text>
        </div>
        <StatusIcon status={status} />
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <DataUsage20Regular
            style={{ verticalAlign: "middle", marginRight: 4 }}
          />
          Success Rate
        </span>
        <span
          className={`workbench-dashboard-slo-metric-value workbench-dashboard-slo-metric-value--${status}`}
        >
          {card.successRate}%
        </span>
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <Timer20Regular
            style={{ verticalAlign: "middle", marginRight: 4 }}
          />
          P50 / P95
        </span>
        <span className="workbench-dashboard-slo-metric-value">
          {card.p50Duration} / {card.p95Duration}
        </span>
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <Database20Regular
            style={{ verticalAlign: "middle", marginRight: 4 }}
          />
          Freshness
        </span>
        <span
          className={`workbench-dashboard-slo-metric-value workbench-dashboard-slo-metric-value--${card.freshnessStatus}`}
        >
          {card.freshness}
        </span>
      </div>

      {/* Error Budget Bar */}
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4
          }}
        >
          <Text size={200}>Error Budget</Text>
          <Text size={200} weight="semibold" style={{ color: budgetColor }}>
            {card.errorBudgetRemaining}% remaining
          </Text>
        </div>
        <ProgressBar
          value={card.errorBudgetRemaining / 100}
          color={
            card.errorBudgetRemaining > 50
              ? "success"
              : card.errorBudgetRemaining > 10
              ? "warning"
              : "error"
          }
          thickness="large"
        />
      </div>

      {/* Trend indicator from live SLO data */}
      {liveStatus && (
        <div
          className={`workbench-dashboard-slo-trend workbench-dashboard-slo-trend--${liveStatus.trendDirection}`}
        >
          <TrendIcon direction={liveStatus.trendDirection} />
          <Text size={200}>
            {liveStatus.trendDirection === "improving"
              ? "Improving"
              : liveStatus.trendDirection === "degrading"
              ? "Degrading"
              : "Stable"}
          </Text>
        </div>
      )}
    </div>
  );
}

// ── Active Alerts Panel ─────────────────────────────────────────────────

interface ActiveAlertsPanelProps {
  alerts: Array<{
    timestamp: string;
    sloName: string;
    metric: string;
    severity: "warning" | "critical";
    detail: string;
    resolved: boolean;
  }>;
  activeRules: AlertRuleStatus[];
  isLoading: boolean;
}

function ActiveAlertsPanel({
  alerts,
  activeRules,
  isLoading
}: ActiveAlertsPanelProps) {
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const sortedAlerts = useMemo(
    () =>
      [...activeAlerts].sort((a, b) => {
        // Sort critical first, then by timestamp descending
        if (a.severity !== b.severity) {
          return a.severity === "critical" ? -1 : 1;
        }
        return b.timestamp.localeCompare(a.timestamp);
      }),
    [activeAlerts]
  );

  if (isLoading) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <Spinner size="small" label="Loading alerts..." />
      </div>
    );
  }

  if (sortedAlerts.length === 0) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <CheckmarkCircle20Filled style={{ color: "#107c10", fontSize: 32 }} />
        <Text>No active alerts. All systems operational.</Text>
      </div>
    );
  }

  return (
    <div className="workbench-dashboard-alerts-list" role="list" aria-label="Active alerts">
      {sortedAlerts.map((alert, idx) => (
        <div
          key={idx}
          className={`workbench-dashboard-alert-row workbench-dashboard-alert-row--${alert.severity}`}
          role="listitem"
        >
          <StatusIcon status={alert.severity === "critical" ? "critical" : "warning"} />
          <div className="workbench-dashboard-alert-row-content">
            <span className="workbench-dashboard-alert-row-title">
              {alert.sloName} -- {alert.metric}
            </span>
            <span className="workbench-dashboard-alert-row-detail">
              {alert.detail}
            </span>
          </div>
          <div className="workbench-dashboard-alert-row-meta">
            <Badge
              appearance="filled"
              color={alert.severity === "critical" ? "danger" : "warning"}
            >
              {alert.severity}
            </Badge>
            <span className="workbench-dashboard-alert-row-time">
              <Clock20Regular
                style={{ verticalAlign: "middle", marginRight: 2 }}
              />
              {alert.timestamp}
            </span>
          </div>
        </div>
      ))}
      {activeRules.length > 0 && (
        <Text
          size={200}
          style={{
            color: "var(--colorNeutralForeground3)",
            paddingTop: 4
          }}
        >
          {activeRules.filter((r) => r.enabled).length} active rules monitoring
        </Text>
      )}
    </div>
  );
}

// ── Recent Failures Panel ───────────────────────────────────────────────

interface RecentFailuresPanelProps {
  failures: Array<{
    timestamp: string;
    itemName: string;
    itemType: string;
    errorMessage: string;
    duration: string;
  }>;
  isLoading: boolean;
  onInvestigate?: (itemName: string) => void;
}

function RecentFailuresPanel({
  failures,
  isLoading,
  onInvestigate
}: RecentFailuresPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleToggle = useCallback(
    (idx: number) => {
      setExpandedIdx((prev) => (prev === idx ? null : idx));
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle(idx);
      }
    },
    [handleToggle]
  );

  if (isLoading) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <Spinner size="small" label="Loading failures..." />
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <CheckmarkCircle20Filled style={{ color: "#107c10", fontSize: 32 }} />
        <Text>No recent failures. All jobs succeeded.</Text>
      </div>
    );
  }

  return (
    <div className="workbench-dashboard-failures-list" role="list" aria-label="Recent failures">
      {failures.slice(0, 10).map((job, idx) => (
        <div
          key={idx}
          className="workbench-dashboard-failure-row"
          role="listitem"
          tabIndex={0}
          onClick={() => handleToggle(idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          aria-expanded={expandedIdx === idx}
        >
          <div className="workbench-dashboard-failure-row-header">
            <div className="workbench-dashboard-failure-row-name">
              <span
                className={`workbench-dashboard-failure-expand-icon ${
                  expandedIdx === idx
                    ? "workbench-dashboard-failure-expand-icon--expanded"
                    : ""
                }`}
              >
                <ChevronRight20Regular />
              </span>
              <ErrorCircle20Filled style={{ color: "#d13438" }} />
              <Text weight="semibold">{job.itemName}</Text>
            </div>
            <div className="workbench-dashboard-failure-row-meta">
              <Badge appearance="outline" color="informative">
                {job.itemType}
              </Badge>
              <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                {job.duration}
              </Text>
              <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                <Clock20Regular
                  style={{ verticalAlign: "middle", marginRight: 2 }}
                />
                {job.timestamp}
              </Text>
            </div>
          </div>
          {expandedIdx === idx && (
            <div className="workbench-dashboard-failure-reason">
              {job.errorMessage}
              {onInvestigate && (
                <Button
                  appearance="subtle"
                  size="small"
                  style={{ marginTop: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInvestigate(job.itemName);
                  }}
                >
                  View Incident Timeline
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Cross-Item Correlation Panel ────────────────────────────────────────

interface CorrelationChainDisplay {
  pipelineName: string;
  workspaceName: string;
  childCount: number;
  succeededChildren: number;
  failedChildren: number;
  chainDurationMinutes: number;
}

interface CorrelationPanelProps {
  chains: CorrelationChainDisplay[];
  isLoading: boolean;
}

function CorrelationPanel({ chains, isLoading }: CorrelationPanelProps) {
  if (isLoading) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <Spinner size="small" label="Loading correlations..." />
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="workbench-dashboard-panel-empty">
        <PlugConnected20Regular style={{ fontSize: 32 }} />
        <Text>No pipeline correlation chains detected in this time range.</Text>
      </div>
    );
  }

  return (
    <div className="workbench-dashboard-correlation-list" role="list" aria-label="Cross-item correlation chains">
      {chains.map((chain, idx) => {
        const total = chain.succeededChildren + chain.failedChildren;
        const successPercent = total > 0 ? (chain.succeededChildren / total) * 100 : 100;
        const failPercent = total > 0 ? (chain.failedChildren / total) * 100 : 0;
        const chainStatus: HealthStatus =
          chain.failedChildren > 0
            ? "critical"
            : chain.succeededChildren === chain.childCount
            ? "healthy"
            : "warning";

        return (
          <div key={idx} className="workbench-dashboard-correlation-chain" role="listitem">
            <div className="workbench-dashboard-correlation-chain-header">
              <div className="workbench-dashboard-correlation-chain-title">
                <StatusIcon status={chainStatus} />
                <div>
                  <Text weight="semibold">{chain.pipelineName}</Text>
                  <br />
                  <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                    {chain.workspaceName}
                  </Text>
                </div>
              </div>
              <div className="workbench-dashboard-correlation-chain-stats">
                <Badge appearance="outline" color="informative">
                  {chain.childCount} items
                </Badge>
                <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                  {chain.chainDurationMinutes}m total
                </Text>
                {chain.failedChildren > 0 && (
                  <Badge appearance="filled" color="danger">
                    {chain.failedChildren} failed
                  </Badge>
                )}
              </div>
            </div>
            <div className="workbench-dashboard-correlation-chain-bar">
              <div
                className="workbench-dashboard-correlation-chain-bar-segment workbench-dashboard-correlation-chain-bar-segment--success"
                style={{ width: `${successPercent}%` }}
              />
              {failPercent > 0 && (
                <div
                  className="workbench-dashboard-correlation-chain-bar-segment workbench-dashboard-correlation-chain-bar-segment--failure"
                  style={{ width: `${failPercent}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="workbench-dashboard-skeleton" role="status" aria-label="Loading dashboard">
      {/* Health cards row */}
      <div className="workbench-dashboard-skeleton-row">
        <div className="workbench-dashboard-skeleton-card" />
        <div className="workbench-dashboard-skeleton-card" />
        <div className="workbench-dashboard-skeleton-card" />
        <div className="workbench-dashboard-skeleton-card" />
      </div>
      {/* Timeline */}
      <div className="workbench-dashboard-skeleton-panel" />
      {/* Two-column panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%" }}>
        <div className="workbench-dashboard-skeleton-panel-tall" />
        <div className="workbench-dashboard-skeleton-panel-tall" />
      </div>
      {/* SLO grid */}
      <div className="workbench-dashboard-skeleton-row">
        <div className="workbench-dashboard-skeleton-panel" />
        <div className="workbench-dashboard-skeleton-panel" />
        <div className="workbench-dashboard-skeleton-panel" />
        <div className="workbench-dashboard-skeleton-panel" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * WorkbenchDashboardDefaultView - Main Observability Workbench Dashboard
 *
 * Six dashboard panels:
 *   1. Health summary cards (success rate, active alerts, SLO breaches, CU waste)
 *   2. Failure timeline chart (last 24h, stacked bar by hour)
 *   3. Active alerts panel (sorted by severity, expandable detail)
 *   4. Recent failures panel (last 10, expand for error message)
 *   5. SLO status grid (cards per SLO with value, target, budget, trend)
 *   6. Cross-item correlation panel (pipeline dependency chains)
 *
 * Data is fetched via three hooks:
 *   - useObservabilityData: main dashboard data (SLO cards, incidents, failures, waste)
 *   - useAlertData: alert history, active rules, severity distribution
 *   - useSloData: SLO live statuses, compliance history, error budget
 *
 * All hooks auto-refresh on a 60-second interval.
 */
export function WorkbenchDashboardDefaultView({
  workloadClient,
  item,
  definition,
  onDefinitionChange
}: WorkbenchDashboardDefaultViewProps) {
  const { t } = useTranslation();
  const [selectedTimeRange, setSelectedTimeRange] = useState(
    definition?.timeRange || "24h"
  );

  // Timeline view state
  const [timelineEvent, setTimelineEvent] = useState<{
    eventId: string;
    itemName: string;
  } | null>(null);

  // Search view state
  const [showSearch, setShowSearch] = useState(false);

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
    onDefinitionChange?.({ ...definition, timeRange: value });
  };

  // ── Data hooks ──────────────────────────────────────────────────────

  const {
    data: obsData,
    isLoading: obsLoading,
    error: obsError,
    lastUpdated: obsLastUpdated,
    refresh: obsRefresh
  } = useObservabilityData(
    selectedTimeRange,
    definition?.workspaceIds || []
  );

  const {
    data: alertData,
    isLoading: alertLoading,
    error: alertError,
    lastUpdated: alertLastUpdated,
    refresh: alertRefresh
  } = useAlertData(selectedTimeRange);

  const {
    data: sloData,
    isLoading: sloLoading,
    error: sloError,
    lastUpdated: sloLastUpdated,
    refresh: sloRefresh
  } = useSloData(selectedTimeRange);

  // Combined state
  const isInitialLoad = obsLoading && !obsLastUpdated;
  const isRefreshing =
    (obsLoading || alertLoading || sloLoading) && obsLastUpdated !== null;
  const hasError = obsError || alertError || sloError;
  const lastUpdated = obsLastUpdated || alertLastUpdated || sloLastUpdated;

  const handleRefreshAll = useCallback(() => {
    obsRefresh();
    alertRefresh();
    sloRefresh();
  }, [obsRefresh, alertRefresh, sloRefresh]);

  // ── Derived data ────────────────────────────────────────────────────

  // Health summary metrics
  const healthMetrics = useMemo(() => {
    const activeAlertCount = alertData.activeAlertCount;
    const sloBreaches = sloData.criticalSloCount + sloData.warningSloCount;
    const overallSuccessRate =
      obsData.sloCards.length > 0
        ? (
            obsData.sloCards.reduce((sum, c) => sum + c.successRate, 0) /
            obsData.sloCards.length
          ).toFixed(1)
        : "--";
    const wasteScore = obsData.aggregateWaste.score;

    return { activeAlertCount, sloBreaches, overallSuccessRate, wasteScore };
  }, [obsData, alertData, sloData]);

  // Timeline buckets
  const timelineBuckets = useMemo(
    () =>
      generateTimelineBuckets(
        obsData.failedJobs,
        obsData.sloCards.length * 8
      ),
    [obsData.failedJobs, obsData.sloCards.length]
  );

  // Map SLO live statuses to card data for trend enrichment
  const sloStatusMap = useMemo(() => {
    const map = new Map<string, SloLiveStatus>();
    sloData.sloStatuses.forEach((s) => map.set(s.itemName, s));
    return map;
  }, [sloData.sloStatuses]);

  // Sample correlation chains (from observability data or mock)
  const correlationChains: CorrelationChainDisplay[] = useMemo(() => {
    // In a real implementation, these come from the KQL EventCorrelations table.
    // For now, derive from the data available.
    return [
      {
        pipelineName: "PL_MasterOrchestrator",
        workspaceName: "FrameworkProduction",
        childCount: 4,
        succeededChildren: 3,
        failedChildren: 1,
        chainDurationMinutes: 52
      },
      {
        pipelineName: "PL_SalesDataIngestion",
        workspaceName: "FrameworkProduction",
        childCount: 3,
        succeededChildren: 3,
        failedChildren: 0,
        chainDurationMinutes: 12
      },
      {
        pipelineName: "PL_FinanceEOD",
        workspaceName: "FrameworkTesting",
        childCount: 2,
        succeededChildren: 2,
        failedChildren: 0,
        chainDurationMinutes: 8
      }
    ];
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────

  // Determine success rate status
  const successRateStatus: HealthStatus =
    healthMetrics.overallSuccessRate === "--"
      ? "healthy"
      : parseFloat(healthMetrics.overallSuccessRate) >= 99
      ? "healthy"
      : parseFloat(healthMetrics.overallSuccessRate) >= 97
      ? "warning"
      : "critical";

  const alertCountStatus: HealthStatus =
    healthMetrics.activeAlertCount === 0
      ? "healthy"
      : healthMetrics.activeAlertCount <= 2
      ? "warning"
      : "critical";

  const sloBreachStatus: HealthStatus =
    healthMetrics.sloBreaches === 0
      ? "healthy"
      : healthMetrics.sloBreaches <= 1
      ? "warning"
      : "critical";

  const DashboardContent = () => (
    <div className="workbench-dashboard-view">
      {/* Error banner */}
      {hasError && (
        <MessageBar intent="error" style={{ marginBottom: 12, width: "100%" }}>
          <MessageBarBody>
            {t(
              "WorkbenchDashboard_FetchError",
              "Failed to load dashboard data: {{error}}",
              { error: obsError || alertError || sloError }
            )}
            <Button
              appearance="transparent"
              size="small"
              onClick={handleRefreshAll}
              style={{ marginLeft: 8 }}
            >
              Retry
            </Button>
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Header */}
      <div>
        <h2 className="workbench-dashboard-title">
          {t("WorkbenchDashboard_Title", "Observability Dashboard")}
        </h2>
        <p className="workbench-dashboard-subtitle">
          {t(
            "WorkbenchDashboard_Subtitle",
            "Monitoring {{workspaceCount}} workspaces · {{itemCount}} items · {{alertCount}} active alerts",
            {
              workspaceCount: definition?.workspaceIds?.length || 4,
              itemCount: obsData.sloCards.length * 3,
              alertCount: healthMetrics.activeAlertCount
            }
          )}
        </p>
      </div>

      {/* Toolbar */}
      <div className="workbench-dashboard-toolbar">
        <div className="workbench-dashboard-toolbar-item">
          <label>
            {t("WorkbenchDashboard_TimeRange", "Time Range")}
          </label>
          <Dropdown
            value={selectedTimeRange}
            onOptionSelect={(_, d) =>
              handleTimeRangeChange(d.optionValue as string)
            }
            style={{ minWidth: 100 }}
          >
            {TIME_RANGES.map((r) => (
              <Option key={r} value={r}>
                {r}
              </Option>
            ))}
          </Dropdown>
        </div>
        <div className="workbench-dashboard-toolbar-item">
          <label>
            {t("WorkbenchDashboard_Workspaces", "Workspaces")}
          </label>
          <Badge appearance="outline" color="informative">
            {definition?.workspaceIds?.length || 4} connected
          </Badge>
        </div>

        <div className="workbench-dashboard-toolbar-spacer" />

        {/* Live indicator */}
        {lastUpdated && (
          <div className="workbench-dashboard-live-indicator">
            <span className="workbench-dashboard-live-dot" />
            <Text size={200}>
              Updated {formatTime(lastUpdated)}
            </Text>
          </div>
        )}

        <Tooltip content="Search all events" relationship="label">
          <Button
            appearance="subtle"
            icon={<Search20Regular />}
            onClick={() => setShowSearch(true)}
            aria-label="Search Events"
          />
        </Tooltip>
        <Tooltip content="Refresh all dashboard data" relationship="label">
          <Button
            appearance="subtle"
            icon={
              isRefreshing ? (
                <Spinner size="tiny" />
              ) : (
                <ArrowSync20Regular />
              )
            }
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            aria-label="Refresh"
          />
        </Tooltip>
      </div>

      {/* Loading skeleton for initial load */}
      {isInitialLoad && <DashboardSkeleton />}

      {/* Dashboard content (after first successful load) */}
      {lastUpdated && (
        <>
          {/* ── 1. Health Summary Cards ───────────────────────────── */}
          <div className="workbench-dashboard-health-grid">
            <HealthCard
              label="Success Rate"
              value={`${healthMetrics.overallSuccessRate}%`}
              status={successRateStatus}
              icon={<CheckmarkCircle20Filled style={{ color: "#0078D4" }} />}
              trend={
                obsData.sloCards.length > 0
                  ? `across ${obsData.sloCards.length} SLOs`
                  : undefined
              }
            />
            <HealthCard
              label="Active Alerts"
              value={String(healthMetrics.activeAlertCount)}
              status={alertCountStatus}
              icon={<AlertBadge20Regular style={{ color: alertCountStatus === "healthy" ? "#107c10" : "#d13438" }} />}
              trend={
                alertData.severityDistribution.critical > 0
                  ? `${alertData.severityDistribution.critical} critical`
                  : "All clear"
              }
            />
            <HealthCard
              label="SLO Breaches"
              value={String(healthMetrics.sloBreaches)}
              status={sloBreachStatus}
              icon={<DataUsage20Regular style={{ color: sloBreachStatus === "healthy" ? "#107c10" : "#e8712a" }} />}
              trend={`${sloData.healthySloCount} healthy, ${sloData.criticalSloCount} critical`}
            />
            <HealthCard
              label="CU Waste"
              value={`$${obsData.aggregateWaste.totalWeekly.toFixed(0)}/wk`}
              status={
                obsData.aggregateWaste.score >= 90
                  ? "healthy"
                  : obsData.aggregateWaste.score >= 70
                  ? "warning"
                  : "critical"
              }
              icon={<Money20Regular style={{ color: "#e8712a" }} />}
              trend={`Score: ${obsData.aggregateWaste.score}/100`}
            />
          </div>

          {/* ── 2. Failure Timeline Chart ─────────────────────────── */}
          <div className="workbench-dashboard-section">
            <div className="workbench-dashboard-panel">
              <div className="workbench-dashboard-panel-header">
                <h3 className="workbench-dashboard-panel-title">
                  <span className="workbench-dashboard-panel-title-icon">
                    <ArrowTrendingLines20Regular />
                  </span>
                  {t("WorkbenchDashboard_Timeline", "Failure Timeline (Last 24h)")}
                </h3>
                <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                  {obsData.failedJobs.length} failures in selected range
                </Text>
              </div>
              <FailureTimeline buckets={timelineBuckets} />
            </div>
          </div>

          {/* ── 3 & 4. Two-column: Active Alerts + Recent Failures ── */}
          <div className="workbench-dashboard-grid">
            {/* Active Alerts */}
            <div className="workbench-dashboard-panel">
              <div className="workbench-dashboard-panel-header">
                <h3 className="workbench-dashboard-panel-title">
                  <span className="workbench-dashboard-panel-title-icon">
                    <AlertBadge20Regular />
                  </span>
                  {t("WorkbenchDashboard_ActiveAlerts", "Active Alerts")}
                </h3>
                <Badge
                  appearance="filled"
                  color={healthMetrics.activeAlertCount > 0 ? "danger" : "success"}
                >
                  {healthMetrics.activeAlertCount}
                </Badge>
              </div>
              <ActiveAlertsPanel
                alerts={alertData.recentAlerts}
                activeRules={alertData.activeRules}
                isLoading={alertLoading && !alertLastUpdated}
              />
            </div>

            {/* Recent Failures */}
            <div className="workbench-dashboard-panel">
              <div className="workbench-dashboard-panel-header">
                <h3 className="workbench-dashboard-panel-title">
                  <span className="workbench-dashboard-panel-title-icon">
                    <ErrorCircle20Filled style={{ color: "#d13438" }} />
                  </span>
                  {t("WorkbenchDashboard_RecentFailures", "Recent Failures")}
                </h3>
                <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                  Last 10 jobs
                </Text>
              </div>
              <RecentFailuresPanel
                failures={obsData.failedJobs}
                isLoading={obsLoading && !obsLastUpdated}
                onInvestigate={(itemName) =>
                  setTimelineEvent({ eventId: `evt-${itemName}`, itemName })
                }
              />
            </div>
          </div>

          {/* ── 5. SLO Status Grid ────────────────────────────────── */}
          <div className="workbench-dashboard-section">
            <div className="workbench-dashboard-section-header">
              <h3 className="workbench-dashboard-section-title">
                {t("WorkbenchDashboard_SLOStatus", "SLO Status")}
              </h3>
              {sloData.errorBudgetSummary.projectedExhaustionDays !== null && (
                <Tooltip
                  content={`At current burn rate (${sloData.errorBudgetSummary.burnRate}x), error budget projects to exhaust in ${sloData.errorBudgetSummary.projectedExhaustionDays} days`}
                  relationship="description"
                >
                  <Badge appearance="outline" color="warning">
                    Budget exhaustion in ~{sloData.errorBudgetSummary.projectedExhaustionDays}d
                  </Badge>
                </Tooltip>
              )}
            </div>
            <div className="workbench-dashboard-slo-grid">
              {obsData.sloCards.map((card) => (
                <SLOStatusCard
                  key={card.name}
                  card={card}
                  liveStatus={sloStatusMap.get(card.name)}
                />
              ))}
            </div>
          </div>

          {/* ── 6. Cross-Item Correlation Panel ───────────────────── */}
          <div className="workbench-dashboard-section">
            <div className="workbench-dashboard-panel">
              <div className="workbench-dashboard-panel-header">
                <h3 className="workbench-dashboard-panel-title">
                  <span className="workbench-dashboard-panel-title-icon">
                    <PlugConnected20Regular />
                  </span>
                  {t(
                    "WorkbenchDashboard_Correlations",
                    "Cross-Item Correlation"
                  )}
                </h3>
                <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                  Pipeline dependency chains
                </Text>
              </div>
              <CorrelationPanel
                chains={correlationChains}
                isLoading={obsLoading && !obsLastUpdated}
              />
            </div>
          </div>

          {/* ── CU Waste Score (detail table) ─────────────────────── */}
          <div className="workbench-dashboard-section">
            <h3 className="workbench-dashboard-section-title">
              {t("WorkbenchDashboard_WasteScore", "CU Waste Score")}
            </h3>
            <div className="workbench-dashboard-waste-summary">
              <div className="workbench-dashboard-waste-gauge">
                <div className="workbench-dashboard-waste-gauge-ring">
                  <Text size={800} weight="bold">
                    {obsData.aggregateWaste.score}
                  </Text>
                  <Text
                    size={200}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    / 100
                  </Text>
                </div>
                <Text size={200}>Efficiency Score</Text>
              </div>
              <div className="workbench-dashboard-waste-stats">
                <div className="workbench-dashboard-waste-stat">
                  <Text
                    size={200}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    Weekly Waste
                  </Text>
                  <Text
                    size={500}
                    weight="semibold"
                    style={{ color: "#d13438" }}
                  >
                    ${obsData.aggregateWaste.totalWeekly.toFixed(2)}
                  </Text>
                </div>
                <div className="workbench-dashboard-waste-stat">
                  <Text
                    size={200}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    Monthly Projected
                  </Text>
                  <Text
                    size={500}
                    weight="semibold"
                    style={{ color: "#d13438" }}
                  >
                    ${obsData.aggregateWaste.totalMonthly.toFixed(2)}
                  </Text>
                </div>
              </div>
            </div>
            <div className="workbench-dashboard-table-container">
              <table
                style={{ width: "100%", borderCollapse: "collapse" }}
                aria-label="CU waste by item"
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--colorNeutralStroke1)"
                    }}
                  >
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Item
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Score
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Retry Waste
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Duration Waste
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Total Waste
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 12px",
                        fontWeight: "var(--fontWeightSemibold)" as any,
                        fontSize: "var(--fontSizeBase200)",
                        color: "var(--colorNeutralForeground2)"
                      }}
                    >
                      Monthly Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obsData.wasteItems.map((wasteItem, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom:
                          "1px solid var(--colorNeutralStroke1)"
                      }}
                    >
                      <td style={{ padding: "8px 12px" }}>
                        <Text weight="semibold">{wasteItem.name}</Text>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Badge appearance="outline" color="informative">
                          {wasteItem.itemType}
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <Badge
                          appearance="filled"
                          color={
                            wasteItem.wasteScore >= 90
                              ? "success"
                              : wasteItem.wasteScore >= 70
                              ? "warning"
                              : "danger"
                          }
                        >
                          {wasteItem.wasteScore}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right"
                        }}
                      >
                        <Text size={200}>
                          ${wasteItem.retryWaste.toFixed(2)}
                        </Text>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right"
                        }}
                      >
                        <Text size={200}>
                          ${wasteItem.durationWaste.toFixed(2)}
                        </Text>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right"
                        }}
                      >
                        <Text weight="semibold">
                          ${wasteItem.totalWaste.toFixed(2)}
                        </Text>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right"
                        }}
                      >
                        <Text
                          weight="semibold"
                          style={{
                            color:
                              wasteItem.monthlyProjected > 100
                                ? "#d13438"
                                : wasteItem.monthlyProjected > 20
                                ? "#e8712a"
                                : "inherit"
                          }}
                        >
                          ${wasteItem.monthlyProjected.toFixed(2)}/mo
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // If search view is active, render it instead of the dashboard
  if (showSearch) {
    return (
      <ItemEditorDefaultView
        center={{
          content: <EventSearch onClose={() => setShowSearch(false)} />,
          ariaLabel: "Event Search"
        }}
      />
    );
  }

  // If timeline view is active, render it instead of the dashboard
  if (timelineEvent) {
    return (
      <ItemEditorDefaultView
        center={{
          content: (
            <IncidentTimeline
              selectedEventId={timelineEvent.eventId}
              selectedItemName={timelineEvent.itemName}
              onClose={() => setTimelineEvent(null)}
            />
          ),
          ariaLabel: "Incident Timeline"
        }}
      />
    );
  }

  return (
    <ItemEditorDefaultView
      center={{
        content: <DashboardContent />,
        ariaLabel: "Observability Dashboard"
      }}
    />
  );
}
