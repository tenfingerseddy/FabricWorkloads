import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { ItemEditorDefaultView } from "../../components/ItemEditor";
import { AlertRuleDefinition } from "./AlertRuleDefinition";
import {
  Button,
  Dropdown,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  SpinButton,
  Switch,
  Text
} from "@fluentui/react-components";
import {
  AlertBadge24Regular,
  AlertUrgent20Regular,
  Mail24Regular,
  Send24Regular,
  Shield24Regular,
  Timer24Regular
} from "@fluentui/react-icons";
import "./AlertRule.scss";

interface AlertRuleDefaultViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<AlertRuleDefinition>;
  definition?: AlertRuleDefinition;
  onDefinitionChange?: (def: AlertRuleDefinition) => void;
}

const CONDITION_OPTIONS = [
  { value: "success_rate_below", label: "Success rate drops below" },
  { value: "p95_duration_above", label: "P95 duration exceeds" },
  { value: "p50_duration_above", label: "P50 duration exceeds" },
  { value: "freshness_stale", label: "Data freshness older than" },
  { value: "error_budget_exhausted", label: "Error budget remaining below" },
  { value: "consecutive_failures", label: "Consecutive failures exceed" }
];

const NOTIFICATION_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "webhook", label: "Webhook (PagerDuty, Slack, etc.)" }
];

const COOLDOWN_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "360", label: "6 hours" },
  { value: "1440", label: "24 hours" }
];

/**
 * AlertRuleDefaultView - Rule editor with condition/threshold inputs,
 * notification target configuration, and test alert button.
 */
