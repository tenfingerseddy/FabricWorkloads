import React from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { SLODefinitionDefinition } from "./SLODefinitionDefinition";
import {
  Badge,
  Dropdown,
  Input,
  Label,
  Option,
  ProgressBar,
  SpinButton,
  Text
} from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  Warning20Filled,
  ErrorCircle20Filled,
  DataUsage24Regular,
  TargetArrow24Regular,
  Timer24Regular
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

/** Compute a simulated current value and error budget for display */
function getSimulatedStatus(def: SLODefinitionDefinition) {
  const target = def.targetValue ?? 99.5;
  const warning = def.warningThreshold ?? 99.0;
  // Simulated current value
  const currentValue = 98.7;
  const errorBudget = target > 0 ? Math.max(0, ((target - (target - currentValue)) / target) * 100) : 0;
  const errorBudgetUsed = target > 0 ? ((target - currentValue) / (100 - target)) * 100 : 0;
  const errorBudgetRemaining = Math.max(0, Math.min(100, 100 - errorBudgetUsed));

  let status: "healthy" | "warning" | "critical";
  if (currentValue >= target) {
    status = "healthy";
  } else if (currentValue >= warning) {
    status = "warning";
  } else {
    status = "critical";
  }

  return { currentValue, errorBudgetRemaining, status };
}

/**
 * SLODefinitionDefaultView - SLO configuration form with current status
 * indicator and error budget bar.
 */
export function SLODefinitionDefaultView({
  workloadClient,
  item,
  definition,
  onDefinitionChange
}: SLODefinitionDefaultViewProps) {
  const { t } = useTranslation();

  const def = definition || {};

  const updateField = <K extends keyof SLODefinitionDefinition>(
    key: K,
    value: SLODefinitionDefinition[K]
  ) => {
    onDefinitionChange?.({ ...def, [key]: value });
  };

  const { currentValue, errorBudgetRemaining, status } =
    getSimulatedStatus(def);

  const isPercentMetric =
    def.metricType === "success_rate" || def.metricType === "availability";

  const StatusPanel = () => (
    <div className="slo-definition-view">
      <h3 className="slo-definition-title">
        {t("SLODefinition_StatusPanel_Title", "Current Status")}
      </h3>

      {/* Status Header */}
      <div className="slo-definition-status-header">
        <div className="slo-definition-status-indicator">
          {status === "healthy" && (
            <CheckmarkCircle20Filled
              style={{ color: "#107c10", fontSize: 32 }}
            />
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

        <div className="slo-definition-status-divider" />

        {/* Error Budget */}
        <div className="slo-definition-error-budget">
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
        </div>
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
    </div>
  );

  const FormContent = () => (
    <div className="slo-definition-view">
      <h2 className="slo-definition-title">
        {t("SLODefinition_Title", "SLO Configuration")}
      </h2>

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
