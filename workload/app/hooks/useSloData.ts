/**
 * useSloData — React hook for SLODefinition live data
 *
 * Fetches SLO definitions, snapshots, current values, and error budget
 * data from the KQL Eventhouse (EH_Observability).
 * Falls back to sample data when the KQL service is unavailable.
 *
 * Follows the same pattern as useObservabilityData (Sprint 03 B2).
 *
 * Sprint 03 — Task B4 (P0)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { HealthStatus } from "../types/observability";

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface SloLiveStatus {
  sloId: string;
  itemName: string;
  itemType: string;
  metricType: string;
  currentValue: number;
  targetValue: number;
  warningThreshold: number;
  errorBudgetRemaining: number;
  errorBudgetUsedPercent: number;
  status: HealthStatus;
  evaluationWindow: string;
  lastEvaluated: string;
  trendDirection: "improving" | "stable" | "degrading";
}

export interface SloSnapshotPoint {
  timestamp: string;
  value: number;
  isBreaching: boolean;
}

export interface SloComplianceHistory {
  sloId: string;
  itemName: string;
  snapshots: SloSnapshotPoint[];
  compliancePercent: number;
  totalEvaluations: number;
  breachCount: number;
}

export interface ErrorBudgetSummary {
  totalBudget: number;
  consumed: number;
  remaining: number;
  burnRate: number;
  projectedExhaustionDays: number | null;
}

export interface SloDataPayload {
  sloStatuses: SloLiveStatus[];
  complianceHistory: SloComplianceHistory[];
  errorBudgetSummary: ErrorBudgetSummary;
  healthySloCount: number;
  warningSloCount: number;
  criticalSloCount: number;
}

export interface UseSloDataResult {
  data: SloDataPayload;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isLive: boolean;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Default (sample) data
// ---------------------------------------------------------------------------

const DEFAULT_SLO_STATUSES: SloLiveStatus[] = [
  {
    sloId: "slo-001",
    itemName: "Sales Pipeline Daily",
    itemType: "Pipeline",
    metricType: "success_rate",
    currentValue: 99.7,
    targetValue: 99.5,
    warningThreshold: 99.0,
    errorBudgetRemaining: 82,
    errorBudgetUsedPercent: 18,
    status: "healthy",
    evaluationWindow: "7d",
    lastEvaluated: "2026-03-09 09:00",
    trendDirection: "stable",
  },
  {
    sloId: "slo-002",
    itemName: "Customer 360 Dataflow",
    itemType: "Dataflow",
    metricType: "data_freshness",
    currentValue: 98.1,
    targetValue: 99.0,
    warningThreshold: 98.5,
    errorBudgetRemaining: 12,
    errorBudgetUsedPercent: 88,
    status: "warning",
    evaluationWindow: "7d",
    lastEvaluated: "2026-03-09 09:00",
    trendDirection: "degrading",
  },
  {
    sloId: "slo-003",
    itemName: "Inventory Notebook",
    itemType: "Notebook",
    metricType: "success_rate",
    currentValue: 95.2,
    targetValue: 99.0,
    warningThreshold: 98.0,
    errorBudgetRemaining: 0,
    errorBudgetUsedPercent: 100,
    status: "critical",
    evaluationWindow: "7d",
    lastEvaluated: "2026-03-09 09:00",
    trendDirection: "degrading",
  },
  {
    sloId: "slo-004",
    itemName: "Finance Lakehouse Refresh",
    itemType: "Pipeline",
    metricType: "p95_duration",
    currentValue: 3.8,
    targetValue: 5.0,
    warningThreshold: 4.5,
    errorBudgetRemaining: 95,
    errorBudgetUsedPercent: 5,
    status: "healthy",
    evaluationWindow: "30d",
    lastEvaluated: "2026-03-09 09:00",
    trendDirection: "improving",
  },
];

const DEFAULT_COMPLIANCE_HISTORY: SloComplianceHistory[] = [
  {
    sloId: "slo-001",
    itemName: "Sales Pipeline Daily",
    snapshots: [
      { timestamp: "2026-03-03", value: 99.8, isBreaching: false },
      { timestamp: "2026-03-04", value: 99.6, isBreaching: false },
      { timestamp: "2026-03-05", value: 99.9, isBreaching: false },
      { timestamp: "2026-03-06", value: 99.7, isBreaching: false },
      { timestamp: "2026-03-07", value: 99.5, isBreaching: false },
      { timestamp: "2026-03-08", value: 99.8, isBreaching: false },
      { timestamp: "2026-03-09", value: 99.7, isBreaching: false },
    ],
    compliancePercent: 100,
    totalEvaluations: 168,
    breachCount: 0,
  },
  {
    sloId: "slo-003",
    itemName: "Inventory Notebook",
    snapshots: [
      { timestamp: "2026-03-03", value: 99.1, isBreaching: false },
      { timestamp: "2026-03-04", value: 98.4, isBreaching: false },
      { timestamp: "2026-03-05", value: 97.6, isBreaching: true },
      { timestamp: "2026-03-06", value: 96.8, isBreaching: true },
      { timestamp: "2026-03-07", value: 96.1, isBreaching: true },
      { timestamp: "2026-03-08", value: 95.5, isBreaching: true },
      { timestamp: "2026-03-09", value: 95.2, isBreaching: true },
    ],
    compliancePercent: 71.4,
    totalEvaluations: 168,
    breachCount: 48,
  },
];

const DEFAULT_ERROR_BUDGET_SUMMARY: ErrorBudgetSummary = {
  totalBudget: 100,
  consumed: 35.5,
  remaining: 64.5,
  burnRate: 1.2,
  projectedExhaustionDays: 18,
};

const DEFAULT_DATA: SloDataPayload = {
  sloStatuses: DEFAULT_SLO_STATUSES,
  complianceHistory: DEFAULT_COMPLIANCE_HISTORY,
  errorBudgetSummary: DEFAULT_ERROR_BUDGET_SUMMARY,
  healthySloCount: 2,
  warningSloCount: 1,
  criticalSloCount: 1,
};

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

/**
 * Fetches SLO data. Currently returns sample data.
 *
 * When the KQL query service is available, replace this with calls to
 * kqlQueryService.getSloStatus() and supplemental queries for compliance
 * history, snapshots, and error budget projections.
 */
async function fetchSloData(
  _timeRange: string,
  _itemId?: string
): Promise<{ data: SloDataPayload; isLive: boolean }> {
  // TODO: Replace with kqlQueryService calls:
  // const service = getKqlQueryService(workloadClient);
  // const sloStatus = await service.getSloStatus(timeRange);
  // ...map into SloDataPayload
  return { data: DEFAULT_DATA, isLive: false };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000;

/**
 * Custom hook that manages fetching SLO data for the SLODefinition item
 * editor. Provides loading/error states and auto-refreshes on a 60-second
 * interval.
 *
 * @param timeRange - The currently selected time range filter (e.g. "7d").
 * @param itemId    - Optional: scope data to a specific Fabric item.
 */
export function useSloData(
  timeRange: string = "7d",
  itemId?: string
): UseSloDataResult {
  const [data, setData] = useState<SloDataPayload>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const paramsRef = useRef({ timeRange, itemId });
  paramsRef.current = { timeRange, itemId };

  const doFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchSloData(
        paramsRef.current.timeRange,
        paramsRef.current.itemId
      );
      setData(result.data);
      setIsLive(result.isLive);
      setLastUpdated(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load SLO data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and re-fetch when filters change
  useEffect(() => {
    doFetch();
  }, [timeRange, itemId, doFetch]);

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
