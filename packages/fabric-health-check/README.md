# Fabric Health Check

> Quick health check for your Microsoft Fabric environment. Zero dependencies — just run it.

[![npm version](https://img.shields.io/npm/v/fabric-health-check.svg)](https://www.npmjs.com/package/fabric-health-check)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
FABRIC_TENANT_ID=xxx FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=xxx npx fabric-health-check
```

That's it. No install needed.

## What It Does

Fabric Health Check scans your Microsoft Fabric environment and reports:

- **Workspace inventory** — lists all workspaces and their items (lakehouses, notebooks, pipelines, etc.)
- **Job health** — checks recent job runs and calculates success rates
- **Failure detection** — flags any items with >50% failure rate
- **Idle workspace detection** — identifies workspaces with no recent activity
- **Health score** — computes an overall 0–100 health score

## Setup

### 1. Create a Service Principal

You need an Azure AD app registration (service principal) with access to the Fabric API:

1. Go to [Azure Portal > App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New Registration**
3. Name it (e.g., "Fabric Health Check")
4. Under **API permissions**, add `https://api.fabric.microsoft.com/.default` (Application permission)
5. Grant admin consent
6. Create a client secret under **Certificates & secrets**

### 2. Grant Workspace Access

In the Fabric Admin Portal, ensure the service principal has access to the workspaces you want to scan. You can either:

- Add the service principal as a workspace member, or
- Enable "Service principals can use Fabric APIs" in the tenant admin settings

### 3. Set Environment Variables

```bash
export FABRIC_TENANT_ID="your-azure-ad-tenant-id"
export FABRIC_CLIENT_ID="your-app-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
```

### 4. Run

```bash
npx fabric-health-check
```

## Sample Output

```
┌──────────────────────────────────────────────────────────┐
│ Fabric Health Check                                      │
│ Quick health scan for Microsoft Fabric environments      │
└──────────────────────────────────────────────────────────┘

  ✔ Authentication successful

  Workspaces
  ────────────────────────────────────────────────────────

  ✔ Production Analytics
    Lakehouse                 3
    Notebook                  12
    DataPipeline              8
    SemanticModel             5
    Report                    15

    Recent Jobs: 45 total  ✔ 42 passed  ✘ 3 failed  Success: 93%

  ✘ Data Engineering Dev
    Lakehouse                 2
    Notebook                  8
    DataPipeline              4

    Recent Jobs: 20 total  ✔ 10 passed  ✘ 10 failed  Success: 50%
    ✘ Daily ETL (DataPipeline): 75% failure rate (6/8)

  ⚠  Issues Found (2)
  ────────────────────────────────────────────────────────

  Critical:
    ✘ [Data Engineering Dev] "Daily ETL" (DataPipeline) has 75% failure rate (6/8 jobs failed)

  Warnings:
    ⚠  [Sandbox] No recent job activity found (5 items exist but none have run recently)

┌──────────────────────────────────────────────────────────┐
│ Health Check Summary                                     │
├──────────────────────────────────────────────────────────┤
│ Workspaces scanned:    3                                 │
│ Total items:           57                                │
│ Recent jobs:           65                                │
│ Job success rate:      80%                               │
├──────────────────────────────────────────────────────────┤
│ Health Score:  ████████████████░░░░  80/100 Healthy      │
└──────────────────────────────────────────────────────────┘

  For deeper analysis, capacity planning, and automated monitoring:
  https://github.com/tenfingerseddy/FabricWorkloads
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | Healthy — all checks passed |
| `1`  | Issues found — health check completed but problems were detected |
| `2`  | Auth failure — could not authenticate (missing/invalid credentials) |

## Use in CI/CD

```yaml
# GitHub Actions example
- name: Fabric Health Check
  run: npx fabric-health-check
  env:
    FABRIC_TENANT_ID: ${{ secrets.FABRIC_TENANT_ID }}
    FABRIC_CLIENT_ID: ${{ secrets.FABRIC_CLIENT_ID }}
    FABRIC_CLIENT_SECRET: ${{ secrets.FABRIC_CLIENT_SECRET }}
```

```yaml
# Azure DevOps example
- script: npx fabric-health-check
  displayName: 'Fabric Health Check'
  env:
    FABRIC_TENANT_ID: $(FABRIC_TENANT_ID)
    FABRIC_CLIENT_ID: $(FABRIC_CLIENT_ID)
    FABRIC_CLIENT_SECRET: $(FABRIC_CLIENT_SECRET)
```

## Why Zero Dependencies?

This tool uses only Node.js built-in modules (`https`, `querystring`). That means:

- `npx fabric-health-check` works instantly — no install step
- No supply chain risk from third-party packages
- Works in locked-down environments with restricted package policies
- Tiny package size

## Need More?

This health check gives you a quick snapshot. For continuous monitoring, alerting, capacity planning, and deep observability into your Fabric environment, check out the full **Observability Workbench**:

**[https://github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)**

## License

MIT
