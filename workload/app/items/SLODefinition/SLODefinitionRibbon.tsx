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
  History24Regular
} from "@fluentui/react-icons";

/**
 * Props interface for the SLODefinition Ribbon component
 */
export interface SLODefinitionRibbonProps extends PageProps {
  isSaveButtonEnabled?: boolean;
  viewContext: ViewContext;
  saveItemCallback: () => Promise<void>;
  onViewHistory: () => Promise<void>;
  openSettingsCallback: () => Promise<void>;
}

/**
 * SLODefinitionRibbon - Ribbon for SLO Definition editor
 *
 * Provides: Save, View History, Settings
 */
export function SLODefinitionRibbon(props: SLODefinitionRibbonProps) {
  const { viewContext } = props;

  const saveAction = createSaveAction(
    props.saveItemCallback,
    !props.isSaveButtonEnabled
  );

  const settingsAction = createSettingsAction(props.openSettingsCallback);

  const homeToolbarActions: RibbonAction[] = [
    saveAction,
    {
      key: "view-history",
      icon: History24Regular,
      label: "View History",
      onClick: props.onViewHistory,
      testId: "ribbon-view-history-btn",
      tooltip: "View SLO compliance history"
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
