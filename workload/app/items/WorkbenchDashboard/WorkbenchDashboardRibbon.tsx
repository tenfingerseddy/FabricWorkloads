import React from "react";
import { PageProps } from "../../App";
import {
  Ribbon,
  RibbonAction,
  RibbonActionButton,
  createSettingsAction
} from "../../components/ItemEditor";
import { ViewContext } from "../../components";
import {
  ArrowSync24Regular,
  ArrowDownload24Regular,
  Clock24Regular
} from "@fluentui/react-icons";

/**
 * Props interface for the WorkbenchDashboard Ribbon component
 */
export interface WorkbenchDashboardRibbonProps extends PageProps {
  viewContext: ViewContext;
  onRefresh: () => Promise<void>;
  onTimeRangeChange: (range: string) => void;
  onExport: () => Promise<void>;
  openSettingsCallback: () => Promise<void>;
}

/**
 * WorkbenchDashboardRibbon - Ribbon for the Observability Workbench Dashboard
 *
 * Provides: Refresh, Time Range dropdown, Export, Settings
 */
export function WorkbenchDashboardRibbon(props: WorkbenchDashboardRibbonProps) {
  const { viewContext } = props;

  const settingsAction = createSettingsAction(props.openSettingsCallback);

  const homeToolbarActions: RibbonAction[] = [
    {
      key: "refresh-dashboard",
      icon: ArrowSync24Regular,
      label: "Refresh",
      onClick: props.onRefresh,
      testId: "ribbon-refresh-btn",
      tooltip: "Refresh all dashboard data"
    },
    {
      key: "time-range",
      icon: Clock24Regular,
      label: "Time Range",
      onClick: () => props.onTimeRangeChange("24h"),
      testId: "ribbon-time-range-btn",
      tooltip: "Change the dashboard time range"
    },
    settingsAction
  ];

  const rightActionButtons: RibbonActionButton[] = [
    {
      key: "export-dashboard",
      icon: ArrowDownload24Regular,
      label: "Export",
      onClick: props.onExport,
      testId: "ribbon-export-btn",
      tooltip: "Export dashboard data"
    }
  ];

  return (
    <Ribbon
      homeToolbarActions={homeToolbarActions}
      additionalToolbars={[]}
      rightActionButtons={rightActionButtons}
      viewContext={viewContext}
    />
  );
}
