<p align="center">
  <strong>Observability Workbench for Microsoft Fabric</strong>
  <br>
  Open-source monitoring, SLO tracking, cross-item correlation, and CU waste scoring
</p>

<p align="center">
  <a href="https://github.com/tenfingerseddy/FabricWorkloads/actions"><img src="https://img.shields.io/github/actions/workflow/status/tenfingerseddy/FabricWorkloads/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/tenfingerseddy/FabricWorkloads/stargazers"><img src="https://img.shields.io/github/stars/tenfingerseddy/FabricWorkloads?style=flat-square" alt="Stars"></a>
  <img src="https://img.shields.io/badge/tests-269%20passed-brightgreen?style=flat-square" alt="Tests">
  <img src="https://img.shields.io/badge/events%20tracked-110%2B-brightgreen?style=flat-square" alt="Events Tracked">
  <img src="https://img.shields.io/badge/SLOs%20tracked-36-blue?style=flat-square" alt="SLOs Tracked">
  <img src="https://img.shields.io/badge/free%20tier-available-purple?style=flat-square" alt="Free Tier">
</p>

---

## The Problem

Microsoft Fabric's built-in monitoring has gaps that compound in production:
- **30-day retention** — no long-term trending or quarter-over-quarter analysis
- **No cross-item correlation** — can't trace pipeline → notebook → semantic model chains
- **No SLO framework** — no way to define and track service level objectives or error budgets
- **No cost visibility** — no way to quantify compute waste from failed, regressed, or duplicate runs
- **Fragmented tools** — Monitoring Hub, Capacity Metrics, Spark UI are all separate with no unified view

## Live Results

Running against real Fabric infrastructure right now:

| Metric | Value |
|--------|-------|
| Job events ingested | 110+ |
| SLO snapshots tracked | 36 |
| Cross-item correlations | 7 |
| Alerts triggered | 27 |
| Fabric notebooks on schedule | 3 |

## The Solution

This repo provides four things:

| Component | Description |
|-----------|-------------|
| **CLI Tool** (`src/`) | Collect job data, compute SLOs, score CU waste, detect alerts, render dashboards |
| **CU Waste Score** (`src/waste-score.ts`) | Quantify compute waste in dollars — retry, duration regression, and duplicate run waste per item |
| **Fabric Workload** (`workload/`) | Native Fabric item types for dashboards, alerts, and SLOs |
| **KQL Query Pack** (`kql/`) | 30+ ready-to-use analytical queries for Eventhouse |

Plus: Fabric notebooks for in-platform execution, a standalone health check tool, notebook validation scripts, and a landing page.

## CU Waste Score

Every failed pipeline run, every duration regression, every duplicate execution costs real money. The CU Waste Score quantifies this per item across three dimensions:

| Waste Type | What It Measures |
|------------|-----------------|
| **Retry waste** | CU-seconds consumed by failed runs — compute ran, output discarded |
| **Duration waste** | Excess CU-seconds from runs that took longer than their P50 baseline |
| **Duplicate waste** | CU-seconds from overlapping concurrent runs of the same item |

The score (0-100) represents efficiency. The calculator projects monthly cost based on F64 SKU pricing ($11.52/hr). Run the KQL version (`kql/slo-queries.kql`) directly in your Eventhouse to see waste per item in your environment.

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
# Full collection + dashboard + alerts + waste scoring
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
2. **Collects** job instances for pipelines, notebooks, dataflows, copy jobs, and more
3. **Correlates** related items (pipeline triggers notebook → links them automatically)
4. **Computes** SLO metrics: success rate, P50/P95 duration, freshness
5. **Scores** CU waste per item — quantifies retry, duration regression, and duplicate run waste in dollars
6. **Ingests** into Fabric Eventhouse (KQL database) for long-term storage (90-day hot, 365-day cold)
7. **Alerts** on SLO breaches, likely breaches, duration regressions, and consecutive failures
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
  hooks/                #   React hooks for workload frontend
  services/             #   Service layer (API clients, data transforms)
  types/                #   Shared TypeScript type definitions
  __tests__/            #   Unit tests — 269 tests (vitest)
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
scripts/                # Data quality and validation tools
  fabric-health-check.sh #  Open-source Fabric health check (lead gen)
  validate-notebooks.sh #   Notebook format validation for Fabric upload
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

## Pricing

| Tier | Price | Workspaces | Retention | SLOs |
|------|-------|-----------|-----------|------|
| Free | $0 | 1 | 7 days | 5 |
| Professional | $499/mo per capacity | 5 | 90 days | Unlimited |
| Enterprise | $1,499/mo per capacity | Unlimited | 365 days | Unlimited + SSO + SLA |

The open-source CLI and KQL queries are free forever. Paid tiers add managed infrastructure, extended retention, and enterprise features. See the [landing page](landing-page/) for details.

## Resources

- [Blog: The State of Fabric Observability in 2026](https://dev.to/observability-workbench/the-state-of-fabric-observability-in-2026) — the problem space and our approach
- [Blog: Cross-Item Correlation in Microsoft Fabric](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric) — technical deep-dive on the correlation engine
- [KQL Query: CU Waste Score](kql/slo-queries.kql) — calculate compute waste per item in your Eventhouse

## Testing

```bash
npm test           # Run all 269 tests
npm run test:watch # Watch mode
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

MIT — see [LICENSE](LICENSE).
