import React from "react";
import { PageProps } from "../../App";
import {
  Ribbon,
  RibbonAction,
  RibbonActionButton,
  createSaveAction,
  createSettingsAction
} from "../../components/ItemEditor";
import { ViewContext } from "../../components";
import {
  AlertUrgent24Regular,
  ToggleLeft24Regular
} from "@fluentui/react-icons";

/**
 * Props interface for the AlertRule Ribbon component
 */
export interface AlertRuleRibbonProps extends PageProps {
  isSaveButtonEnabled?: boolean;
  viewContext: ViewContext;
  saveItemCallback: () => Promise<void>;
  onTestAlert: () => Promise<void>;
  onToggleEnabled: () => void;
  isEnabled: boolean;
  openSettingsCallback: () => Promise<void>;
}

/**
 * AlertRuleRibbon - Ribbon for Alert Rule editor
 *
 * Provides: Save, Test Alert, Enable/Disable toggle
 */
export function AlertRuleRibbon(props: AlertRuleRibbonProps) {
  const { viewContext } = props;

  const saveAction = createSaveAction(
    props.saveItemCallback,
    !props.isSaveButtonEnabled
  );

  const settingsAction = createSettingsAction(props.openSettingsCallback);

  const homeToolbarActions: RibbonAction[] = [
    saveAction,
    {
      key: "test-alert",
      icon: AlertUrgent24Regular,
      label: "Test Alert",
      onClick: props.onTestAlert,
      testId: "ribbon-test-alert-btn",
      tooltip: "Send a test alert to verify notification delivery"
    },
    {
      key: "toggle-enabled",
      icon: ToggleLeft24Regular,
      label: props.isEnabled ? "Disable Rule" : "Enable Rule",
      onClick: async () => props.onToggleEnabled(),
      testId: "ribbon-toggle-btn",
      tooltip: props.isEnabled ? "Disable this alert rule" : "Enable this alert rule"
    },
    settingsAction
  ];

  const rightActionButtons: RibbonActionButton[] = [];

  return (
    <Ribbon
      homeToolbarActions={homeToolbarActions}
      additionalToolbars={[]}
      rightActionButtons={rightActionButtons}
      viewContext={viewContext}
    />
  );
}
