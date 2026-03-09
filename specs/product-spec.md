# Observability Workbench — Product Specification

## Product Summary
A Microsoft Fabric custom workload that provides enterprise-grade observability for Fabric environments: long-retention telemetry, cross-item correlation, SLO tracking, and proactive alerting.

## Problem Statement
Fabric's native monitoring is insufficient for production operations:
- Monitoring hub: 100 activities visible, 30-day max, search only on loaded data
- Workspace monitoring: 30-day retention, no log type filtering, missing operation logs
- No cross-item dependency correlation
- No SLO/SLI framework
- No proactive alerting ("will breach in X hours")
- Status inconsistencies (e.g., notebook "Stopped" status ambiguity)

## Target Users
| Persona | Primary Need | Usage Pattern |
|---------|-------------|---------------|
| Data Engineer | "Why did this pipeline fail and what downstream is affected?" | Daily — incident investigation, trend monitoring |
| IT Admin / Platform Owner | "Is our Fabric environment healthy? What's degrading?" | Weekly — SLO review, capacity planning |
| BI Developer (on-call) | "Report is stale — what refresh failed and when will it recover?" | Ad-hoc — incident response |

---

## Architecture

### Workload Components
```
┌─────────────────────────────────────────────────────┐
│                   Fabric Portal                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Observability Workbench Frontend          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │ Incident │ │   SLO    │ │  Alert Rules   │  │ │
│  │  │ Timeline │ │Dashboard │ │    Editor       │  │ │
│  │  └──────────┘ └──────────┘ └────────────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │  Search  │ │ Dep Graph│ │   Settings     │  │ │
│  │  └──────────┘ └──────────┘ └────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
┌──────────────────┐     ┌──────────────────────┐
│  Workload Backend │     │   Fabric Platform     │
│  (.NET Service)   │     │                       │
│                   │◄───►│ - Monitoring Hub API  │
│ - CRUD endpoints  │     │ - Workspace Mon. API  │
│ - Correlation     │     │ - Fabric REST APIs    │
│   engine          │     │ - Scheduler           │
│ - Alert evaluator │     │ - Item metadata       │
│ - SLO calculator  │     └──────────────────────┘
│                   │
│                   │◄───► ┌────────────────────┐
│                   │      │  Data Stores        │
└──────────────────┘      │                      │
                          │ - Eventhouse (hot)   │
                          │   90-day retention   │
                          │ - Lakehouse (cold)   │
                          │   365-day archive    │
                          └────────────────────┘
```

### Workload Item Type: `ObservabilityWorkbench.WorkbenchItem`

Each workspace can have one Workbench item that:
- Connects to the workspace's monitoring hub and workspace monitoring data
- Stores configuration (SLO definitions, alert rules, retention settings)
- Runs scheduled jobs for ingestion, correlation, and alerting

### Job Types
| Job Type | Schedule | Purpose |
|----------|----------|---------|
| `Ingest` | Every 5 minutes | Pull new events from monitoring hub + workspace monitoring |
| `Correlate` | Every 15 minutes | Build/update dependency chains across events |
| `AlertEvaluate` | Every 5 minutes | Check SLO status, evaluate alert rules, fire notifications |
| `Archive` | Daily | Move aged data from Eventhouse to Lakehouse cold storage |
| `SLOCompute` | Hourly | Recalculate SLO metrics and error budgets |

---

## Core Features

### F1: Long-Retention Event Store
- Ingest all monitoring hub activities and workspace monitoring logs
- Store in Eventhouse (KQL-queryable) for hot data (90-day default)
- Archive to Lakehouse (Parquet) for cold storage (365-day)
- Full-text search across all historical events
- Filter by: item type, status, time range, user, error code, workspace

### F2: Cross-Item Correlation Engine
- Discover item dependencies within workspace (via Fabric REST APIs + lineage)
- Match events into correlation chains:
  - Pipeline run → triggered notebook executions
  - Dataflow completion → semantic model refresh trigger
  - Semantic model refresh → report data freshness signal
