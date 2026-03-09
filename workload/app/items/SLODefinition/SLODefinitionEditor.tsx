import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody
} from "@fluentui/react-components";
import { NotificationType } from "@ms-fabric/workload-client";
import {
  Dismiss20Regular,
  Warning20Filled
} from "@fluentui/react-icons";
import { PageProps, ContextProps } from "../../App";
import { ItemWithDefinition, getWorkloadItem, callGetItem, saveWorkloadItem } from "../../controller/ItemCRUDController";
import { callOpenSettings } from "../../controller/SettingsController";
import { callNotificationOpen } from "../../controller/NotificationController";
import { ItemEditor, useViewNavigation, RegisteredNotification } from "../../components/ItemEditor";
import { SLODefinitionDefinition } from "./SLODefinitionDefinition";
import { SLODefinitionEmptyView } from "./SLODefinitionEmptyView";
import { SLODefinitionDefaultView } from "./SLODefinitionDefaultView";
import { SLODefinitionRibbon } from "./SLODefinitionRibbon";
import "./SLODefinition.scss";

/**
 * Views available for the SLODefinition item
 */
export const EDITOR_VIEW_TYPES = {
  EMPTY: "empty",
  DEFAULT: "default"
} as const;

const enum SaveStatus {
  NotSaved = "NotSaved",
  Saving = "Saving",
  Saved = "Saved"
}

