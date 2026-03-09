import { createBrowserHistory } from "history";
import React from "react";
import { createRoot } from 'react-dom/client';

import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { createWorkloadClient, InitParams } from '@ms-fabric/workload-client';

import { App } from "./App";

export async function initialize(params: InitParams) {
    console.log('Observability Workbench UI: initialization started with params:', params);

    const workloadClient = createWorkloadClient();
    console.log('Observability Workbench UI: WorkloadClient created');

    const history = createBrowserHistory();
    console.log('Observability Workbench UI: Browser history created');

    workloadClient.navigation.onNavigate((route) => {
        console.log('Observability Workbench UI: Navigation event:', route);
        history.replace(route.targetUrl);
    });

    workloadClient.action.onAction(async function ({ action, data }) {
        switch (action) {
            case 'item.tab.onInit':
                return { title: 'Observability Workbench' };
            case 'item.tab.canDeactivate':
                return { canDeactivate: true };
            case 'item.tab.onDeactivate':
                return {};
            case 'item.tab.canDestroy':
                return { canDestroy: true };
            case 'item.tab.onDestroy':
                return {};
            case 'item.tab.onDelete':
                return {};
            default:
                throw new Error('Unknown action received');
        }
    });

    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error('Observability Workbench UI: Root element not found!');
        return;
    }

    try {
        const root = createRoot(rootElement);
        root.render(
            <FluentProvider theme={webLightTheme}>
                <App history={history} workloadClient={workloadClient} />
            </FluentProvider>
        );
        console.log('Observability Workbench UI: App rendered successfully');
    } catch (error) {
        console.error('Observability Workbench UI: Error during rendering:', error);
        rootElement.innerHTML = `
            <div style="padding: 20px; color: red; font-family: monospace;">
                <h2>Rendering Error</h2>
                <p>Error: ${error.message}</p>
                <pre>${error.stack}</pre>
            </div>
        `;
    }
}
