/**
 * useAlertData — React hook for AlertRule live data
 *
 * Fetches alert history, active rules, severity distribution, and
 * notification status from the KQL Eventhouse (EH_Observability).
 * Falls back to sample data when the KQL service is unavailable.
 *
 * Follows the same pattern as useObservabilityData (Sprint 03 B2).
 *
 * Sprint 03 — Task B3 (P0)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { IncidentRow, AlertSeverity } from "../types/observability";

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface AlertRuleStatus {
  ruleId: string;
  ruleName: string;
  sloName: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  lastTriggered: string | null;
  triggerCount: number;
}

export interface SeverityDistribution {
  critical: number;
  warning: number;
  total: number;
}

export interface NotificationStatus {
  sent: number;
  pending: number;
  failed: number;
  lastSentAt: string | null;
}

export interface AlertDataPayload {
  recentAlerts: IncidentRow[];
  activeRules: AlertRuleStatus[];
  severityDistribution: SeverityDistribution;
  notificationStatus: NotificationStatus;
  activeAlertCount: number;
  resolvedAlertCount: number;
}

export interface UseAlertDataResult {
  data: AlertDataPayload;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isLive: boolean;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Default (sample) data
// ---------------------------------------------------------------------------

const DEFAULT_RECENT_ALERTS: IncidentRow[] = [
  {
    timestamp: "2026-03-09 08:42",
    sloName: "Inventory Notebook",
    metric: "Success Rate",
    severity: "critical",
    detail: "Dropped to 95.2% (target: 99.0%)",
    resolved: false,
  },
  {
    timestamp: "2026-03-09 06:15",
    sloName: "Customer 360 Dataflow",
    metric: "Data Freshness",
    severity: "warning",
    detail: "Last refresh 2h 15m ago (target: 1h)",
    resolved: false,
  },
  {
    timestamp: "2026-03-08 22:10",
    sloName: "Sales Pipeline Daily",
    metric: "P95 Duration",
    severity: "warning",
    detail: "P95 exceeded 8m threshold",
    resolved: true,
  },
  {
    timestamp: "2026-03-08 18:05",
    sloName: "Finance Lakehouse Refresh",
    metric: "Success Rate",
    severity: "warning",
    detail: "Dropped to 99.2% (target: 99.5%)",
    resolved: true,
  },
  {
    timestamp: "2026-03-08 14:32",
    sloName: "Inventory Notebook",
    metric: "P95 Duration",
    severity: "critical",
    detail: "P95 reached 72m (threshold: 60m)",
    resolved: true,
  },
];

const DEFAULT_ACTIVE_RULES: AlertRuleStatus[] = [
  {
    ruleId: "rule-001",
    ruleName: "Sales Pipeline SLA",
    sloName: "Sales Pipeline Daily",
    condition: "success_rate_below",
    threshold: 99.5,
    enabled: true,
    lastTriggered: "2026-03-08 22:10",
    triggerCount: 3,
  },
  {
    ruleId: "rule-002",
    ruleName: "Customer 360 Freshness",
    sloName: "Customer 360 Dataflow",
    condition: "freshness_stale",
    threshold: 60,
    enabled: true,
    lastTriggered: "2026-03-09 06:15",
    triggerCount: 7,
  },
  {
    ruleId: "rule-003",
    ruleName: "Inventory OOM Guard",
    sloName: "Inventory Notebook",
    condition: "consecutive_failures",
    threshold: 3,
    enabled: true,
    lastTriggered: "2026-03-09 08:42",
    triggerCount: 12,
  },
  {
    ruleId: "rule-004",
    ruleName: "Finance Duration Regression",
    sloName: "Finance Lakehouse Refresh",
    condition: "p95_duration_above",
    threshold: 5,
    enabled: false,
    lastTriggered: null,
    triggerCount: 0,
  },
];

const DEFAULT_SEVERITY_DISTRIBUTION: SeverityDistribution = {
  critical: 2,
  warning: 3,
  total: 5,
};

const DEFAULT_NOTIFICATION_STATUS: NotificationStatus = {
  sent: 4,
  pending: 1,
  failed: 0,
  lastSentAt: "2026-03-09 08:42",
};

const DEFAULT_DATA: AlertDataPayload = {
  recentAlerts: DEFAULT_RECENT_ALERTS,
  activeRules: DEFAULT_ACTIVE_RULES,
  severityDistribution: DEFAULT_SEVERITY_DISTRIBUTION,
  notificationStatus: DEFAULT_NOTIFICATION_STATUS,
  activeAlertCount: 2,
  resolvedAlertCount: 3,
};

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

/**
 * Fetches alert data. Currently returns sample data.
 *
 * When the KQL query service is available, replace this with calls to
 * kqlQueryService.getAlertHistory() and supplemental queries for rule
 * status, severity distribution, and notification status.
 */
async function fetchAlertData(
  _timeRange: string,
  _ruleId?: string
): Promise<{ data: AlertDataPayload; isLive: boolean }> {
  // TODO: Replace with kqlQueryService calls:
  // const service = getKqlQueryService(workloadClient);
  // const alertHistory = await service.getAlertHistory(timeRange);
  // ...map into AlertDataPayload
  return { data: DEFAULT_DATA, isLive: false };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000;

/**
 * Custom hook that manages fetching alert data for the AlertRule item editor.
 * Provides loading/error states and auto-refreshes on a 60-second interval.
 *
 * @param timeRange - The currently selected time range filter (e.g. "24h").
 * @param ruleId    - Optional: scope data to a specific alert rule.
 */
export function useAlertData(
  timeRange: string = "24h",
  ruleId?: string
): UseAlertDataResult {
  const [data, setData] = useState<AlertDataPayload>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const paramsRef = useRef({ timeRange, ruleId });
  paramsRef.current = { timeRange, ruleId };

  const doFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAlertData(
        paramsRef.current.timeRange,
        paramsRef.current.ruleId
      );
      setData(result.data);
      setIsLive(result.isLive);
      setLastUpdated(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load alert data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and re-fetch when filters change
  useEffect(() => {
    doFetch();
  }, [timeRange, ruleId, doFetch]);

  // Auto-refresh polling
  useEffect(() => {
    const id = setInterval(() => {
      doFetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [doFetch]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    isLive,
    refresh: doFetch,
  };
}
