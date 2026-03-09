# Getting Started — Observability Workbench Development

## Prerequisites

### Azure / Fabric Requirements
1. **Azure subscription** with an active Fabric capacity (F64+ for production, F2/trial for development)
2. **Fabric tenant admin access** — to enable workload development settings
3. **Entra ID app registration** — for workload authentication

### Development Environment
1. **Visual Studio 2022** (17.8+) or **VS Code** with C# Dev Kit
2. **.NET 8 SDK** — workload backend runtime
3. **Node.js 20 LTS** + **npm** — workload frontend build
4. **Fabric Workload Development Kit** — Microsoft NuGet packages
5. **Git** — version control

---

## Step 1: Enable Workload Development in Fabric

1. Go to Fabric Admin Portal → Tenant Settings
2. Find **"Workload Development"** section
3. Enable for your security group
4. Note your **Capacity ID** — you'll need this for local development

## Step 2: Register Entra ID Application

```bash
# Create app registration
az ad app create \
  --display-name "Observability Workbench Dev" \
  --sign-in-audience AzureADMyOrg

# Note the Application (client) ID and Directory (tenant) ID

# Add required API permissions:
# - Microsoft Fabric → Fabric.Read.All
# - Microsoft Fabric → Item.ReadWrite.All
# - Microsoft Graph → User.Read
```

Configure:
- Redirect URI: `https://localhost:7000/auth/callback` (for local dev)
- Client secret or certificate for backend auth

## Step 3: Scaffold Workload Project

```bash
# Create solution structure
mkdir observability-workbench && cd observability-workbench

# Backend (.NET 8)
dotnet new webapi -n ObsWorkbench.Backend
cd ObsWorkbench.Backend
dotnet add package Microsoft.Fabric.Workload.SDK --prerelease
cd ..

# Frontend (React/TypeScript)
npx create-react-app obs-workbench-frontend --template typescript
cd obs-workbench-frontend
npm install @fabric/workload-client-sdk
cd ..
```

## Step 4: Configure Workload Manifest

Create `workload-manifest.json`:
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/workload-manifest.json",
  "name": "ObservabilityWorkbench",
  "version": "0.1.0",
  "displayName": "Observability Workbench",
  "description": "Enterprise observability for Microsoft Fabric",
  "publisher": "AI Agency",
  "itemTypes": [
    {
      "name": "ObservabilityWorkbench.WorkbenchItem",
      "displayName": "Observability Workbench",
      "description": "Long-retention monitoring with cross-item correlation",
      "supportedInMonitoringHub": true,
      "jobTypes": [
        {
          "name": "Ingest",
          "displayName": "Ingest Monitoring Events",
          "description": "Pull events from monitoring hub and workspace monitoring"
        },
        {
          "name": "Correlate",
          "displayName": "Correlate Events",
          "description": "Build dependency chains across items"
        },
        {
          "name": "AlertEvaluate",
          "displayName": "Evaluate Alert Rules",
          "description": "Check SLOs and fire alerts"
        },
        {
          "name": "Archive",
          "displayName": "Archive to Cold Storage",
          "description": "Move aged events to Lakehouse"
        },
        {
          "name": "SLOCompute",
          "displayName": "Compute SLO Metrics",
          "description": "Recalculate SLO status and error budgets"
        }
      ],
      "editor": {
        "path": "/editor",
        "icon": {
          "name": "ObservabilityIcon"
        }
      }
    }
  ]
}
```

## Step 5: Local Development Loop

```bash
# Terminal 1: Start backend
cd ObsWorkbench.Backend
dotnet run --urls https://localhost:5001

# Terminal 2: Start frontend
cd obs-workbench-frontend
npm start  # Runs on https://localhost:3000

# Terminal 3: Register local workload with Fabric
# Use the Fabric Workload Development Kit CLI to connect
# your local services to your Fabric capacity
```

## Step 6: First Deployment Test

1. Open Fabric portal → your development workspace
2. Verify "Observability Workbench" appears in item creation menu
3. Create a new Workbench item
4. Verify the editor loads in the Fabric iframe
5. Trigger an Ingest job and verify it appears in Monitoring Hub

---

## Development Workflow

```
Feature Branch → Local Dev/Test → PR Review → Staging Capacity → Production
```

1. **Local**: Develop against local backend + frontend connected to dev capacity
2. **Test**: Deploy workload package to staging capacity, run integration tests
3. **Stage**: Deploy to pre-production capacity with real workload data
4. **Production**: Publish to Azure Marketplace / AppSource

---

## Key References
- [Fabric Workload Development Kit](https://learn.microsoft.com/en-us/fabric/workload-development-kit/)
- [Fabric REST APIs](https://learn.microsoft.com/en-us/rest/api/fabric/)
- [Monitoring Hub API](https://learn.microsoft.com/en-us/fabric/admin/monitoring-hub)
- [Eventhouse / KQL Database](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/)
