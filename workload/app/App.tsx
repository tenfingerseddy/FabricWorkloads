import React from "react";
import { Route, Router, Switch } from "react-router-dom";
import { History } from "history";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { WorkbenchDashboardEditor } from "./items/WorkbenchDashboard";
import { AlertRuleEditor } from "./items/AlertRule";
import { SLODefinitionEditor } from "./items/SLODefinition";

/*
    Observability Workbench - App Router
    Routes for all three item type editors:
      - WorkbenchDashboard
      - AlertRule
      - SLODefinition
*/

interface AppProps {
    history: History;
    workloadClient: WorkloadClientAPI;
}

export interface PageProps {
    workloadClient: WorkloadClientAPI;
    history?: History;
}

export interface ContextProps {
    itemObjectId?: string;
    workspaceObjectId?: string;
    source?: string;
}

export interface SharedState {
    message: string;
}

export function App({ history, workloadClient }: AppProps) {
    console.log("Observability Workbench App rendering with history:", history);
    console.log("Current location:", history.location);

    return (
        <Router history={history}>
            {/* Root route for health check */}
            <Route exact path="/">
                <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
                    <h1>Observability Workbench</h1>
                    <p>Current URL: {window.location.href}</p>
                    <p>Workload Name: {process.env.WORKLOAD_NAME}</p>
                </div>
            </Route>
            <Switch>
                {/* WorkbenchDashboard Editor */}
                <Route path="/WorkbenchDashboard-editor/:itemObjectId">
                    <WorkbenchDashboardEditor
                        workloadClient={workloadClient}
                        data-testid="WorkbenchDashboard-editor"
                    />
                </Route>

                {/* AlertRule Editor */}
                <Route path="/AlertRule-editor/:itemObjectId">
                    <AlertRuleEditor
                        workloadClient={workloadClient}
                        data-testid="AlertRule-editor"
                    />
                </Route>

                {/* SLODefinition Editor */}
                <Route path="/SLODefinition-editor/:itemObjectId">
                    <SLODefinitionEditor
                        workloadClient={workloadClient}
                        data-testid="SLODefinition-editor"
                    />
                </Route>
            </Switch>
        </Router>
    );
}
