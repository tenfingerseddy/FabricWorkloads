import React from "react";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemWithDefinition } from "../../controller/ItemCRUDController";
import { SLODefinitionDefinition } from "./SLODefinitionDefinition";
import { ItemEditorEmptyView, EmptyStateTask } from "../../components/ItemEditor";
import {
  DataUsage24Regular,
  TargetArrow24Regular,
  ChartMultiple24Regular
} from "@fluentui/react-icons";
import "./SLODefinition.scss";

interface SLODefinitionEmptyViewProps {
  workloadClient: WorkloadClientAPI;
  item?: ItemWithDefinition<SLODefinitionDefinition>;
  onDefineSLO: () => void;
}

/**
 * SLODefinitionEmptyView - Onboarding screen for SLO Definitions
 *
 * Displays "Define your first SLO" CTA with guided setup tasks.
 */
export function SLODefinitionEmptyView({
  workloadClient,
  item,
  onDefineSLO
}: SLODefinitionEmptyViewProps) {
  const { t } = useTranslation();

  const tasks: EmptyStateTask[] = [
    {
      id: "define-slo",
      label: t("SLODefinition_Empty_Define", "Define an SLO"),
      icon: TargetArrow24Regular,
      description: t(
        "SLODefinition_Empty_Define_Desc",
        "Select a Fabric item and metric type, then set a target value. For example: Pipeline X should have a success rate of at least 99.5% over a 7-day rolling window."
      ),
      onClick: onDefineSLO
    },
    {
      id: "set-thresholds",
      label: t("SLODefinition_Empty_Thresholds", "Set Warning Thresholds"),
      icon: DataUsage24Regular,
      description: t(
        "SLODefinition_Empty_Thresholds_Desc",
        "Configure warning thresholds to catch issues before they become SLO breaches. Warning alerts fire early so you can take action proactively."
      ),
      onClick: () => {}
    },
    {
      id: "track-budget",
      label: t("SLODefinition_Empty_Budget", "Track Error Budget"),
      icon: ChartMultiple24Regular,
      description: t(
        "SLODefinition_Empty_Budget_Desc",
        "The error budget visualization shows how much failure you can tolerate within the evaluation window. Once the budget is exhausted, the SLO is breached."
      ),
      onClick: () => {}
    }
  ];

  return (
    <ItemEditorEmptyView
      title={t("SLODefinition_Empty_Title", "Define Your First SLO")}
      description={t(
        "SLODefinition_Empty_Description",
        "Service Level Objectives (SLOs) define the reliability targets for your Fabric items. Track success rate, execution duration, and data freshness against measurable goals."
      )}
      imageSrc="/assets/items/SLODefinition/EditorEmpty.svg"
      imageAlt="SLO definition illustration"
      tasks={tasks}
    />
  );
}
