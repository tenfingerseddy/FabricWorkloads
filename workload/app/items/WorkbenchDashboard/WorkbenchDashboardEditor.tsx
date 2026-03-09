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
import { WorkbenchDashboardDefinition } from "./WorkbenchDashboardDefinition";
import { WorkbenchDashboardEmptyView } from "./WorkbenchDashboardEmptyView";
import { WorkbenchDashboardDefaultView } from "./WorkbenchDashboardDefaultView";
import { WorkbenchDashboardRibbon } from "./WorkbenchDashboardRibbon";
import "./WorkbenchDashboard.scss";

/**
 * Views available for the WorkbenchDashboard item
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

export function WorkbenchDashboardEditor(props: PageProps) {
  const { workloadClient } = props;
  const pageContext = useParams<ContextProps>();
  const { t } = useTranslation();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] = useState<ItemWithDefinition<WorkbenchDashboardDefinition>>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.NotSaved);
  const [currentDefinition, setCurrentDefinition] = useState<WorkbenchDashboardDefinition>({
    workspaceIds: [],
    timeRange: "24h",
    pinnedSLOs: [],
    filters: {}
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
    var LoadedItem: ItemWithDefinition<WorkbenchDashboardDefinition> = undefined;
    if (pageContext.itemObjectId) {
      try {
        LoadedItem = await getWorkloadItem<WorkbenchDashboardDefinition>(
          workloadClient,
          pageContext.itemObjectId
        );

        if (!LoadedItem.definition) {
          setSaveStatus(SaveStatus.NotSaved);
          LoadedItem = {
            ...LoadedItem,
            definition: {
              workspaceIds: [],
              timeRange: "24h",
              pinnedSLOs: [],
              filters: {}
            }
          };
        } else {
          setSaveStatus(SaveStatus.Saved);
        }

        setItem(LoadedItem);
        setCurrentDefinition(LoadedItem.definition || {
          workspaceIds: [],
          timeRange: "24h",
          pinnedSLOs: [],
          filters: {}
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
      successResult = await saveWorkloadItem<WorkbenchDashboardDefinition>(
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

  const handleRefresh = async () => {
    // Trigger a data reload
    if (pageContext.itemObjectId) {
      setIsLoading(true);
      try {
        const LoadedItem = await getWorkloadItem<WorkbenchDashboardDefinition>(
          workloadClient,
          pageContext.itemObjectId
        );
        setItem(LoadedItem);
        if (LoadedItem.definition) {
          setCurrentDefinition(LoadedItem.definition);
        }
      } catch (error) {
        console.error("Failed to refresh:", error);
      }
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    callNotificationOpen(
      workloadClient,
      "Export",
      "Dashboard data export started. You will be notified when it completes.",
      undefined,
      undefined
    );
  };

  // Wrapper component for empty view that uses navigation hook
  const EmptyViewWrapper = () => {
    const { setCurrentView } = useViewNavigation();

    return (
      <WorkbenchDashboardEmptyView
        workloadClient={workloadClient}
        item={item}
        onConnectWorkspace={() => {
          setCurrentDefinition((prev) => ({
            ...prev,
            workspaceIds: ["workspace-1"]
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
        <WorkbenchDashboardDefaultView
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
      const hasWorkspaces =
        item?.definition?.workspaceIds && item.definition.workspaceIds.length > 0;
      const correctView = hasWorkspaces
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
              "WorkbenchDashboard_Warning",
              "Dashboard data is sample data. Connect workspaces to see real metrics."
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
        "WorkbenchDashboardEditor_Loading",
        "Loading dashboard..."
      )}
      ribbon={(context) => (
        <WorkbenchDashboardRibbon
          {...props}
          viewContext={context}
          onRefresh={handleRefresh}
          onTimeRangeChange={(range) => {
            setCurrentDefinition((prev) => ({ ...prev, timeRange: range }));
            setSaveStatus(SaveStatus.NotSaved);
          }}
          onExport={handleExport}
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
