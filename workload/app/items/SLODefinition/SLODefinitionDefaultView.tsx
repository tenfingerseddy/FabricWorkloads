import React from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { SLODefinitionDefinition } from "./SLODefinitionDefinition";
import { useSloData } from "../../hooks/useSloData";
import {
  Badge,
  Button,
  Dropdown,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Option,
  ProgressBar,
  SpinButton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Tooltip
} from "@fluentui/react-components";
import {
  ArrowSync20Regular,
  CheckmarkCircle20Filled,
  Clock20Regular,
  DataUsage24Regular,
  ErrorCircle20Filled,
  TargetArrow24Regular,
  Timer24Regular,
  Warning20Filled
} from "@fluentui/react-icons";
import "./SLODefinition.scss";

interface SLODefinitionDefaultViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<SLODefinitionDefinition>;
  definition?: SLODefinitionDefinition;
  onDefinitionChange?: (def: SLODefinitionDefinition) => void;
}

const ITEM_TYPE_OPTIONS = [
  { value: "Pipeline", label: "Pipeline" },
  { value: "Dataflow", label: "Dataflow Gen2" },
  { value: "Notebook", label: "Notebook" },
  { value: "Lakehouse", label: "Lakehouse" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "SemanticModel", label: "Semantic Model" }
];

const METRIC_TYPE_OPTIONS = [
  { value: "success_rate", label: "Success Rate (%)" },
  { value: "p50_duration", label: "P50 Duration (minutes)" },
  { value: "p95_duration", label: "P95 Duration (minutes)" },
  { value: "data_freshness", label: "Data Freshness (minutes)" },
  { value: "availability", label: "Availability (%)" }
];

const EVALUATION_WINDOW_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days (rolling)" },
  { value: "30d", label: "30 days (rolling)" },
  { value: "calendar_month", label: "Calendar month" }
];

/** Format a Date as "HH:MM:SS" for the last-updated indicator. */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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

function TrendIcon({ direction }: { direction: "improving" | "stable" | "degrading" }) {
  const color =
    direction === "improving"
      ? "#107c10"
      : direction === "degrading"
      ? "#d13438"
      : "var(--colorNeutralForeground3)";
  return (
    <Text size={200} weight="semibold" style={{ color }}>
      {direction === "improving" && "Improving"}
      {direction === "stable" && "Stable"}
      {direction === "degrading" && "Degrading"}
    </Text>
  );
}

/**
 * SLODefinitionDefaultView - SLO configuration form with live current
 * status indicator, error budget visualization, and compliance data.
 *
 * Sprint 03 B4: Wired to useSloData hook for live KQL data.
 */
