/**
 * EventSearch — Full-text search across FabricEvents with filters.
 *
 * Provides search bar, multi-select filters (item type, status, time range),
 * sortable results table, and detail flyout.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Badge,
  Button,
  Input,
  Spinner,
  Text,
  Dropdown,
  Option
} from "@fluentui/react-components";
import {
  Search20Regular,
  Dismiss20Regular,
  ErrorCircle20Filled,
  CheckmarkCircle20Filled,
  Warning20Filled,
  Subtract20Regular,
  Filter20Regular,
  ArrowLeft20Regular
} from "@fluentui/react-icons";
import "./EventSearch.scss";

// ============================================================================
// Types
// ============================================================================

interface EventSearchProps {
  onClose: () => void;
}

interface SearchResult {
  eventId: string;
  itemName: string;
  itemType: string;
  status: string;
  startTimeUtc: string;
  durationSeconds: number;
  failureReason: string;
  workspaceName: string;
  jobType: string;
}

type SortField = "itemName" | "itemType" | "status" | "startTimeUtc" | "durationSeconds";
type SortDir = "asc" | "desc";

// ============================================================================
// Constants
// ============================================================================

const ITEM_TYPES = [
  "DataPipeline",
  "Notebook",
  "SemanticModel",
  "Lakehouse",
  "CopyJob",
  "Dataflow",
  "SparkJobDefinition"
];

const STATUSES = ["Completed", "Failed", "InProgress", "Cancelled"];

const TIME_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" }
];

// ============================================================================
// Sample data (replace with KQL query when wired)
// ============================================================================

function generateSampleResults(query: string, filters: {
  itemTypes: string[];
  statuses: string[];
  timeRange: string;
}): SearchResult[] {
  const now = Date.now();
  const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600000).toISOString();

  const allResults: SearchResult[] = [
    { eventId: "e001", itemName: "NB_ObsIngestion", itemType: "Notebook", status: "Completed", startTimeUtc: h(0.5), durationSeconds: 14, failureReason: "", workspaceName: "ObservabilityWorkbench-Dev", jobType: "RunNotebook" },
    { eventId: "e002", itemName: "NB_ObsCorrelation", itemType: "Notebook", status: "Completed", startTimeUtc: h(0.7), durationSeconds: 22, failureReason: "", workspaceName: "ObservabilityWorkbench-Dev", jobType: "RunNotebook" },
    { eventId: "e003", itemName: "NB_ObsAlerts", itemType: "Notebook", status: "Failed", startTimeUtc: h(1.2), durationSeconds: 18, failureReason: "Job instance failed without detail error", workspaceName: "ObservabilityWorkbench-Dev", jobType: "RunNotebook" },
    { eventId: "e004", itemName: "PL_DailyRefresh", itemType: "DataPipeline", status: "Completed", startTimeUtc: h(2.0), durationSeconds: 1800, failureReason: "", workspaceName: "FrameworkProduction", jobType: "Pipeline" },
    { eventId: "e005", itemName: "PL_SalesDataIngestion", itemType: "DataPipeline", status: "Failed", startTimeUtc: h(3.5), durationSeconds: 450, failureReason: "Activity CopyData failed: The connection was closed by the remote host.", workspaceName: "FrameworkProduction", jobType: "Pipeline" },
    { eventId: "e006", itemName: "NB_TransformSales", itemType: "Notebook", status: "Completed", startTimeUtc: h(4.0), durationSeconds: 360, failureReason: "", workspaceName: "FrameworkProduction", jobType: "RunNotebook" },
    { eventId: "e007", itemName: "SM_SalesReport", itemType: "SemanticModel", status: "Completed", startTimeUtc: h(4.5), durationSeconds: 120, failureReason: "", workspaceName: "FrameworkProduction", jobType: "Refresh" },
    { eventId: "e008", itemName: "CJ_ExportToADLS", itemType: "CopyJob", status: "Completed", startTimeUtc: h(5.0), durationSeconds: 45, failureReason: "", workspaceName: "FrameworkProduction", jobType: "CopyJob" },
    { eventId: "e009", itemName: "NB_ObsIngestion", itemType: "Notebook", status: "Completed", startTimeUtc: h(5.5), durationSeconds: 13, failureReason: "", workspaceName: "ObservabilityWorkbench-Dev", jobType: "RunNotebook" },
    { eventId: "e010", itemName: "PL_DailyRefresh", itemType: "DataPipeline", status: "InProgress", startTimeUtc: h(0.1), durationSeconds: 0, failureReason: "", workspaceName: "FrameworkProduction", jobType: "Pipeline" },
    { eventId: "e011", itemName: "NB_ObsAlerts", itemType: "Notebook", status: "Completed", startTimeUtc: h(6.0), durationSeconds: 20, failureReason: "", workspaceName: "ObservabilityWorkbench-Dev", jobType: "RunNotebook" },
    { eventId: "e012", itemName: "LH_SalesArchive", itemType: "Lakehouse", status: "Completed", startTimeUtc: h(8.0), durationSeconds: 90, failureReason: "", workspaceName: "FrameworkProduction", jobType: "TableMaintenance" },
  ];

  let filtered = allResults;

  // Apply text search
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.failureReason.toLowerCase().includes(q) ||
        r.itemType.toLowerCase().includes(q) ||
        r.workspaceName.toLowerCase().includes(q)
    );
  }

  // Apply filters
  if (filters.itemTypes.length > 0) {
    filtered = filtered.filter((r) => filters.itemTypes.includes(r.itemType));
  }
  if (filters.statuses.length > 0) {
    filtered = filtered.filter((r) => filters.statuses.includes(r.status));
  }

  return filtered;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return <CheckmarkCircle20Filled style={{ color: "#107c10" }} />;
    case "failed":
      return <ErrorCircle20Filled style={{ color: "#d13438" }} />;
    case "inprogress":
      return <Warning20Filled style={{ color: "#ca5010" }} />;
    default:
      return <Subtract20Regular style={{ color: "#8a8886" }} />;
  }
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ============================================================================
// Component
// ============================================================================

const EventSearch: React.FC<EventSearchProps> = ({ onClose }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState("24h");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchTime, setSearchTime] = useState(0);
  const [sortField, setSortField] = useState<SortField>("startTimeUtc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Execute search
  useEffect(() => {
    let cancelled = false;

    async function search() {
      setIsLoading(true);
      const start = performance.now();

      try {
        // TODO: Replace with kqlQueryService.searchEvents(debouncedQuery, filters)
        await new Promise((r) => setTimeout(r, 150));
        if (!cancelled) {
          const res = generateSampleResults(debouncedQuery, {
            itemTypes: itemTypeFilter,
            statuses: statusFilter,
            timeRange
          });
          setResults(res);
          setSearchTime(Math.round(performance.now() - start));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    search();
    return () => { cancelled = true; };
  }, [debouncedQuery, itemTypeFilter, statusFilter, timeRange]);

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [results, sortField, sortDir]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  const sortIndicator = (field: SortField) => {
    if (field !== sortField) return null;
    return <span className="event-search-sort-indicator">{sortDir === "asc" ? " ↑" : " ↓"}</span>;
  };

  return (
    <div className="event-search">
      {/* Header */}
      <div className="event-search-header">
        <Button
          appearance="subtle"
          icon={<ArrowLeft20Regular />}
          onClick={onClose}
        >
          Back to Dashboard
        </Button>
        <Text size={500} weight="bold">Event Search</Text>
      </div>

      {/* Search bar */}
      <div className="event-search-bar">
        <Input
          className="event-search-input"
          placeholder="Search events by name, error message, workspace..."
          contentBefore={<Search20Regular />}
          contentAfter={
            query ? (
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss20Regular />}
                onClick={() => setQuery("")}
                aria-label="Clear search"
              />
            ) : undefined
          }
          value={query}
          onChange={(_, data) => setQuery(data.value)}
        />
        <Button
          appearance="subtle"
          icon={<Filter20Regular />}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters
          {(itemTypeFilter.length > 0 || statusFilter.length > 0) && (
            <Badge appearance="filled" color="brand" size="small" style={{ marginLeft: 4 }}>
              {itemTypeFilter.length + statusFilter.length}
            </Badge>
          )}
        </Button>
        <Dropdown
          value={TIME_PRESETS.find((p) => p.value === timeRange)?.label ?? "24h"}
          onOptionSelect={(_, data) => {
            if (data.optionValue) setTimeRange(data.optionValue);
          }}
          style={{ minWidth: 160 }}
        >
          {TIME_PRESETS.map((p) => (
            <Option key={p.value} value={p.value}>{p.label}</Option>
          ))}
        </Dropdown>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="event-search-filters">
          <div className="event-search-filter-group">
            <Text size={200} weight="semibold">Item Type</Text>
            <div className="event-search-filter-chips">
              {ITEM_TYPES.map((t) => (
                <Badge
                  key={t}
                  appearance={itemTypeFilter.includes(t) ? "filled" : "outline"}
                  color={itemTypeFilter.includes(t) ? "brand" : "informative"}
                  size="medium"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setItemTypeFilter((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    )
                  }
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="event-search-filter-group">
            <Text size={200} weight="semibold">Status</Text>
            <div className="event-search-filter-chips">
              {STATUSES.map((s) => (
                <Badge
                  key={s}
                  appearance={statusFilter.includes(s) ? "filled" : "outline"}
                  color={statusFilter.includes(s) ? "brand" : "informative"}
                  size="medium"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    )
                  }
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          {(itemTypeFilter.length > 0 || statusFilter.length > 0) && (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => {
                setItemTypeFilter([]);
                setStatusFilter([]);
              }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Results stats */}
      <div className="event-search-stats">
        {isLoading ? (
          <Spinner size="tiny" />
        ) : (
          <Text size={200} style={{ color: "#605e5c" }}>
            {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""} in {searchTime}ms
          </Text>
        )}
      </div>

      {/* Results table */}
      <div className="event-search-results">
        {sortedResults.length === 0 && !isLoading ? (
          <div className="event-search-empty">
            <Search20Regular style={{ fontSize: 48, color: "#605e5c" }} />
            <Text size={400}>No events match your search</Text>
            <Text size={300} style={{ color: "#605e5c" }}>
              Try adjusting your search query or filters
            </Text>
          </div>
        ) : (
          <table className="event-search-table" role="grid">
            <thead>
              <tr>
                <th onClick={() => handleSort("itemName")} role="columnheader" tabIndex={0}>
                  Item Name {sortIndicator("itemName")}
                </th>
                <th onClick={() => handleSort("itemType")} role="columnheader" tabIndex={0}>
                  Type {sortIndicator("itemType")}
                </th>
                <th onClick={() => handleSort("status")} role="columnheader" tabIndex={0}>
                  Status {sortIndicator("status")}
                </th>
                <th onClick={() => handleSort("startTimeUtc")} role="columnheader" tabIndex={0}>
                  Start Time {sortIndicator("startTimeUtc")}
                </th>
                <th onClick={() => handleSort("durationSeconds")} role="columnheader" tabIndex={0}>
                  Duration {sortIndicator("durationSeconds")}
                </th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr
                  key={result.eventId}
                  className={`event-search-row ${selectedResult?.eventId === result.eventId ? "event-search-row--selected" : ""}`}
                  onClick={() => setSelectedResult(result)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedResult(result);
                  }}
                >
                  <td>
                    <Text weight="semibold" size={200}>{result.itemName}</Text>
                  </td>
                  <td>
                    <Badge appearance="outline" size="small" color="informative">
                      {result.itemType}
                    </Badge>
                  </td>
                  <td>
                    <span className="event-search-status">
                      {getStatusIcon(result.status)}
                      <Text size={200}>{result.status}</Text>
                    </span>
                  </td>
                  <td>
                    <Text size={200}>{formatTimestamp(result.startTimeUtc)}</Text>
                  </td>
                  <td>
                    <Text size={200}>{formatDuration(result.durationSeconds)}</Text>
                  </td>
                  <td>
                    <Text
                      size={200}
                      style={{ color: result.failureReason ? "#d13438" : "#605e5c" }}
                      truncate
                      wrap={false}
                    >
                      {result.failureReason ? result.failureReason.substring(0, 80) + (result.failureReason.length > 80 ? "..." : "") : "—"}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail flyout */}
      {selectedResult && (
        <div className="event-search-detail">
          <div className="event-search-detail-header">
            <Text size={400} weight="semibold">{selectedResult.itemName}</Text>
            <Badge
              appearance="filled"
              color={
                selectedResult.status === "Completed" ? "success" :
                selectedResult.status === "Failed" ? "danger" : "warning"
              }
            >
              {selectedResult.status}
            </Badge>
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss20Regular />}
              onClick={() => setSelectedResult(null)}
              aria-label="Close detail"
              style={{ marginLeft: "auto" }}
            />
          </div>
          <div className="event-search-detail-grid">
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Item Type</Text>
              <Text>{selectedResult.itemType}</Text>
            </div>
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Job Type</Text>
              <Text>{selectedResult.jobType}</Text>
            </div>
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Workspace</Text>
              <Text>{selectedResult.workspaceName}</Text>
            </div>
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Start Time</Text>
              <Text>{new Date(selectedResult.startTimeUtc).toLocaleString()}</Text>
            </div>
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Duration</Text>
              <Text>{formatDuration(selectedResult.durationSeconds)}</Text>
            </div>
            <div className="event-search-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Event ID</Text>
              <Text size={200} font="monospace">{selectedResult.eventId}</Text>
            </div>
          </div>
          {selectedResult.failureReason && (
            <div className="event-search-detail-error">
              <Text size={200} weight="semibold" style={{ color: "#d13438" }}>
                Failure Reason
              </Text>
              <pre className="event-search-detail-error-text">
                {selectedResult.failureReason}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventSearch;
