import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { WorkbenchDashboardDefinition } from "./WorkbenchDashboardDefinition";
import {
  useObservabilityData,
  SLOCardData
} from "../../hooks/useObservabilityData";
import {
  Badge,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  ProgressBar,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
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
  Money20Regular
} from "@fluentui/react-icons";
import "./WorkbenchDashboard.scss";

interface WorkbenchDashboardDefaultViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<WorkbenchDashboardDefinition>;
  definition?: WorkbenchDashboardDefinition;
  onDefinitionChange?: (def: WorkbenchDashboardDefinition) => void;
}

const TIME_RANGES = ["1h", "6h", "12h", "24h", "7d", "30d"];

function getStatusColor(rate: number, target: number): "healthy" | "warning" | "critical" {
  if (rate >= target) return "healthy";
  if (rate >= target - 1) return "warning";
  return "critical";
}

function StatusIcon({ status }: { status: "healthy" | "warning" | "critical" }) {
  switch (status) {
    case "healthy":
      return <CheckmarkCircle20Filled style={{ color: "#107c10" }} />;
    case "warning":
      return <Warning20Filled style={{ color: "#e8712a" }} />;
    case "critical":
      return <ErrorCircle20Filled style={{ color: "#d13438" }} />;
  }
}

function SLOCard({ data }: { data: SLOCardData }) {
  const status = getStatusColor(data.successRate, data.successTarget);
  const budgetColor =
    data.errorBudgetRemaining > 50
      ? "#107c10"
      : data.errorBudgetRemaining > 10
      ? "#e8712a"
      : "#d13438";

  return (
    <div className="workbench-dashboard-slo-card">
      <div className="workbench-dashboard-slo-card-header">
        <div>
          <h4 className="workbench-dashboard-slo-card-name">{data.name}</h4>
          <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
            {data.itemType}
          </Text>
        </div>
        <StatusIcon status={status} />
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <DataUsage20Regular style={{ verticalAlign: "middle", marginRight: 4 }} />
          Success Rate
        </span>
        <span
          className={`workbench-dashboard-slo-metric-value workbench-dashboard-slo-metric-value--${status}`}
        >
          {data.successRate}%
        </span>
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <Timer20Regular style={{ verticalAlign: "middle", marginRight: 4 }} />
          P50 / P95
        </span>
        <span className="workbench-dashboard-slo-metric-value">
          {data.p50Duration} / {data.p95Duration}
        </span>
      </div>

      <div className="workbench-dashboard-slo-metric">
        <span className="workbench-dashboard-slo-metric-label">
          <Database20Regular style={{ verticalAlign: "middle", marginRight: 4 }} />
          Freshness
        </span>
        <span
          className={`workbench-dashboard-slo-metric-value workbench-dashboard-slo-metric-value--${data.freshnessStatus}`}
        >
          {data.freshness}
        </span>
      </div>

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
            {data.errorBudgetRemaining}% remaining
          </Text>
        </div>
        <ProgressBar
          value={data.errorBudgetRemaining / 100}
          color={
            data.errorBudgetRemaining > 50
              ? "success"
              : data.errorBudgetRemaining > 10
              ? "warning"
              : "error"
          }
          thickness="large"
        />
      </div>
    </div>
  );
}

