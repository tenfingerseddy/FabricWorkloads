# GitHub Issues to Create

> These issues should be created on https://github.com/tenfingerseddy/FabricWorkloads
> The PAT needs `repo` scope to create issues via CLI.

---

## Issue 1: Add unit tests for correlation engine

**Labels:** testing, good first issue

The correlation engine in `src/collector.ts` links pipeline runs to triggered notebook executions using 3 strategies:
1. Activity-run name/time matching
2. rootActivityId matching
3. Time-window overlap fallback

We need unit tests covering each strategy with mock Fabric API responses.

### Acceptance Criteria
- [ ] Mock FabricClient that returns configurable job instances
- [ ] Test: pipeline triggers notebook → correctly correlated via time overlap
- [ ] Test: rootActivityId match takes priority over time overlap
- [ ] Test: no false positives when jobs overlap but are unrelated
- [ ] Test: SLO metrics compute correctly from correlated chains

---

## Issue 2: Support Fabric Capacity Metrics API

**Labels:** enhancement, api

Add support for the Fabric Capacity Metrics API to track CU consumption alongside job execution data.

### Value
- Correlate job failures with CU throttling events
- Show CU cost per pipeline/notebook run
- Enable FinOps use cases (cost-per-run, capacity right-sizing)

### Technical Notes
- API: `GET /v1/capacities/{capacityId}/metrics`
- Requires capacity admin role
- Should feed into a new `CapacityMetrics` KQL table

---

## Issue 3: Add Eventhouse KQL query dashboard views

**Labels:** enhancement, workload

Replace sample data in workload views with live KQL queries from EH_Observability.

### Scope
- WorkbenchDashboard: query FabricEvents for real SLO status, incident timeline
- AlertRule: query AlertRules table for saved rules
- SLODefinition: query SloDefinitions + SloSnapshots for current status

### Technical Notes
- Use the Fabric workload client's KQL query capability
- Consider caching strategy for dashboard refresh

---

## Issue 4: Docker container for scheduled collection

**Labels:** enhancement, devops

Package the collector as a Docker container that can run on a schedule outside of Fabric.

### Use Case
Users who want to run the collector as a cron job or Azure Container Instance rather than a Fabric Notebook.

### Deliverables
- [ ] Dockerfile
- [ ] docker-compose.yml with env var configuration
- [ ] Documentation for Azure Container Instance deployment

---

## Issue 5: Support for more Fabric item types

**Labels:** enhancement, help wanted

Currently we collect jobs for: DataPipeline, Notebook, CopyJob, Lakehouse, SemanticModel, Dataflow, SparkJobDefinition.

Additional item types to investigate:
- [ ] MLExperiment / MLModel (already in JOB_ITEM_TYPES but untested)
- [ ] Eventstream
- [ ] KQLQueryset
- [ ] MirroredDatabase
- [ ] Warehouse

Each needs testing to confirm the Jobs API works and what status values are returned.
