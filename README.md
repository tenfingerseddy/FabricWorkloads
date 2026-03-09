<p align="center">
  <strong>Observability Workbench for Microsoft Fabric</strong>
  <br>
  Open-source monitoring, SLO tracking, and cross-item correlation
</p>

<p align="center">
  <a href="https://github.com/tenfingerseddy/FabricWorkloads/actions"><img src="https://img.shields.io/github/actions/workflow/status/tenfingerseddy/FabricWorkloads/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/tenfingerseddy/FabricWorkloads/stargazers"><img src="https://img.shields.io/github/stars/tenfingerseddy/FabricWorkloads?style=flat-square" alt="Stars"></a>
</p>

---

## The Problem

Microsoft Fabric's built-in monitoring has gaps:
- **30-day retention** — no long-term trending
- **No cross-item correlation** — can't trace pipeline → notebook → semantic model chains
- **No SLO framework** — no way to define and track service level objectives
- **Fragmented tools** — Monitoring Hub, Capacity Metrics, Spark UI are all separate

## The Solution

This repo provides three things:

| Component | Description |
|-----------|-------------|
| **CLI Tool** (`src/`) | Collect job data, compute SLOs, detect alerts, render dashboards |
| **Fabric Workload** (`workload/`) | Native Fabric item types for dashboards, alerts, and SLOs |
| **KQL Query Pack** (`kql/`) | 30+ ready-to-use analytical queries for Eventhouse |

Plus: Fabric notebooks, a standalone health check tool, and a landing page.

## Quick Start

```bash
git clone https://github.com/tenfingerseddy/FabricWorkloads.git
cd FabricWorkloads
npm install
```

Set your environment variables:

```bash
export FABRIC_TENANT_ID="your-tenant-id"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
```

Run:

```bash
# Full collection + dashboard + alerts
npm start

# Collect only
npm run collect

# Dashboard only
npm run dashboard

# Continuous monitoring (every 5 min)
npm run monitor
```

### Quick Health Check (no install needed)

```bash
npx fabric-health-check
```

## What It Does

1. **Discovers** all workspaces and items via the Fabric REST API
2. **Collects** job instances for pipelines, notebooks, dataflows, copy jobs, etc.
3. **Correlates** related items (pipeline triggers notebook → links them)
4. **Computes** SLO metrics: success rate, P50/P95 duration, freshness
5. **Ingests** into Fabric Eventhouse (KQL database) for long-term storage
6. **Alerts** on SLO breaches, duration regressions, consecutive failures
7. **Scores** CU waste per item — quantifies retry, duration regression, and duplicate run waste in dollars
8. **Renders** a CLI dashboard with workspace inventory, job history, SLO status, and waste metrics

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `FABRIC_TENANT_ID` | Azure AD tenant ID | Yes |
| `FABRIC_CLIENT_ID` | Service principal client ID | Yes |
| `FABRIC_CLIENT_SECRET` | Service principal secret | Yes |
| `KQL_ENABLED` | Enable Eventhouse ingestion (`true`/`false`) | No |
| `KQL_QUERY_ENDPOINT` | Eventhouse query URI | When KQL enabled |
| `KQL_DATABASE` | KQL database name | When KQL enabled |

## Project Structure

```
src/                    # CLI tool (TypeScript)
  auth.ts               #   OAuth2 client credentials
  fabric-client.ts      #   Fabric REST API client (pagination, retry, rate limiting)
  collector.ts          #   Workspace discovery, job collection, correlation, SLOs
  kql-client.ts         #   Eventhouse KQL ingestion
  dashboard.ts          #   Terminal dashboard renderer
  alerts.ts             #   Alert engine (SLO breach, regression, freshness)
  waste-score.ts        #   CU Waste Score calculator (retry, duration, duplicate waste)
  scheduler.ts          #   Polling scheduler for continuous mode
  __tests__/            #   Unit tests (vitest)
workload/               # Fabric Extensibility Toolkit workload
  app/items/            #   3 item types: WorkbenchDashboard, AlertRule, SLODefinition
  Manifest/             #   Fabric manifests and item definitions
kql/                    # Ready-to-use KQL queries
  create-tables.kql     #   Table creation with retention policies
  dashboard-queries.kql #   Success rates, duration trends, heatmaps
  slo-queries.kql       #   SLO tracking, error budgets, CU waste scoring
  correlation-queries.kql # Cross-item correlation analysis
  troubleshooting.kql   #   Incident investigation queries
notebooks/              # Fabric PySpark notebooks
  NB_ObsIngestion.py    #   Scheduled job data collection
  NB_ObsCorrelation.py  #   Cross-item correlation engine
  NB_ObsAlerts.py       #   Alert evaluation and notification
packages/               # Standalone tools
  fabric-health-check/  #   npx fabric-health-check (zero dependencies)
landing-page/           # Marketing site
```

## Fabric Item Types (Workload)

The workload adds 3 native item types to Fabric:

- **WorkbenchDashboard** — SLO status grid, CU waste scoring, incident timeline, failed jobs view
- **AlertRule** — Condition builder, notification targets, test alerts
- **SLODefinition** — Metric configuration, error budget visualization

## KQL Eventhouse Tables

| Table | Purpose |
|-------|---------|
| `FabricEvents` | All job instances (90-day retention) |
| `WorkspaceInventory` | Item catalog across workspaces |
| `EventCorrelations` | Cross-item dependency links |
| `SloDefinitions` | SLO target configurations |
| `SloSnapshots` | Point-in-time SLO measurements |
| `AlertRules` | Alert rule definitions |
| `AlertLog` | Triggered alert history |

## Testing

```bash
npm test          # Run all 53 tests
npm run test:watch  # Watch mode
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

MIT — see [LICENSE](LICENSE).
