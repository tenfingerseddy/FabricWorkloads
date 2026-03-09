import {
    createWorkloadClient,
    InitParams,
    ItemLikeV2,
    ItemSettingContext,
    NotificationType
} from '@ms-fabric/workload-client';
import { buildActionRoutes, dispatchAction } from './routes';

interface ItemCreationFailureData {
    errorCode?: string;
    resultCode?: string;
}

interface ItemCreationSuccessData {
    item: ItemLikeV2;
}

export async function initialize(params: InitParams) {
    console.log('Observability Workbench Worker: initialization started with params:', params);

    const workloadClient = createWorkloadClient();
    console.log('Observability Workbench Worker: WorkloadClient created');

    const workloadName = process.env.WORKLOAD_NAME;

    // Build the backend action route table for custom operations
    const actionRoutes = buildActionRoutes(workloadClient);
    console.log(`Observability Workbench Worker: ${actionRoutes.size} custom action routes registered`);

    workloadClient.action.onAction(async function ({ action, data }): Promise<any> {
        console.log(`Observability Workbench Worker: action ${action} with data:`, data);

        // ── Fabric platform lifecycle actions ──────────────────────
        switch (action) {
            case 'item.onCreationSuccess': {
                const { item: createdItem } = data as ItemCreationSuccessData;
                const itemTypeName = createdItem.itemType.substring(createdItem.itemType.lastIndexOf('.') + 1);
                const path = `/${itemTypeName}-editor/${createdItem.objectId}`;
                console.log(`Item created successfully, navigating to ${path}`);
                await workloadClient.page.open({
                    workloadName: workloadName,
                    route: path as any,
                });
                return { succeeded: true };
            }

            case 'item.onCreationFailure': {
                const failureData = data as ItemCreationFailureData;
                await workloadClient.notification.open({
                    title: 'Error creating item',
                    notificationType: NotificationType.Error,
                    message: `Failed to create item, error code: ${failureData.errorCode}, result code: ${failureData.resultCode}`
                });
                return;
            }

            case 'getItemSettings': {
                const { item: createdItem } = data as ItemSettingContext;
                const itemTypeName = createdItem.itemType.substring(createdItem.itemType.lastIndexOf('.') + 1);

                return [
                    {
                        name: 'about',
                        displayName: 'About',
                        workloadSettingLocation: {
                            workloadName: workloadName,
                            route: `/${itemTypeName}-about/${createdItem.objectId}`,
                        }
                    },
                    {
                        name: 'settings',
                        displayName: 'Settings',
                        icon: {
                            name: 'apps_20_regular',
                        },
                        workloadSettingLocation: {
                            workloadName: workloadName,
                            route: `/${itemTypeName}-settings/${createdItem.objectId}`,
                        }
                    }
                ];
            }
        }

        // ── Custom backend action routes (item CRUD, jobs, health) ──
        if (actionRoutes.has(action)) {
            return dispatchAction(actionRoutes, action, data);
        }

        // ── Unknown action fallback ────────────────────────────────
        console.warn(`Observability Workbench Worker: unhandled action "${action}"`);
        return {
            success: false,
            error: {
                code: 'UNKNOWN_ACTION',
                message: `No handler for action: ${action}`,
            },
            timestamp: new Date().toISOString(),
        };
    });
}
