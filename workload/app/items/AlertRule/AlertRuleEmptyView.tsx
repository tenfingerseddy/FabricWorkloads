import React from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { AlertRuleDefinition } from "./AlertRuleDefinition";
import { ItemEditorEmptyView, EmptyStateTask } from "../../components/ItemEditor";
import {
  AlertBadge24Regular,
  Mail24Regular,
  Settings24Regular
} from "@fluentui/react-icons";
import "./AlertRule.scss";

interface AlertRuleEmptyViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<AlertRuleDefinition>;
  onCreateRule: () => void;
}

/**
 * AlertRuleEmptyView - Onboarding screen for Alert Rules
 *
 * Displays "Create your first alert rule" CTA with guided setup tasks.
 */
export function AlertRuleEmptyView({
  workloadClient,
  item,
  onCreateRule
}: AlertRuleEmptyViewProps) {
  const { t } = useTranslation();

  const tasks: EmptyStateTask[] = [
    {
      id: "create-rule",
      label: t("AlertRule_Empty_Create", "Create Alert Rule"),
      icon: AlertBadge24Regular,
      description: t(
        "AlertRule_Empty_Create_Desc",
        "Define alert conditions based on SLO breaches — trigger when success rate drops below a threshold, latency exceeds a target, or data freshness is stale."
      ),
      onClick: onCreateRule
    },
    {
      id: "configure-notification",
      label: t("AlertRule_Empty_Notification", "Configure Notifications"),
      icon: Mail24Regular,
      description: t(
        "AlertRule_Empty_Notification_Desc",
        "Choose how you want to be notified: email, Microsoft Teams channel, or webhook integration for PagerDuty, Slack, and more."
      ),
      onClick: () => {}
    },
    {
      id: "tune-settings",
      label: t("AlertRule_Empty_Settings", "Tune Alert Settings"),
      icon: Settings24Regular,
      description: t(
        "AlertRule_Empty_Settings_Desc",
        "Set cooldown periods and severity levels to reduce noise and ensure you only get alerted when it matters."
      ),
      onClick: () => {}
    }
  ];

  return (
    <ItemEditorEmptyView
      title={t("AlertRule_Empty_Title", "Create Your First Alert Rule")}
      description={t(
        "AlertRule_Empty_Description",
        "Get notified when your Fabric workloads deviate from their SLO targets. Alert rules continuously evaluate conditions and send notifications through your preferred channel."
      )}
      imageSrc="/assets/items/AlertRule/EditorEmpty.svg"
      imageAlt="Alert rule illustration"
      tasks={tasks}
    />
  );
}
