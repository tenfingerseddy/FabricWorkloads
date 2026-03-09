<p align="center">
  <img src="docs/logo-placeholder.png" alt="Observability Workbench" width="120">
  <br><br>
  <strong>Observability Workbench CLI</strong>
  <br>
  Monitoring data collection and analysis for Microsoft Fabric
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/github/actions/workflow/status/kane-ai/observability-workbench/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <a href="https://www.npmjs.com/package/@kane-ai/observability-workbench"><img src="https://img.shields.io/npm/v/@kane-ai/observability-workbench?style=flat-square" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
</p>

---

## What is this?

**Observability Workbench CLI** is an open-source command-line tool that collects, stores, and analyzes monitoring data from Microsoft Fabric workspaces. It bridges the gap between Fabric's built-in 30-day monitoring and the long-term observability that production data teams require.

> **Note:** This is the open-source CLI tool. The commercial Observability Workbench product (a native Fabric workload with SLO tracking, correlation engine, proactive alerts, and a managed UI) is developed and licensed separately.

## Features

- **Metric Collection** -- Automatically collects refresh histories, pipeline runs, capacity metrics, and operational events from your Fabric tenant
- **Long-Retention Storage** -- Persists monitoring data to local JSON/SQLite or a Fabric Lakehouse for retention beyond 30 days
- **Terminal Dashboard** -- Real-time CLI dashboard showing workspace health, recent failures, and key metrics
- **Threshold Alerts** -- Configurable alerting on refresh failures, duration anomalies, and capacity utilization
- **Scheduling** -- Built-in cron-style scheduler for continuous, unattended data collection
- **Extensible** -- TypeScript codebase designed for custom collectors, exporters, and alert channels

## Quick Start

### Prerequisites

- Node.js 20 or later
- A Microsoft Fabric tenant with at least one workspace
- An Azure AD app registration with Fabric read permissions ([setup guide](docs/auth-setup.md))

### Installation

```bash
# Clone the repository
git clone https://github.com/kane-ai/observability-workbench.git
cd observability-workbench

# Install dependencies
npm install

# Copy and edit the configuration
cp .env.example .env
# Edit .env with your Azure AD credentials and Fabric workspace IDs
```

### Usage

```bash
# Collect monitoring data (one-shot)
npm run collect

# Start the live terminal dashboard
npm run dashboard

# Run in continuous monitoring mode (collects on a schedule)
npm run monitor

# Development mode with hot reload
npm run dev
```

## Configuration

Configuration is managed via environment variables or a `.env` file:

| Variable | Description | Required |
|---|---|---|
| `AZURE_TENANT_ID` | Azure AD tenant ID | Yes |
| `AZURE_CLIENT_ID` | App registration client ID | Yes |
| `AZURE_CLIENT_SECRET` | App registration client secret | Yes |
| `FABRIC_WORKSPACE_IDS` | Comma-separated workspace IDs to monitor | Yes |
| `COLLECT_INTERVAL_MINUTES` | Collection interval for monitor mode (default: `15`) | No |
| `DATA_DIR` | Directory for local data storage (default: `./data`) | No |
| `ALERT_EMAIL` | Email address for alert notifications | No |
| `LOG_LEVEL` | Logging verbosity: `debug`, `info`, `warn`, `error` (default: `info`) | No |

## Project Structure

```
observability-workbench/
  src/
    index.ts          # CLI entry point and argument parsing
    collector.ts      # Fabric API data collection logic
    store.ts          # Data persistence layer
    dashboard.ts      # Terminal dashboard renderer
    alerts.ts         # Alert evaluation and dispatch
    scheduler.ts      # Cron-style collection scheduler
    fabric-client.ts  # Microsoft Fabric REST API client
    auth.ts           # Azure AD authentication
    config.ts         # Configuration loader
  data/               # Local data storage (git-ignored)
  docs/               # Documentation
  scripts/            # Utility scripts
  specs/              # Specifications and design docs
```

## Roadmap

- [ ] **v0.2** -- SQLite storage backend for efficient querying
- [ ] **v0.3** -- Webhook and Microsoft Teams alert channels
- [ ] **v0.4** -- Historical trend analysis and anomaly detection
- [ ] **v0.5** -- Export to Fabric Lakehouse (direct Lakehouse write-back)
- [ ] **v0.6** -- Multi-tenant support (monitor multiple tenants)
- [ ] **v1.0** -- Stable CLI release with full documentation

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/kane-ai">Kane AI</a>
</p>
