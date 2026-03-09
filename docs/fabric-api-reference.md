# Fabric API Reference — Key Findings from Research

## Critical Discovery: Scanner API for Lineage

The **Scanner API** provides lineage/dependency data — essential for our correlation engine. It uses the Power BI Admin API base URL:

```
# Step 1: Get modified workspaces
GET https://api.powerbi.com/v1.0/myorg/admin/workspaces/modified?modifiedSince={datetime}

# Step 2: Trigger scan (max 100 workspaces, max 16 concurrent)
POST https://api.powerbi.com/v1.0/myorg/admin/workspaces/getInfo?lineage=True&datasourceDetails=True&datasetSchema=True
Body: { "workspaces": ["workspace-id-1", ...] }

# Step 3: Poll + Get results
GET https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanStatus/{scanId}
GET https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanResult/{scanId}
```

Requires: `Tenant.Read.All` scope (admin consent). Returns lineage relationships, data source details, schemas.

## Critical Discovery: Pipeline Activity Runs API

```
POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/datapipelines/pipelineruns/{jobId}/queryactivityruns
```

This gives us **individual activity details within a pipeline run** — much richer than just the top-level job instance.

## Extensibility Toolkit (New, Sep 2025)

The WDK is evolving. The **Extensibility Toolkit** is the modern version:
- **Frontend-centric** (TypeScript 75%, no mandatory .NET backend)
- **Manifest-driven** item types
- **Copilot-enabled** development
- **GitHub**: https://github.com/microsoft/fabric-extensibility-toolkit

This means we can potentially build our workload in TypeScript/Node.js instead of .NET — aligning perfectly with our current MVP stack.

## Key GitHub Repos
- WDK Sample: https://github.com/microsoft/Microsoft-Fabric-workload-development-sample
- Extensibility Toolkit: https://github.com/microsoft/fabric-extensibility-toolkit
- Lineage Extractor: https://github.com/microsoft/fabric-toolbox/tree/main/tools/Lineage_Extractor
- Metadata Scanner Sample: https://github.com/microsoft/Fabric-metadata-scanning

## SDK Versions (as of March 2026)
- .NET: `Microsoft.Fabric.Api` v2.3.0 (NuGet)
- Python: `microsoft-fabric-api` v0.1.0b5 (PyPI, beta)
- Community: `msfabricpysdkcore` v0.2.10 (PyPI)

## Admin API Access Requirements
Our service principal needs admin consent for:
1. `Tenant.Read.All` — to use admin/items, admin/workspaces, Scanner API
2. Enable "Service principals can access read-only admin APIs" in tenant settings
3. Add SP to security group allowed in tenant settings

## API Endpoint Quick Reference

| Purpose | Endpoint | Auth |
|---------|----------|------|
| List workspaces | `GET /v1/workspaces` | SP workspace role |
| List items | `GET /v1/workspaces/{id}/items` | SP workspace role |
| Job instances | `GET /v1/workspaces/{id}/items/{id}/jobs/instances` | SP workspace role |
| Pipeline activities | `POST /v1/workspaces/{id}/datapipelines/pipelineruns/{id}/queryactivityruns` | SP workspace role |
| Admin items | `GET /v1/admin/items` | Tenant.Read.All |
| Admin workspaces | `GET /v1/admin/workspaces` | Tenant.Read.All |
| Scanner (lineage) | `POST https://api.powerbi.com/v1.0/myorg/admin/workspaces/getInfo` | Tenant.Read.All |
