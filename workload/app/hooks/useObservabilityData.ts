import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Data interfaces -- shared with the dashboard component and future KQL service
// ---------------------------------------------------------------------------

export interface SLOCardData {
  name: string;
  itemType: string;
  successRate: number;
  successTarget: number;
  p50Duration: string;
  p95Duration: string;
  freshness: string;
  freshnessStatus: "healthy" | "warning" | "critical";
  errorBudgetRemaining: number;
}

export interface IncidentRow {
  timestamp: string;
  sloName: string;
  metric: string;
  severity: "warning" | "critical";
  detail: string;
  resolved: boolean;
}

export interface FailedJobRow {
  timestamp: string;
  itemName: string;
  itemType: string;
  errorMessage: string;
  duration: string;
}

export interface WasteItemData {
  name: string;
  itemType: string;
  wasteScore: number;
  retryWaste: number;
  durationWaste: number;
  totalWaste: number;
  monthlyProjected: number;
}

export interface AggregateWaste {
  score: number;
  totalMonthly: number;
  totalWeekly: number;
}

/** The full payload returned by a dashboard data fetch. */
export interface ObservabilityDashboardData {
  sloCards: SLOCardData[];
  incidents: IncidentRow[];
  failedJobs: FailedJobRow[];
  wasteItems: WasteItemData[];
  aggregateWaste: AggregateWaste;
}