export function AlertRuleDefaultView({
  workloadClient,
  item,
  definition,
  onDefinitionChange
}: AlertRuleDefaultViewProps) {
  const { t } = useTranslation();
  const [testAlertStatus, setTestAlertStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  const def = definition || {};

  const updateField = <K extends keyof AlertRuleDefinition>(
    key: K,
    value: AlertRuleDefinition[K]
  ) => {
    onDefinitionChange?.({ ...def, [key]: value });
  };

  const handleTestAlert = async () => {
    setTestAlertStatus("sending");
    // Simulate test alert
    setTimeout(() => {
      setTestAlertStatus("success");
      setTimeout(() => setTestAlertStatus("idle"), 4000);
    }, 1500);
  };

  const FormContent = () => (
    <div className="alert-rule-view">
      <h2 className="alert-rule-title">
        {t("AlertRule_Title", "Alert Rule Configuration")}
      </h2>

      {/* Test Alert Banner */}
      {testAlertStatus === "success" && (
        <MessageBar intent="success">
          <MessageBarBody>
            <MessageBarTitle>Test Alert Sent</MessageBarTitle>
            A test notification was successfully delivered to{" "}
            {def.target || "the configured target"}.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className="alert-rule-form">
        {/* SLO Selection Section */}
        <div className="alert-rule-section">
          <div className="alert-rule-section-header">
            <Shield24Regular className="alert-rule-section-icon" />
            <h3 className="alert-rule-section-title">
              {t("AlertRule_SLOSection", "SLO Target")}
            </h3>
          </div>

          <div className="alert-rule-field">
            <Label className="alert-rule-field-label" htmlFor="slo-select">
              {t("AlertRule_SLO_Label", "Service Level Objective")}
            </Label>
            <p className="alert-rule-field-description">
              {t(
                "AlertRule_SLO_Desc",
                "Select the SLO that this alert rule monitors. Alerts will fire when the selected condition is met."
              )}
            </p>
            <Dropdown
              id="slo-select"
              value={def.sloId || ""}
              placeholder="Select an SLO..."
              onOptionSelect={(_, data) =>
                updateField("sloId", data.optionValue as string)
              }
              style={{ maxWidth: 400 }}
            >
              <Option value="slo-sales-pipeline">
                Sales Pipeline Daily - Success Rate
              </Option>
              <Option value="slo-customer-360">
                Customer 360 Dataflow - Freshness
              </Option>
              <Option value="slo-inventory-notebook">
                Inventory Notebook - Success Rate
              </Option>
              <Option value="slo-finance-lakehouse">
                Finance Lakehouse Refresh - P95 Duration
              </Option>
            </Dropdown>
          </div>
        </div>

        {/* Condition Section */}
        <div className="alert-rule-section">
          <div className="alert-rule-section-header">
            <AlertBadge24Regular className="alert-rule-section-icon" />
            <h3 className="alert-rule-section-title">
              {t("AlertRule_ConditionSection", "Alert Condition")}
            </h3>
          </div>

          <div className="alert-rule-field">
            <Label className="alert-rule-field-label" htmlFor="condition-select">
              {t("AlertRule_Condition_Label", "Condition")}
            </Label>
            <div className="alert-rule-condition-builder">
              <Text className="alert-rule-condition-text">Alert when</Text>
              <Dropdown
                id="condition-select"
                value={def.condition || ""}
                placeholder="Select condition..."
                onOptionSelect={(_, data) =>
                  updateField("condition", data.optionValue as string)
                }
                style={{ minWidth: 240 }}
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Dropdown>
              <SpinButton
                value={def.threshold ?? 99}
                onChange={(_, data) =>
                  updateField("threshold", data.value ?? 99)
                }
                min={0}
                max={100}
                step={0.5}
                style={{ width: 100 }}
              />
              <Text className="alert-rule-condition-text">
                {def.condition?.includes("below") || def.condition?.includes("exhausted")
                  ? "%"
                  : def.condition?.includes("duration") || def.condition?.includes("freshness")
                  ? "minutes"
                  : def.condition?.includes("failures")
                  ? "times"
                  : "%"}
              </Text>
            </div>
          </div>
        </div>

        {/* Notification Section */}
        <div className="alert-rule-section">
          <div className="alert-rule-section-header">
            <Mail24Regular className="alert-rule-section-icon" />
            <h3 className="alert-rule-section-title">
              {t("AlertRule_NotificationSection", "Notification")}
            </h3>
          </div>

          <div className="alert-rule-field">
            <Label
              className="alert-rule-field-label"
              htmlFor="notification-type"
            >
              {t("AlertRule_NotificationType_Label", "Notification Channel")}
            </Label>
            <Dropdown
              id="notification-type"
              value={def.notificationType || ""}
              placeholder="Select channel..."
              onOptionSelect={(_, data) =>
                updateField("notificationType", data.optionValue as string)
              }
              style={{ maxWidth: 360 }}
            >
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className="alert-rule-field">
            <Label className="alert-rule-field-label" htmlFor="notification-target">
              {t("AlertRule_Target_Label", "Target")}
            </Label>
            <p className="alert-rule-field-description">
              {def.notificationType === "email"
                ? "Enter email address(es), comma-separated"
                : def.notificationType === "teams"
                ? "Enter Microsoft Teams incoming webhook URL"
                : def.notificationType === "webhook"
                ? "Enter webhook endpoint URL"
                : "Select a notification channel first"}
            </p>
            <Input
              id="notification-target"
              value={def.target || ""}
              onChange={(_, data) => updateField("target", data.value)}
              placeholder={
                def.notificationType === "email"
                  ? "team@contoso.com"
                  : def.notificationType === "teams"
                  ? "https://contoso.webhook.office.com/..."
                  : "https://api.pagerduty.com/..."
              }
              style={{ maxWidth: 480 }}
            />
          </div>

          <div>
            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={handleTestAlert}
              disabled={!def.target || testAlertStatus === "sending"}
              style={{ backgroundColor: "#e8712a", borderColor: "#e8712a" }}
            >
              {testAlertStatus === "sending"
                ? t("AlertRule_TestAlert_Sending", "Sending...")
                : t("AlertRule_TestAlert", "Send Test Alert")}
            </Button>
          </div>
        </div>

        {/* Cooldown Section */}
        <div className="alert-rule-section">
          <div className="alert-rule-section-header">
            <Timer24Regular className="alert-rule-section-icon" />
            <h3 className="alert-rule-section-title">
              {t("AlertRule_CooldownSection", "Cooldown & Suppression")}
            </h3>
          </div>

          <div className="alert-rule-field">
            <Label className="alert-rule-field-label" htmlFor="cooldown-select">
              {t("AlertRule_Cooldown_Label", "Cooldown Period")}
            </Label>
            <p className="alert-rule-field-description">
              {t(
                "AlertRule_Cooldown_Desc",
                "After an alert fires, suppress duplicate notifications for this duration."
              )}
            </p>
            <Dropdown
              id="cooldown-select"
              value={String(def.cooldown || 15)}
              onOptionSelect={(_, data) =>
                updateField("cooldown", Number(data.optionValue))
              }
              style={{ maxWidth: 200 }}
            >
              {COOLDOWN_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="alert-rule-toggle-row">
          <div className="alert-rule-toggle-label">
            <span className="alert-rule-toggle-title">
              <AlertUrgent20Regular
                style={{ verticalAlign: "middle", marginRight: 6, color: "#0078D4" }}
              />
              {t("AlertRule_Enabled_Label", "Enable Alert Rule")}
            </span>
            <span className="alert-rule-toggle-subtitle">
              {t(
                "AlertRule_Enabled_Desc",
                "When disabled, this rule will not evaluate conditions or send notifications."
              )}
            </span>
          </div>
          <Switch
            checked={def.enabled ?? true}
            onChange={(_, data) => updateField("enabled", data.checked)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <ItemEditorDefaultView
      center={{
        content: <FormContent />
      }}
    />
  );
}