export function SLODefinitionEditor(props: PageProps) {
  const { workloadClient } = props;
  const pageContext = useParams<ContextProps>();
  const { t } = useTranslation();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] = useState<ItemWithDefinition<SLODefinitionDefinition>>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.NotSaved);
  const [currentDefinition, setCurrentDefinition] = useState<SLODefinitionDefinition>({
    targetValue: 99.5,
    warningThreshold: 99.0,
    evaluationWindow: "7d"
  });
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [viewSetter, setViewSetter] = useState<((view: string) => void) | null>(null);

  const { pathname } = useLocation();

  async function loadDataFromUrl(pageContext: ContextProps, pathname: string): Promise<void> {
    if (pageContext.itemObjectId && item && item.id === pageContext.itemObjectId) {
      console.log(`Item ${pageContext.itemObjectId} is already loaded, skipping reload`);
      return;
    }

    setIsLoading(true);
    var LoadedItem: ItemWithDefinition<SLODefinitionDefinition> = undefined;
    if (pageContext.itemObjectId) {
      try {
        LoadedItem = await getWorkloadItem<SLODefinitionDefinition>(
          workloadClient,
          pageContext.itemObjectId
        );

        if (!LoadedItem.definition) {
          setSaveStatus(SaveStatus.NotSaved);
          LoadedItem = {
            ...LoadedItem,
            definition: {
              targetValue: 99.5,
              warningThreshold: 99.0,
              evaluationWindow: "7d"
            }
          };
        } else {
          setSaveStatus(SaveStatus.Saved);
        }

        setItem(LoadedItem);
        setCurrentDefinition(LoadedItem.definition || {
          targetValue: 99.5,
          warningThreshold: 99.0,
          evaluationWindow: "7d"
        });
      } catch (error) {
        setItem(undefined);
      }
    } else {
      console.log(`non-editor context. Current Path: ${pathname}`);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadDataFromUrl(pageContext, pathname);
  }, [pageContext, pathname]);

  const handleOpenSettings = async () => {
    if (item) {
      try {
        const item_res = await callGetItem(workloadClient, item.id);
        await callOpenSettings(workloadClient, item_res.item, "About");
      } catch (error) {
        console.error("Failed to open settings:", error);
      }
    }
  };

  async function saveItem() {
    setSaveStatus(SaveStatus.Saving);
    item.definition = { ...currentDefinition };
    setCurrentDefinition(item.definition);

    let successResult;
    let errorMessage = "";

    try {
      successResult = await saveWorkloadItem<SLODefinitionDefinition>(
        workloadClient,
        item
      );
    } catch (error) {
      errorMessage = error?.message;
    }

    const wasSaved = Boolean(successResult);

    if (wasSaved) {
      setSaveStatus(SaveStatus.Saved);
      callNotificationOpen(
        workloadClient,
        t("ItemEditor_Saved_Notification_Title"),
        t("ItemEditor_Saved_Notification_Text", { itemName: item.displayName }),
        undefined,
        undefined
      );
    } else {
      setSaveStatus(SaveStatus.NotSaved);
      const failureMessage = errorMessage
        ? `${t("ItemEditor_SaveFailed_Notification_Text", { itemName: item.displayName })} ${errorMessage}.`
        : t("ItemEditor_SaveFailed_Notification_Text", { itemName: item.displayName });

      callNotificationOpen(
        workloadClient,
        t("ItemEditor_SaveFailed_Notification_Title"),
        failureMessage,
        NotificationType.Error,
        undefined
      );
    }
  }

  const isSaveEnabled = (currentView: string) => {
    if (currentView === EDITOR_VIEW_TYPES.EMPTY) return false;
    if (saveStatus === SaveStatus.Saved) return false;
    return true;
  };

  const handleViewHistory = async () => {
    callNotificationOpen(
      workloadClient,
      "SLO History",
      "Opening SLO compliance history view...",
      undefined,
      undefined
    );
  };

  // Wrapper component for empty view
  const EmptyViewWrapper = () => {
    const { setCurrentView } = useViewNavigation();

    return (
      <SLODefinitionEmptyView
        workloadClient={workloadClient}
        item={item}
        onDefineSLO={() => {
          setCurrentDefinition((prev) => ({
            ...prev,
            metricType: "success_rate",
            targetValue: 99.5,
            warningThreshold: 99.0,
            evaluationWindow: "7d"
          }));
          setSaveStatus(SaveStatus.NotSaved);
          setCurrentView(EDITOR_VIEW_TYPES.DEFAULT);
        }}
      />
    );
  };

  const views = [
    {
      name: EDITOR_VIEW_TYPES.EMPTY,
      component: <EmptyViewWrapper />
    },
    {
      name: EDITOR_VIEW_TYPES.DEFAULT,
      component: (
        <SLODefinitionDefaultView
          workloadClient={workloadClient}
          item={item}
          definition={currentDefinition}
          onDefinitionChange={(newDef) => {
            setCurrentDefinition(newDef);
            setSaveStatus(SaveStatus.NotSaved);
          }}
        />
      )
    }
  ];

  useEffect(() => {
    if (!isLoading && item && viewSetter) {
      const hasMetric = !!item?.definition?.metricType;
      const correctView = hasMetric
        ? EDITOR_VIEW_TYPES.DEFAULT
        : EDITOR_VIEW_TYPES.EMPTY;
      viewSetter(correctView);
    }
  }, [isLoading, item, viewSetter]);

  const notifications: RegisteredNotification[] = [
    {
      name: "default-warning",
      showInViews: [EDITOR_VIEW_TYPES.DEFAULT],
      component: showWarning ? (
        <MessageBar intent="warning" icon={<Warning20Filled />}>
          <MessageBarBody>
            {t(
              "SLODefinition_Warning",
              "SLO status data is illustrative. Save this definition to begin tracking real metrics."
            )}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                appearance="transparent"
                icon={<Dismiss20Regular />}
                aria-label={t("MessageBar_Dismiss", "Dismiss")}
                onClick={() => setShowWarning(false)}
              />
            }
          />
        </MessageBar>
      ) : null
    }
  ];

  return (
    <ItemEditor
      isLoading={isLoading}
      loadingMessage={t(
        "SLODefinitionEditor_Loading",
        "Loading SLO definition..."
      )}
      ribbon={(context) => (
        <SLODefinitionRibbon
          {...props}
          viewContext={context}
          isSaveButtonEnabled={isSaveEnabled(context.currentView)}
          saveItemCallback={saveItem}
          onViewHistory={handleViewHistory}
          openSettingsCallback={handleOpenSettings}
        />
      )}
      messageBar={notifications}
      views={views}
      viewSetter={(setCurrentView) => {
        if (!viewSetter) {
          setViewSetter(() => setCurrentView);
        }
      }}
    />
  );
}
