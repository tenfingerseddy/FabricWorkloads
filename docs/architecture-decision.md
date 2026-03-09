# Architecture Decision: Extensibility Toolkit over WDK

## Decision
Build the Observability Workbench using the **Fabric Extensibility Toolkit** (TypeScript/React) instead of the original Workload Development Kit (.NET backend + React frontend).

## Rationale

1. **No .NET dependency**: The Extensibility Toolkit is frontend-centric (TypeScript 75%). Our existing MVP is already in TypeScript/Node.js. No .NET SDK installed on dev machine.

2. **Faster iteration**: The toolkit provides a starter kit with HelloWorld reference. CreateNewItem.ps1 generates the 4-file structure automatically. Development loop is `npm start` + dev gateway.

3. **Same Fabric integration**: Items appear natively in Fabric. Jobs visible in monitoring hub. Same manifest system. Same Entra ID auth.

4. **Modern stack**: React 18 + Fluent UI v9 + Redux Toolkit + TypeScript 5 + Webpack 5. Built-in i18n, theming, and accessibility.

5. **Microsoft's direction**: The Extensibility Toolkit is the "modern evolution" of the WDK. Building on the new path reduces roadmap risk.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Fabric Portal                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │    Observability Workbench (Extensibility Toolkit) │
│  │                                                   │ │
│  │  Item Types:                                      │ │
│  │  ├── WorkbenchDashboard (SLO view, incident timeline) │
│  │  ├── AlertRule (alert configuration)              │ │
│  │  └── SLODefinition (SLO configuration)            │ │
│  │                                                   │ │
│  │  Clients → Fabric REST APIs                       │ │
│  │  ├── Job Scheduler (collect job instances)        │ │
│  │  ├── Items API (workspace/item inventory)         │ │
│  │  └── KQL (query Eventhouse for stored events)     │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│  Observability Data Plane (existing Fabric items)      │
│                                                        │
│  ├── EH_Observability (Eventhouse / KQL Database)     │
│  │   ├── FabricEvents table                           │
│  │   ├── EventCorrelations table                      │
│  │   ├── SloDefinitions table                         │
│  │   ├── SloSnapshots table                           │
│  │   ├── AlertRules table                             │
│  │   └── WorkspaceInventory table                     │
│  │                                                     │
│  └── LH_ObsArchive (Lakehouse — cold storage)         │
└──────────────────────────────────────────────────────┘
```

## Item Types

### 1. WorkbenchDashboard
- **Editor**: SLO status dashboard, incident timeline, search
- **Ribbon**: Refresh, Time Range, Export, Settings
- **Views**: Empty (onboarding), Default (dashboard), Detail (incident drill-down)
- **Definition**: { workspaceIds, timeRange, pinnedSLOs, filters }

### 2. AlertRule
- **Editor**: Alert condition builder, notification target config
- **Ribbon**: Save, Test Alert, Enable/Disable
- **Views**: Empty (create first rule), Default (rule editor)
- **Definition**: { sloId, condition, threshold, notificationType, target, cooldown }

### 3. SLODefinition
- **Editor**: SLO target configuration, error budget visualization
- **Ribbon**: Save, View History, Settings
- **Views**: Empty (define first SLO), Default (SLO config + status)
- **Definition**: { itemId, metricType, targetValue, warningThreshold, evaluationWindow }

## Data Flow

1. **Ingestion**: A scheduled Fabric Notebook (or our Node.js collector running externally) polls the Job Scheduler API every 5 minutes, enriches events, and ingests into EH_Observability.

2. **Frontend Query**: The workload frontend queries EH_Observability directly via KQL to render dashboards, SLO status, and incident timelines.

3. **Alerting**: A scheduled Notebook evaluates SLO metrics against alert rules and fires notifications (email, Teams webhook).

## Migration Path from MVP

| MVP Component | Workload Equivalent |
|---------------|---------------------|
| src/fabric-client.ts | Workload/app/clients/ (extends FabricPlatformClient) |
| src/collector.ts | Fabric Notebook (scheduled, runs in capacity) |
| src/dashboard.ts | WorkbenchDashboard item editor (React) |
| src/alerts.ts | AlertRule item + Fabric Notebook evaluator |
| src/store.ts | Eventhouse KQL (already set up) |
| CLI output | Fabric portal iframe (Fluent UI) |