/** Format a Date as "HH:MM:SS" for the last-updated indicator. */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * WorkbenchDashboardDefaultView - Main dashboard view
 *
 * Renders: SLO status cards grid, CU waste score, incident timeline,
 * failed jobs table. Data is fetched via the useObservabilityData hook
 * with 60-second auto-refresh.
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

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
    onDefinitionChange?.({ ...definition, timeRange: value });
  };

  // --- Live data hook ---
  const {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh
  } = useObservabilityData(
    selectedTimeRange,
    definition?.workspaceIds || []
  );

  const DashboardContent = () => (
    <div className="workbench-dashboard-view">
      {/* Error banner */}
      {error && (
        <MessageBar intent="error" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            {t(
              "WorkbenchDashboard_FetchError",
              "Failed to load dashboard data: {{error}}",
              { error }
            )}
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
            "Monitoring {{workspaceCount}} workspaces \u00B7 {{itemCount}} items \u00B7 {{alertCount}} active alerts",
            {
              workspaceCount: definition?.workspaceIds?.length || 4,
              itemCount: data.sloCards.length * 3,
              alertCount: data.incidents.filter((i) => !i.resolved).length
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

        {/* Last updated indicator */}
        {lastUpdated && (
          <Text
            size={200}
            style={{
              color: "var(--colorNeutralForeground3)",
              alignSelf: "center"
            }}
          >
            Updated {formatTime(lastUpdated)}
          </Text>
        )}

        <Tooltip content="Refresh dashboard data" relationship="label">
          <Button
            appearance="subtle"
            icon={
              isLoading ? (
                <Spinner size="tiny" />
              ) : (
                <ArrowSync20Regular />
              )
            }
            onClick={refresh}
            disabled={isLoading}
            aria-label="Refresh"
          />
        </Tooltip>
      </div>

      {/* Loading overlay for initial load */}
      {isLoading && !lastUpdated && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 48
          }}
        >
          <Spinner
            size="large"
            label={t(
              "WorkbenchDashboard_Loading",
              "Loading dashboard data..."
            )}
          />
        </div>
      )}

      {/* Only render data sections after the first successful load */}
      {lastUpdated && (
        <>
          {/* SLO Cards Grid */}
          <div className="workbench-dashboard-section">
            <h3 className="workbench-dashboard-section-title">
              {t("WorkbenchDashboard_SLOStatus", "SLO Status")}
            </h3>
            <div className="workbench-dashboard-slo-grid">
              {data.sloCards.map((card) => (
                <SLOCard key={card.name} data={card} />
              ))}
            </div>
          </div>

          {/* CU Waste Score */}
          <div className="workbench-dashboard-section">
            <h3 className="workbench-dashboard-section-title">
              {t("WorkbenchDashboard_WasteScore", "CU Waste Score")}
            </h3>
            <div className="workbench-dashboard-waste-summary">
              <div className="workbench-dashboard-waste-gauge">
                <div className="workbench-dashboard-waste-gauge-ring">
                  <Text size={800} weight="bold">
                    {data.aggregateWaste.score}
                  </Text>
                  <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                    / 100
                  </Text>
                </div>
                <Text size={200}>Efficiency Score</Text>
              </div>
              <div className="workbench-dashboard-waste-stats">
                <div className="workbench-dashboard-waste-stat">
                  <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                    Weekly Waste
                  </Text>
                  <Text size={500} weight="semibold" style={{ color: "#d13438" }}>
                    ${data.aggregateWaste.totalWeekly.toFixed(2)}
                  </Text>
                </div>
                <div className="workbench-dashboard-waste-stat">
                  <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                    Monthly Projected
                  </Text>
                  <Text size={500} weight="semibold" style={{ color: "#d13438" }}>
                    ${data.aggregateWaste.totalMonthly.toFixed(2)}
                  </Text>
                </div>
              </div>
            </div>
            <div className="workbench-dashboard-table-container">
              <Table aria-label="CU waste by item">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell style={{ width: 200 }}>Item</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Type</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Score</TableHeaderCell>
                    <TableHeaderCell style={{ width: 120 }}>Retry Waste</TableHeaderCell>
                    <TableHeaderCell style={{ width: 140 }}>Duration Waste</TableHeaderCell>
                    <TableHeaderCell style={{ width: 120 }}>Total Waste</TableHeaderCell>
                    <TableHeaderCell style={{ width: 140 }}>Monthly Cost</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.wasteItems.map((wasteItem, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TableCellLayout>
                          <Money20Regular
                            style={{
                              verticalAlign: "middle",
                              marginRight: 4,
                              color: "var(--colorNeutralForeground3)"
                            }}
                          />
                          <Text weight="semibold">{wasteItem.name}</Text>
                        </TableCellLayout>
                      </TableCell>
                      <TableCell>
                        <Badge appearance="outline" color="informative">
                          {wasteItem.itemType}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Text size={200}>${wasteItem.retryWaste.toFixed(2)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text size={200}>${wasteItem.durationWaste.toFixed(2)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="semibold">${wasteItem.totalWaste.toFixed(2)}</Text>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Incident Timeline */}
          <div className="workbench-dashboard-section">
            <h3 className="workbench-dashboard-section-title">
              {t("WorkbenchDashboard_Incidents", "Recent Incidents")}
            </h3>
            <div className="workbench-dashboard-table-container">
              <Table aria-label="Incident timeline">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell style={{ width: 160 }}>Time</TableHeaderCell>
                    <TableHeaderCell style={{ width: 180 }}>SLO</TableHeaderCell>
                    <TableHeaderCell style={{ width: 130 }}>Metric</TableHeaderCell>
                    <TableHeaderCell style={{ width: 90 }}>Severity</TableHeaderCell>
                    <TableHeaderCell>Detail</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Status</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.incidents.map((inc, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TableCellLayout>
                          <Clock20Regular
                            style={{
                              verticalAlign: "middle",
                              marginRight: 4,
                              color: "var(--colorNeutralForeground3)"
                            }}
                          />
                          {inc.timestamp}
                        </TableCellLayout>
                      </TableCell>
                      <TableCell>
                        <Text weight="semibold">{inc.sloName}</Text>
                      </TableCell>
                      <TableCell>{inc.metric}</TableCell>
                      <TableCell>
                        <Badge
                          appearance="filled"
                          color={inc.severity === "critical" ? "danger" : "warning"}
                        >
                          {inc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text size={200}>{inc.detail}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="outline"
                          color={inc.resolved ? "success" : "danger"}
                        >
                          {inc.resolved ? "Resolved" : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Failed Jobs */}
          <div className="workbench-dashboard-section">
            <h3 className="workbench-dashboard-section-title">
              {t("WorkbenchDashboard_FailedJobs", "Failed Jobs")}
            </h3>
            <div className="workbench-dashboard-table-container">
              <Table aria-label="Failed jobs">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell style={{ width: 160 }}>Time</TableHeaderCell>
                    <TableHeaderCell style={{ width: 200 }}>Item</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Type</TableHeaderCell>
                    <TableHeaderCell>Error</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Duration</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.failedJobs.map((job, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TableCellLayout>
                          <Clock20Regular
                            style={{
                              verticalAlign: "middle",
                              marginRight: 4,
                              color: "var(--colorNeutralForeground3)"
                            }}
                          />
                          {job.timestamp}
                        </TableCellLayout>
                      </TableCell>
                      <TableCell>
                        <Text weight="semibold">{job.itemName}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge appearance="outline" color="informative">
                          {job.itemType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text
                          size={200}
                          style={{ color: "var(--colorStatusDangerForeground1)" }}
                        >
                          {job.errorMessage}
                        </Text>
                      </TableCell>
                      <TableCell>{job.duration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <ItemEditorDefaultView
      center={{
        content: <DashboardContent />
      }}
    />
  );
}
