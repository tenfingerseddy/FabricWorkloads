import React from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { WorkbenchDashboardDefinition } from "./WorkbenchDashboardDefinition";
import { ItemEditorEmptyView, EmptyStateTask } from "../../components/ItemEditor";
import {
  PlugConnected24Regular,
  DataUsage24Regular,
  AlertBadge24Regular
} from "@fluentui/react-icons";
import "./WorkbenchDashboard.scss";

interface WorkbenchDashboardEmptyViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<WorkbenchDashboardDefinition>;
  onConnectWorkspace: () => void;
}

/**
 * WorkbenchDashboardEmptyView - Onboarding screen for the Observability Dashboard
 *
 * Displays "Connect your first workspace" CTA and guided onboarding tasks
 * to help users set up their observability monitoring.
 */
export function WorkbenchDashboardEmptyView({
  workloadClient,
  item,
  onConnectWorkspace
}: WorkbenchDashboardEmptyViewProps) {
  const { t } = useTranslation();

  const tasks: EmptyStateTask[] = [
    {
      id: "connect-workspace",
      label: t("WorkbenchDashboard_Empty_Connect", "Connect a Workspace"),
      icon: PlugConnected24Regular,
      description: t(
        "WorkbenchDashboard_Empty_Connect_Desc",
        "Select one or more Fabric workspaces to monitor. The dashboard will aggregate pipeline, dataflow, and notebook execution data across all connected workspaces."
      ),
      onClick: onConnectWorkspace
    },
    {
      id: "define-slos",
      label: t("WorkbenchDashboard_Empty_SLOs", "Define SLOs"),
      icon: DataUsage24Regular,
      description: t(
        "WorkbenchDashboard_Empty_SLOs_Desc",
        "Set Service Level Objectives for success rate, latency, and data freshness. SLO cards will appear on the dashboard once configured."
      ),
      onClick: () => {}
    },
    {
      id: "configure-alerts",
      label: t("WorkbenchDashboard_Empty_Alerts", "Configure Alerts"),
      icon: AlertBadge24Regular,
      description: t(
        "WorkbenchDashboard_Empty_Alerts_Desc",
        "Set up alert rules to get notified when SLOs are breached. Alerts can be sent via email, Teams, or webhook."
      ),
      onClick: () => {}
    }
  ];

  return (
    <ItemEditorEmptyView
      title={t(
        "WorkbenchDashboard_Empty_Title",
        "Welcome to the Observability Workbench"
      )}
      description={t(
        "WorkbenchDashboard_Empty_Description",
        "Monitor the health of your Microsoft Fabric data estate. Connect workspaces to track pipeline execution, data freshness, and SLO compliance from a single dashboard."
      )}
      imageSrc="/assets/items/WorkbenchDashboard/EditorEmpty.svg"
      imageAlt="Observability dashboard illustration"
      tasks={tasks}
    />
  );
}