export function SLODefinitionDefaultView({
  workloadClient,
  item,
  definition,
  onDefinitionChange
}: SLODefinitionDefaultViewProps) {
  const { t } = useTranslation();

  const def = definition || {};

  // --- Live data hook ---
  const {
    data: sloData,
    isLoading,
    error: fetchError,
    lastUpdated,
    isLive,
    refresh
  } = useSloData(def.evaluationWindow || "7d", def.itemId);

  const updateField = <K extends keyof SLODefinitionDefinition>(
    key: K,
    value: SLODefinitionDefinition[K]
  ) => {
    onDefinitionChange?.({ ...def, [key]: value });
  };

  const isPercentMetric =
    def.metricType === "success_rate" || def.metricType === "availability";

  // Find the SLO status that matches the current definition's item, or use the first one
  const matchedSlo = sloData.sloStatuses.find(
    (s) => s.itemName === def.itemId || s.sloId === def.itemId
  ) || sloData.sloStatuses[0];

  const currentValue = matchedSlo?.currentValue ?? 0;
  const errorBudgetRemaining = matchedSlo?.errorBudgetRemaining ?? 100;
  const status = matchedSlo?.status ?? "healthy";

  // --- Status Panel (left sidebar with live data) ---
  const StatusPanel = () => (
    <div className="slo-definition-view">
      <div className="slo-definition-status-panel-header">
        <h3 className="slo-definition-title" style={{ fontSize: 20 }}>
          {t("SLODefinition_StatusPanel_Title", "Current Status")}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastUpdated && (
            <Text
              size={200}
              style={{ color: "var(--colorNeutralForeground3)" }}
            >
              {formatTime(lastUpdated)}
            </Text>
          )}
          <Tooltip content="Refresh SLO data" relationship="label">
            <Button
              appearance="subtle"
              size="small"
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
      </div>

      {/* Data source indicator */}
      <Badge
        appearance="outline"
        color={isLive ? "success" : "informative"}
        style={{ alignSelf: "flex-start" }}
      >
        {isLive ? "Live KQL" : "Sample Data"}
      </Badge>

      {/* Error banner */}
      {fetchError && (
        <MessageBar intent="error" style={{ width: "100%" }}>
          <MessageBarBody>{fetchError}</MessageBarBody>
        </MessageBar>
      )}

      {/* Loading state for initial load */}
      {isLoading && !lastUpdated && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24, width: "100%" }}>
          <Spinner size="medium" label="Loading SLO data..." />
        </div>
      )}

      {lastUpdated && (
        <>
          {/* Status Header */}
          <div className="slo-definition-status-header">
            <div className="slo-definition-status-indicator">
              {status === "healthy" && (
                <CheckmarkCircle20Filled style={{ color: "#107c10", fontSize: 32 }} />
              )}
              {status === "warning" && (
                <Warning20Filled style={{ color: "#e8712a", fontSize: 32 }} />
              )}
              {status === "critical" && (
                <ErrorCircle20Filled style={{ color: "#d13438", fontSize: 32 }} />
              )}
              <span
                className={`slo-definition-status-value slo-definition-status-value--${status}`}
              >
                {currentValue}
                {isPercentMetric ? "%" : "m"}
              </span>
              <span className="slo-definition-status-label">Current Value</span>
            </div>

            <div className="slo-definition-status-divider" />

            <div className="slo-definition-status-indicator">
              <Text size={500} weight="semibold" style={{ color: "#0078D4" }}>
                {def.targetValue ?? 99.5}
                {isPercentMetric ? "%" : "m"}
              </Text>
              <span className="slo-definition-status-label">Target</span>
            </div>

            <div className="slo-definition-status-divider" />

            <div className="slo-definition-status-indicator">
              <Text size={500} weight="semibold" style={{ color: "#e8712a" }}>
                {def.warningThreshold ?? 99.0}
                {isPercentMetric ? "%" : "m"}
              </Text>
              <span className="slo-definition-status-label">Warning</span>
            </div>
          </div>

          {/* Error Budget */}
          <div className="slo-definition-error-budget" style={{ width: "100%" }}>
            <div className="slo-definition-error-budget-header">
              <span className="slo-definition-error-budget-label">
                Error Budget
              </span>
              <span className="slo-definition-error-budget-value">
                {errorBudgetRemaining.toFixed(1)}% remaining
              </span>
            </div>
            <ProgressBar
              value={errorBudgetRemaining / 100}
              color={
                errorBudgetRemaining > 50
                  ? "success"
                  : errorBudgetRemaining > 20
                  ? "warning"
                  : "error"
              }
              thickness="large"
            />
            {sloData.errorBudgetSummary.projectedExhaustionDays !== null && (
              <Text
                size={200}
                style={{
                  color:
                    sloData.errorBudgetSummary.projectedExhaustionDays < 7
                      ? "#d13438"
                      : "var(--colorNeutralForeground3)"
                }}
              >
                {sloData.errorBudgetSummary.projectedExhaustionDays < 7
                  ? `Budget exhaustion projected in ${sloData.errorBudgetSummary.projectedExhaustionDays} days`
                  : `~${sloData.errorBudgetSummary.projectedExhaustionDays} days until exhaustion`}
              </Text>
            )}
          </div>

          {/* SLO Health Counters */}
          <div className="slo-definition-health-counters">
            <div className="slo-definition-health-counter">
              <CheckmarkCircle20Filled style={{ color: "#107c10" }} />
              <Text size={600} weight="bold" style={{ color: "#107c10" }}>
                {sloData.healthySloCount}
              </Text>
              <Text size={200}>Healthy</Text>
            </div>
            <div className="slo-definition-health-counter">
              <Warning20Filled style={{ color: "#e8712a" }} />
              <Text size={600} weight="bold" style={{ color: "#e8712a" }}>
                {sloData.warningSloCount}
              </Text>
              <Text size={200}>Warning</Text>
            </div>
            <div className="slo-definition-health-counter">
              <ErrorCircle20Filled style={{ color: "#d13438" }} />
              <Text size={600} weight="bold" style={{ color: "#d13438" }}>
                {sloData.criticalSloCount}
              </Text>
              <Text size={200}>Critical</Text>
            </div>
          </div>

          {/* All SLOs Quick View */}
          <div className="slo-definition-all-slos">
            <Text size={300} weight="semibold">
              All SLOs ({sloData.sloStatuses.length})
            </Text>
            {sloData.sloStatuses.map((slo) => (
              <div key={slo.sloId} className="slo-definition-slo-mini-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusIcon status={slo.status} />
                    <Text size={300} weight="semibold">{slo.itemName}</Text>
                  </div>
                  <Text
                    size={300}
                    weight="bold"
                    style={{
                      color:
                        slo.status === "healthy"
                          ? "#107c10"
                          : slo.status === "warning"
                          ? "#e8712a"
                          : "#d13438"
                    }}
                  >
                    {slo.currentValue}%
                  </Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Badge
                    appearance="outline"
                    color="informative"
                    size="small"
                  >
                    {slo.itemType}
                  </Badge>
                  <TrendIcon direction={slo.trendDirection} />
                </div>
                <ProgressBar
                  value={slo.errorBudgetRemaining / 100}
                  color={
                    slo.errorBudgetRemaining > 50
                      ? "success"
                      : slo.errorBudgetRemaining > 20
                      ? "warning"
                      : "error"
                  }
                  thickness="medium"
                />
              </div>
            ))}
          </div>

          {/* Target Preview */}
          <div className="slo-definition-target-preview">
            <div className="slo-definition-target-preview-item">
              <span className="slo-definition-target-preview-label">SLO</span>
              <span className="slo-definition-target-preview-value">
                {METRIC_TYPE_OPTIONS.find((o) => o.value === def.metricType)
                  ?.label || "Success Rate (%)"}
              </span>
            </div>
            <div className="slo-definition-target-preview-item">
              <span className="slo-definition-target-preview-label">Window</span>
              <span className="slo-definition-target-preview-value">
                {EVALUATION_WINDOW_OPTIONS.find(
                  (o) => o.value === def.evaluationWindow
                )?.label || "7 days (rolling)"}
              </span>
            </div>
            <div className="slo-definition-target-preview-item">
              <span className="slo-definition-target-preview-label">Status</span>
              <Badge
                appearance="filled"
                color={
                  status === "healthy"
                    ? "success"
                    : status === "warning"
                    ? "warning"
                    : "danger"
                }
                style={{ textTransform: "capitalize" }}
              >
                {status}
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // --- Form Content (center panel) ---
  const FormContent = () => (
    <div className="slo-definition-view">
      <h2 className="slo-definition-title">
        {t("SLODefinition_Title", "SLO Configuration")}
      </h2>

      {/* Compliance History Table */}
      {lastUpdated && sloData.complianceHistory.length > 0 && (
        <div className="slo-definition-section">
          <div className="slo-definition-section-header">
            <Clock20Regular className="slo-definition-section-icon" />
            <h3 className="slo-definition-section-title">
              {t("SLODefinition_ComplianceHistory", "Compliance History")}
            </h3>
          </div>
          <div className="slo-definition-table-container">
            <Table aria-label="SLO compliance history" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: 180 }}>SLO</TableHeaderCell>
                  <TableHeaderCell style={{ width: 120 }}>Compliance</TableHeaderCell>
                  <TableHeaderCell style={{ width: 120 }}>Evaluations</TableHeaderCell>
                  <TableHeaderCell style={{ width: 100 }}>Breaches</TableHeaderCell>
                  <TableHeaderCell>Trend (7d)</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sloData.complianceHistory.map((ch) => (
                  <TableRow key={ch.sloId}>
                    <TableCell>
                      <Text weight="semibold">{ch.itemName}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge
                        appearance="filled"
                        color={
                          ch.compliancePercent >= 99
                            ? "success"
                            : ch.compliancePercent >= 95
                            ? "warning"
                            : "danger"
                        }
                        size="small"
                      >
                        {ch.compliancePercent}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size={200}>{ch.totalEvaluations}</Text>
                    </TableCell>
                    <TableCell>
                      <Text
                        size={200}
                        style={{
                          color: ch.breachCount > 0 ? "#d13438" : "inherit"
                        }}
                        weight={ch.breachCount > 0 ? "semibold" : "regular"}
                      >
                        {ch.breachCount}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <div className="slo-definition-sparkline">
                        {ch.snapshots.map((snap, idx) => (
                          <div
                            key={idx}
                            className={`slo-definition-sparkline-bar ${
                              snap.isBreaching
                                ? "slo-definition-sparkline-bar--breach"
                                : "slo-definition-sparkline-bar--ok"
                            }`}
                            title={`${snap.timestamp}: ${snap.value}%`}
                            style={{
                              height: `${Math.max(
                                20,
                                ((snap.value - 90) / 10) * 100
                              )}%`
                            }}
                          />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="slo-definition-form">
        {/* Target Item Section */}
        <div className="slo-definition-section">
          <div className="slo-definition-section-header">
            <TargetArrow24Regular className="slo-definition-section-icon" />
            <h3 className="slo-definition-section-title">
              {t("SLODefinition_TargetSection", "Target Item")}
            </h3>
          </div>

          <div className="slo-definition-field">
            <Label className="slo-definition-field-label" htmlFor="item-id-input">
              {t("SLODefinition_ItemId_Label", "Item ID")}
            </Label>
            <p className="slo-definition-field-description">
              {t(
                "SLODefinition_ItemId_Desc",
                "The unique identifier of the Fabric item to monitor."
              )}
            </p>
            <Input
              id="item-id-input"
              value={def.itemId || ""}
              onChange={(_, data) => updateField("itemId", data.value)}
              placeholder="e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              style={{ maxWidth: 480 }}
            />
          </div>

          <div className="slo-definition-field">
            <Label
              className="slo-definition-field-label"
              htmlFor="item-type-select"
            >
              {t("SLODefinition_ItemType_Label", "Item Type")}
            </Label>
            <Dropdown
              id="item-type-select"
              value={def.itemType || ""}
              placeholder="Select item type..."
              onOptionSelect={(_, data) =>
                updateField("itemType", data.optionValue as string)
              }
              style={{ maxWidth: 300 }}
            >
              {ITEM_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Metric & Target Section */}
        <div className="slo-definition-section">
          <div className="slo-definition-section-header">
            <DataUsage24Regular className="slo-definition-section-icon" />
            <h3 className="slo-definition-section-title">
              {t("SLODefinition_MetricSection", "Metric & Target")}
            </h3>
          </div>

          <div className="slo-definition-field">
            <Label
              className="slo-definition-field-label"
              htmlFor="metric-type-select"
            >
              {t("SLODefinition_MetricType_Label", "Metric Type")}
            </Label>
            <p className="slo-definition-field-description">
              {t(
                "SLODefinition_MetricType_Desc",
                "The metric to track for this SLO. Percentage metrics use 0-100 scale; duration metrics are in minutes."
              )}
            </p>
            <Dropdown
              id="metric-type-select"
              value={def.metricType || ""}
              placeholder="Select metric..."
              onOptionSelect={(_, data) =>
                updateField("metricType", data.optionValue as string)
              }
              style={{ maxWidth: 300 }}
            >
              {METRIC_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className="slo-definition-field">
            <Label className="slo-definition-field-label" htmlFor="target-value">
              {t("SLODefinition_TargetValue_Label", "Target Value")}
            </Label>
            <div className="slo-definition-field-row">
              <SpinButton
                id="target-value"
                value={def.targetValue ?? 99.5}
                onChange={(_, data) =>
                  updateField("targetValue", data.value ?? 99.5)
                }
                min={0}
                max={isPercentMetric ? 100 : 10000}
                step={isPercentMetric ? 0.1 : 1}
                style={{ width: 140 }}
              />
              <Text size={300} style={{ color: "var(--colorNeutralForeground2)" }}>
                {isPercentMetric ? "%" : "minutes"}
              </Text>
            </div>
          </div>

          <div className="slo-definition-field">
            <Label
              className="slo-definition-field-label"
              htmlFor="warning-threshold"
            >
              {t("SLODefinition_WarningThreshold_Label", "Warning Threshold")}
            </Label>
            <p className="slo-definition-field-description">
              {t(
                "SLODefinition_WarningThreshold_Desc",
                "Triggers a warning state before the SLO is breached, allowing proactive remediation."
              )}
            </p>
            <div className="slo-definition-field-row">
              <SpinButton
                id="warning-threshold"
                value={def.warningThreshold ?? 99.0}
                onChange={(_, data) =>
                  updateField("warningThreshold", data.value ?? 99.0)
                }
                min={0}
                max={isPercentMetric ? 100 : 10000}
                step={isPercentMetric ? 0.1 : 1}
                style={{ width: 140 }}
              />
              <Text size={300} style={{ color: "var(--colorNeutralForeground2)" }}>
                {isPercentMetric ? "%" : "minutes"}
              </Text>
            </div>
          </div>
        </div>

        {/* Evaluation Window Section */}
        <div className="slo-definition-section">
          <div className="slo-definition-section-header">
            <Timer24Regular className="slo-definition-section-icon" />
            <h3 className="slo-definition-section-title">
              {t("SLODefinition_WindowSection", "Evaluation Window")}
            </h3>
          </div>

          <div className="slo-definition-field">
            <Label
              className="slo-definition-field-label"
              htmlFor="evaluation-window"
            >
              {t("SLODefinition_Window_Label", "Window")}
            </Label>
            <p className="slo-definition-field-description">
              {t(
                "SLODefinition_Window_Desc",
                "The time period over which the SLO is evaluated. Rolling windows continuously recalculate; calendar windows reset at the start of each period."
              )}
            </p>
            <Dropdown
              id="evaluation-window"
              value={def.evaluationWindow || ""}
              placeholder="Select window..."
              onOptionSelect={(_, data) =>
                updateField("evaluationWindow", data.optionValue as string)
              }
              style={{ maxWidth: 260 }}
            >
              {EVALUATION_WINDOW_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ItemEditorDefaultView
      left={{
        content: <StatusPanel />,
        width: 420,
        minWidth: 360,
        title: t("SLODefinition_StatusPanel_Nav", "Status"),
        enableUserResize: true,
        collapsible: true
      }}
      center={{
        content: <FormContent />
      }}
    />
  );
}
