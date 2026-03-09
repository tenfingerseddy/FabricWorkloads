import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { WorkbenchDashboardDefinition } from "./WorkbenchDashboardDefinition";
import {
  Badge,
  Button,
  Dropdown,
  Option,
  ProgressBar,
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

/** Sample SLO card data for rendering */
interface SLOCardData {
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

const SAMPLE_SLO_CARDS: SLOCardData[] = [
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

interface IncidentRow {
  timestamp: string;
  sloName: string;
  metric: string;
  severity: "warning" | "critical";
  detail: string;
  resolved: boolean;
}

const SAMPLE_INCIDENTS: IncidentRow[] = [
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

interface FailedJobRow {
  timestamp: string;
  itemName: string;
  itemType: string;
  errorMessage: string;
  duration: string;
}

const SAMPLE_FAILED_JOBS: FailedJobRow[] = [
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

/** Sample CU waste data */
interface WasteItemData {
  name: string;
  itemType: string;
  wasteScore: number;
  retryWaste: number;
  durationWaste: number;
  totalWaste: number;
  monthlyProjected: number;
}

const SAMPLE_WASTE_ITEMS: WasteItemData[] = [
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

const AGGREGATE_WASTE = {
  score: 82,
  totalMonthly: 210.42,
  totalWeekly: 49.10
};

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

/**
 * WorkbenchDashboardDefaultView - Main dashboard view
 *
 * Renders: SLO status cards grid, incident timeline, failed jobs table.
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

  const DashboardContent = () => (
    <div className="workbench-dashboard-view">
      {/* Header */}
      <div>
        <h2 className="workbench-dashboard-title">
          {t("WorkbenchDashboard_Title", "Observability Dashboard")}
        </h2>
        <p className="workbench-dashboard-subtitle">
          {t(
            "WorkbenchDashboard_Subtitle",
            "Monitoring 4 workspaces \u00B7 12 items \u00B7 3 active alerts"
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
            onOptionSelect={(_, data) =>
              handleTimeRangeChange(data.optionValue as string)
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
        <Tooltip content="Refresh dashboard data" relationship="label">
          <Button
            appearance="subtle"
            icon={<ArrowSync20Regular />}
            aria-label="Refresh"
          />
        </Tooltip>
      </div>

      {/* SLO Cards Grid */}
      <div className="workbench-dashboard-section">
        <h3 className="workbench-dashboard-section-title">
          {t("WorkbenchDashboard_SLOStatus", "SLO Status")}
        </h3>
        <div className="workbench-dashboard-slo-grid">
          {SAMPLE_SLO_CARDS.map((card) => (
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
                {AGGREGATE_WASTE.score}
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
                ${AGGREGATE_WASTE.totalWeekly.toFixed(2)}
              </Text>
            </div>
            <div className="workbench-dashboard-waste-stat">
              <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                Monthly Projected
              </Text>
              <Text size={500} weight="semibold" style={{ color: "#d13438" }}>
                ${AGGREGATE_WASTE.totalMonthly.toFixed(2)}
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
              {SAMPLE_WASTE_ITEMS.map((item, idx) => (
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
                      <Text weight="semibold">{item.name}</Text>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <Badge appearance="outline" color="informative">
                      {item.itemType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      appearance="filled"
                      color={
                        item.wasteScore >= 90
                          ? "success"
                          : item.wasteScore >= 70
                          ? "warning"
                          : "danger"
                      }
                    >
                      {item.wasteScore}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size={200}>${item.retryWaste.toFixed(2)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size={200}>${item.durationWaste.toFixed(2)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text weight="semibold">${item.totalWaste.toFixed(2)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text
                      weight="semibold"
                      style={{
                        color:
                          item.monthlyProjected > 100
                            ? "#d13438"
                            : item.monthlyProjected > 20
                            ? "#e8712a"
                            : "inherit"
                      }}
                    >
                      ${item.monthlyProjected.toFixed(2)}/mo
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
              {SAMPLE_INCIDENTS.map((inc, idx) => (
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
              {SAMPLE_FAILED_JOBS.map((job, idx) => (
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