- Assign confidence scores to inferred correlations
- Visualize dependency graph with health status overlay

### F3: SLO Definitions & Tracking
- Define SLOs per item or item group:
  - **Freshness**: "Semantic model X must be refreshed within 2 hours of source update"
  - **Success Rate**: "Pipeline Y must succeed > 99% over rolling 7 days"
  - **Duration**: "Notebook Z P95 execution time must be < 30 minutes"
- Track error budgets (remaining tolerance before SLO breach)
- Historical SLO compliance trends

### F4: Proactive Alerting
- Rule types:
  - **SLO Breach**: Fire when SLO target is violated
  - **Likely Breach**: Fire when trend analysis predicts breach within configurable window
  - **Trend Degradation**: Fire when P95 duration increases > X% over baseline
  - **Error Spike**: Fire when failure rate exceeds threshold in rolling window
- Notification channels: Email, Microsoft Teams (webhook), custom webhook
- Cooldown periods to prevent alert storms

### F5: Incident Timeline
- Select any failed event and see:
  - Full upstream chain (what triggered this?)
  - Full downstream impact (what depends on this?)
  - Timeline view with all related events, statuses, durations
  - Error details and suggested remediation
- "What happened in the last 24 hours" summary view

### F6: Search & Exploration
- Full-text search across event metadata, error messages, item names
- KQL query interface for advanced users
- Saved searches and shared views
- Export search results to CSV/Excel

---

## MVP Scope (v0.1)

### In Scope
- [ ] Workload item creation and configuration UI
- [ ] Monitoring hub event ingestion (5-min polling)
- [ ] Eventhouse hot store with 90-day retention
- [ ] Basic cross-item correlation (pipeline → notebook, dataflow → refresh)
- [ ] 3 SLO metric types (freshness, success rate, duration P95)
- [ ] SLO dashboard with current status and 7-day trend
- [ ] Email alerting for SLO breaches
- [ ] Event search with filters (item type, status, time range)
- [ ] Incident timeline view (single event + upstream/downstream)

### Out of Scope (v0.2+)
- Workspace monitoring log ingestion
- Lakehouse cold archive
- "Likely to breach" predictive alerts
- Teams webhook notifications
- Multi-workspace views
- KQL query interface
- Saved searches
- Custom correlation rules

---

## Technical Requirements

### Fabric Prerequisites
- Fabric capacity: F64 or higher recommended (F2 for dev/test)
- Tenant admin must enable workload development settings
- Entra ID app registration with delegated scopes:
  - `Fabric.Read.All` (workspace item enumeration)
  - `MonitoringHub.Read.All` (monitoring hub events)
  - `OneLake.ReadWrite.All` (Eventhouse/Lakehouse access)

### Performance Requirements
- Ingestion latency: < 5 minutes from event occurrence to searchable
- Correlation processing: < 2 minutes for a batch of 1000 events
- SLO dashboard load: < 3 seconds
- Search results: < 5 seconds for 90-day range queries
- Alert evaluation: < 2 minutes from SLO breach to notification sent

### Security Requirements
- All data access via delegated (OBO) tokens — no stored credentials
- Respect workspace role assignments (Admin, Member, Contributor, Viewer)
- Audit log for all configuration changes (SLO definitions, alert rules)
- Data encryption at rest (Fabric-managed) and in transit (TLS 1.2+)
- No cross-workspace data leakage

---

## Success Criteria (MVP)
- Successfully ingests events from monitoring hub for 30 consecutive days
- Correctly correlates > 90% of direct dependency chains
- SLO dashboard accurately reflects real item health
- Alert delivery within 5 minutes of SLO breach
- 10 beta users successfully onboarded and providing feedback
- CU consumption of observability jobs < 5% of total workspace capacity
