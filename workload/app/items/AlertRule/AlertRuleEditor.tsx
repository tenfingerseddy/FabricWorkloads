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
import { AlertRuleDefinition } from "./AlertRuleDefinition";
import { AlertRuleEmptyView } from "./AlertRuleEmptyView";
import { AlertRuleDefaultView } from "./AlertRuleDefaultView";
import { AlertRuleRibbon } from "./AlertRuleRibbon";
import "./AlertRule.scss";

/**
 * Views available for the AlertRule item
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

export function AlertRuleEditor(props: PageProps) {
  const { workloadClient } = props;
  const pageContext = useParams<ContextProps>();
  const { t } = useTranslation();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] = useState<ItemWithDefinition<AlertRuleDefinition>>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.NotSaved);
  const [currentDefinition, setCurrentDefinition] = useState<AlertRuleDefinition>({
    enabled: true,
    cooldown: 15
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
    var LoadedItem: ItemWithDefinition<AlertRuleDefinition> = undefined;
    if (pageContext.itemObjectId) {
      try {
        LoadedItem = await getWorkloadItem<AlertRuleDefinition>(
          workloadClient,
          pageContext.itemObjectId
        );

        if (!LoadedItem.definition) {
          setSaveStatus(SaveStatus.NotSaved);
          LoadedItem = {
            ...LoadedItem,
            definition: {
              enabled: true,
              cooldown: 15
            }
          };
        } else {
          setSaveStatus(SaveStatus.Saved);
        }

        setItem(LoadedItem);
        setCurrentDefinition(LoadedItem.definition || { enabled: true, cooldown: 15 });
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
      successResult = await saveWorkloadItem<AlertRuleDefinition>(
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

  const handleTestAlert = async () => {
    callNotificationOpen(
      workloadClient,
      "Test Alert",
      `Sending test alert to ${currentDefinition.target || "configured target"}...`,
      undefined,
      undefined
    );
  };

  const handleToggleEnabled = () => {
    setCurrentDefinition((prev) => ({ ...prev, enabled: !prev.enabled }));
    setSaveStatus(SaveStatus.NotSaved);
  };

  // Wrapper component for empty view
  const EmptyViewWrapper = () => {
    const { setCurrentView } = useViewNavigation();

    return (
      <AlertRuleEmptyView
        workloadClient={workloadClient}
        item={item}
        onCreateRule={() => {
          setCurrentDefinition((prev) => ({
            ...prev,
            condition: "success_rate_below",
            threshold: 99,
            enabled: true
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
        <AlertRuleDefaultView
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
      const hasCondition = !!item?.definition?.condition;
      const correctView = hasCondition
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
              "AlertRule_Warning",
              "Remember to test your alert rule before enabling it in production."
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
      loadingMessage={t("AlertRuleEditor_Loading", "Loading alert rule...")}
      ribbon={(context) => (
        <AlertRuleRibbon
          {...props}
          viewContext={context}
          isSaveButtonEnabled={isSaveEnabled(context.currentView)}
          saveItemCallback={saveItem}
          onTestAlert={handleTestAlert}
          onToggleEnabled={handleToggleEnabled}
          isEnabled={currentDefinition.enabled ?? true}
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