/** Return type of the useObservabilityData hook. */
export interface UseObservabilityDataResult {
  data: ObservabilityDashboardData;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Default (sample) data -- used until the KQL service is connected
// ---------------------------------------------------------------------------

const DEFAULT_SLO_CARDS: SLOCardData[] = [
  {
    name: "Sales Pipeline Daily",
    itemType: "Pipeline",
    successRate: 99.7,
    successTarget: 99.5,
    p50Duration: "4m 12s",
    p95Duration: "8m 45s",
    freshness: "12 min ago",
    freshnessStatus: "healthy",
    errorBudgetRemaining: 82
  },
  {
    name: "Customer 360 Dataflow",
    itemType: "Dataflow",
    successRate: 98.1,
    successTarget: 99.0,
    p50Duration: "12m 30s",
    p95Duration: "22m 10s",
    freshness: "2h 15m ago",
    freshnessStatus: "warning",
    errorBudgetRemaining: 12
  },
  {
    name: "Inventory Notebook",
    itemType: "Notebook",
    successRate: 95.2,
    successTarget: 99.0,
    p50Duration: "45m 18s",
    p95Duration: "1h 12m",
    freshness: "6h ago",
    freshnessStatus: "critical",
    errorBudgetRemaining: 0
  },
  {
    name: "Finance Lakehouse Refresh",
    itemType: "Pipeline",
    successRate: 99.9,
    successTarget: 99.5,
    p50Duration: "2m 08s",
    p95Duration: "3m 50s",
    freshness: "5 min ago",
    freshnessStatus: "healthy",
    errorBudgetRemaining: 95
  }
];

const DEFAULT_INCIDENTS: IncidentRow[] = [
  {
    timestamp: "2026-03-09 08:42",
    sloName: "Inventory Notebook",
    metric: "Success Rate",
    severity: "critical",
    detail: "Dropped to 95.2% (target: 99.0%)",
    resolved: false
  },
  {
    timestamp: "2026-03-09 06:15",
    sloName: "Customer 360 Dataflow",
    metric: "Data Freshness",
    severity: "warning",
    detail: "Last refresh 2h 15m ago (target: 1h)",
    resolved: false
  },
  {
    timestamp: "2026-03-08 22:10",
    sloName: "Sales Pipeline Daily",
    metric: "P95 Duration",
    severity: "warning",
    detail: "P95 exceeded 8m threshold",
    resolved: true
  }
];

const DEFAULT_FAILED_JOBS: FailedJobRow[] = [
  {
    timestamp: "2026-03-09 08:38",
    itemName: "Inventory Notebook",
    itemType: "Notebook",
    errorMessage: "OutOfMemoryError: Spark executor exceeded 8GB limit",
    duration: "47m 22s"
  },
  {
    timestamp: "2026-03-09 03:12",
    itemName: "Customer 360 Dataflow",
    itemType: "Dataflow",
    errorMessage: "Connection timeout to source system (SAP)",
    duration: "15m 04s"
  },
  {
    timestamp: "2026-03-08 21:55",
    itemName: "Sales Pipeline Daily",
    itemType: "Pipeline",
    errorMessage: "Schema drift detected in staging table",
    duration: "8m 45s"
  }
];

const DEFAULT_WASTE_ITEMS: WasteItemData[] = [
  {
    name: "Inventory Notebook",
    itemType: "Notebook",
    wasteScore: 62,
    retryWaste: 18.40,
    durationWaste: 12.80,
    totalWaste: 31.20,
    monthlyProjected: 133.71
  },
  {
    name: "Customer 360 Dataflow",
    itemType: "Dataflow",
    wasteScore: 78,
    retryWaste: 4.20,
    durationWaste: 8.90,
    totalWaste: 13.10,
    monthlyProjected: 56.14
  },
  {
    name: "Sales Pipeline Daily",
    itemType: "Pipeline",
    wasteScore: 91,
    retryWaste: 1.80,
    durationWaste: 2.40,
    totalWaste: 4.20,
    monthlyProjected: 18.00
  },
  {
    name: "Finance Lakehouse Refresh",
    itemType: "Pipeline",
    wasteScore: 97,
    retryWaste: 0.60,
    durationWaste: 0.00,
    totalWaste: 0.60,
    monthlyProjected: 2.57
  }
];

const DEFAULT_AGGREGATE_WASTE: AggregateWaste = {
  score: 82,
  totalMonthly: 210.42,
  totalWeekly: 49.10
};

const DEFAULT_DATA: ObservabilityDashboardData = {
  sloCards: DEFAULT_SLO_CARDS,
  incidents: DEFAULT_INCIDENTS,
  failedJobs: DEFAULT_FAILED_JOBS,
  wasteItems: DEFAULT_WASTE_ITEMS,
  aggregateWaste: DEFAULT_AGGREGATE_WASTE
};

// ---------------------------------------------------------------------------
// Data fetcher -- swap this implementation when kqlQueryService is ready
// ---------------------------------------------------------------------------

/**
 * Fetches dashboard data. Currently returns sample data.
 *
 * When the KQL query service is available, replace the body of this function
 * with a call to `kqlQueryService.fetchDashboardData(timeRange, workspaceIds)`
 * and map the response into an `ObservabilityDashboardData` shape.
 */
async function fetchDashboardData(
  _timeRange: string,
  _workspaceIds: string[]
): Promise<ObservabilityDashboardData> {
  // TODO: Replace with kqlQueryService call:
  // import { kqlQueryService } from "../services/kqlQueryService";
  // return kqlQueryService.fetchDashboardData(timeRange, workspaceIds);
  return DEFAULT_DATA;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Auto-refresh interval in milliseconds. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Custom hook that manages fetching observability dashboard data, provides
 * loading / error states, and auto-refreshes on a 60-second interval.
 *
 * @param timeRange  - The currently selected time range filter (e.g. "24h").
 * @param workspaceIds - Workspace IDs the dashboard is scoped to.
 */
export function useObservabilityData(
  timeRange: string,
  workspaceIds: string[]
): UseObservabilityDataResult {
  const [data, setData] = useState<ObservabilityDashboardData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Keep a ref so the interval callback always sees the latest values
  // without causing the interval to be re-created on every state change.
  const paramsRef = useRef({ timeRange, workspaceIds });
  paramsRef.current = { timeRange, workspaceIds };

  const doFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(
        paramsRef.current.timeRange,
        paramsRef.current.workspaceIds
      );
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[useObservabilityData] Load failed:", err instanceof Error ? err.message : err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and re-fetch when filters change (timeRange or workspaceIds).
  // We stringify workspaceIds to get a stable dependency value.
  const workspaceKey = workspaceIds.join(",");
  useEffect(() => {
    doFetch();
  }, [timeRange, workspaceKey, doFetch]);

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
    refresh: doFetch
  };
}
