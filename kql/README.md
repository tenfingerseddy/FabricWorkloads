# KQL Query Pack

Ready-to-use KQL queries for analyzing your Fabric observability data in Eventhouse.

## Setup

These queries work against the `EH_Observability` KQL database created by the Observability Workbench. Run the table creation script first, then use these queries in your KQL Queryset or Eventhouse query editor.

## Files

| File | Description |
|------|-------------|
| `create-tables.kql` | Create all 6 observability tables |
| `dashboard-queries.kql` | Queries powering the main dashboard |
| `slo-queries.kql` | SLO computation and error budget tracking |
| `correlation-queries.kql` | Cross-item correlation analysis |
| `troubleshooting.kql` | Common debugging and incident investigation queries |
