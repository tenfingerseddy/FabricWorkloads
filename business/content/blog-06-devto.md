---
title: "Building Native Fabric Workloads With the Extensibility Toolkit"
published: false
description: "The Extensibility Toolkit replaces the WDK for building Fabric workloads. No mandatory .NET backend, TypeScript-first, minutes to first render."
tags: microsoft-fabric, typescript, opensource, tutorial
cover_image:
canonical_url:
series: "Fabric Observability Deep Dives"
---

In September 2025, Microsoft quietly shipped something that changes the economics of building on Fabric: the Extensibility Toolkit. If you missed it, you are not alone. The announcement landed alongside a dense feature summary, and most of the data engineering community was focused on the headline items -- Real-Time Intelligence improvements, OneLake enhancements, new Copilot capabilities. But for anyone building tools, integrations, or custom experiences on top of Fabric, the Extensibility Toolkit is the most consequential infrastructure change since the Workload Development Kit (WDK) launched with Fabric GA.

We have been building the [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- a native Fabric workload for production monitoring, cross-item correlation, and SLO tracking -- and the Extensibility Toolkit fundamentally reshaped how we approach it. This post explains what the toolkit is, how it differs from the WDK, why it matters for ISVs and internal platform teams, and what it means for the Fabric ecosystem.

## What the Extensibility Toolkit Actually Is

At its core, the Extensibility Toolkit is a framework for building web applications that integrate into the Fabric portal as first-class citizens. Your application runs on your own infrastructure but renders inside Fabric via an iFrame. To the end user, your workload looks and behaves like any native Fabric item -- it appears in workspace item lists, participates in search, respects workspace ACLs, supports CI/CD workflows, and stores data in OneLake.

A workload built with the toolkit contributes one or more **item types**. When a user creates one of your items, it shows up in the workspace alongside Lakehouses, Notebooks, Pipelines, and Semantic Models. It has the same lifecycle: create, read, update, delete. It participates in collaboration, sharing, governance, and sensitivity labeling. From the platform's perspective, your custom item is a peer to every built-in Fabric item.

The key architectural characteristics:

- **Hosted by you, rendered in Fabric.** Your web app runs in your cloud. Fabric loads it in an iFrame and provides authentication tokens, theming, navigation, and platform APIs.
- **Manifest-driven.** You declare your item types, capabilities, permissions, and entry points in a manifest file.
- **Entra ID authentication.** Your workload receives scoped tokens via Microsoft Entra ID, including OBO tokens that let you call Fabric APIs, Azure APIs, or any Entra-protected endpoint on behalf of the user.
- **OneLake-native storage.** Every item gets its own OneLake folder with Tables (Delta/Iceberg) and Files (unstructured). Item state is persisted in a hidden OneLake folder managed by Fabric.

## How It Differs From the WDK

The WDK required a mandatory .NET backend service. Your workload needed a server-side component that handled item CRUD operations, responded to Fabric lifecycle events, and managed data operations. The Extensibility Toolkit takes a fundamentally different approach.

**Frontend-centric architecture.** You can build a complete workload as a web application -- React, TypeScript, any framework -- without deploying a backend service. The SDK abstracts the complexity of communicating with the Fabric host, managing authentication, and persisting state.

**State management in Fabric.** Instead of building a backend to store item definitions, you store state directly in OneLake through the toolkit's APIs. The format is compatible with Fabric's public APIs and CI/CD system, so your items automatically participate in deployment pipelines and Git integration.

**Direct API access from the frontend.** OBO tokens let your web app call Fabric REST APIs, OneLake APIs, and any Entra-protected API directly. No backend proxy required.

**Standardized item creation.** The toolkit provides a built-in Fabric control for item creation -- workspace selection, sensitivity labels, naming -- all handled by the platform. No custom dialogs to build and maintain.

**AI-enabled development.** The Starter Kit works with GitHub Codespaces and AI coding assistants. Fork the repo, spin up a Codespace, and have a working workload inside Fabric within minutes.

**Optional backend.** The backend is not gone -- it is opt-in. Need to provision infrastructure when an item is created? Implement a notification API. Need scheduled execution? Implement a job handler. But for most UX-over-data scenarios, frontend-only is sufficient.

| Capability | WDK | Extensibility Toolkit |
|-----------|-----|----------------------|
| Backend service | Required (.NET) | Optional (any language) |
| Item state storage | Your backend | OneLake (managed by Fabric) |
| Item creation UX | Custom-built | Standardized Fabric control |
| API access | Backend proxy | Direct from frontend (OBO) |
| CI/CD support | Manual implementation | Automatic |
| Startup time | Days to weeks | Minutes (Starter Kit) |
| Platform requirement | .NET SDK, Azure hosting | Node.js, any hosting |

## Why This Matters for ISVs

The Extensibility Toolkit opens a direct path to market through the **Fabric Workload Hub** -- Fabric's app marketplace where users can discover, install, and use partner-built workloads.

**Lower barrier to entry.** The mandatory .NET backend, complex auth flows, and custom creation UX added months to WDK development timelines. The toolkit collapses that to weeks.

**Reach.** Microsoft Fabric has millions of users. A Workload Hub listing is discoverable by every one of them. This is not an API integration that someone manually configures. It is a first-class Fabric experience.

**Revenue path.** The Workload Hub supports commercial distribution: trials, freemium, paid subscriptions. The economics shift from "custom enterprise contracts" to "product distribution at platform scale."

**Native integration depth.** Your workload has access to OneLake, Entra authentication, workspace governance, lineage, and the full Fabric REST API surface. You are extending Fabric from inside, not integrating from outside.

## What This Means for the Observability Workbench

We have written about the [observability gaps in Fabric](https://dev.to/series/fabric-observability-deep-dives): the 30-day retention ceiling, the lack of cross-item correlation, the absence of an SLO framework. Everything we have described -- the long-retention event store, the correlation engine, the SLO metrics, the proactive alerting -- is designed to run as a native Fabric workload.

The Extensibility Toolkit is what makes this practical:

**Custom item type: Observability Dashboard.** A new item type in your workspace that renders our monitoring UI inside Fabric -- correlation chains, SLO status, alert history, capacity usage analysis -- all without leaving the Fabric portal.

**OneLake-native storage.** SLO configurations, alert rules, and dashboard layouts stored through the toolkit's state management. Your observability config participates in Fabric's CI/CD system. Promote SLO definitions from dev to prod through standard deployment pipelines.

**Direct API access for collection.** Our collector uses OBO tokens from the toolkit to call the Jobs API, Items API, and workspace discovery endpoints directly from the frontend. No backend proxy, simpler architecture, lower latency.

**Eventhouse integration.** Telemetry data -- every job execution, correlation chain, SLO snapshot -- ingested into an Eventhouse in the same workspace. Archived data written to Lakehouse cold store via OneLake integration. The user controls where observability data lives, and it never leaves their capacity.

**Scheduled jobs.** The toolkit's Fabric Scheduler (in development) will let our collection pipeline run on a Fabric-managed schedule. The collection job will appear in the monitoring hub alongside every other Fabric job. Our observability tool, monitored by the platform it observes.

## Getting Started

If you are considering building a Fabric workload:

**1. Start with the Starter Kit.** Fork the [Extensibility Toolkit repository](https://github.com/microsoft/fabric-extensibility-toolkit), open a GitHub Codespace, run the setup. Working workload in Fabric within 15 minutes.

**2. Understand the manifest.** The manifest declares your item types, capabilities, and permissions. Study the Starter Kit's manifest to understand how Fabric discovers your workload. Here is an abbreviated example of a `WorkloadManifest.xml` that registers a custom item type:

```xml
<WorkloadManifest>
  <Name>Observability Workbench</Name>
  <Version>1.0.0</Version>
  <Items>
    <Item>
      <Name>WorkbenchDashboard</Name>
      <DisplayName>Observability Dashboard</DisplayName>
      <Description>Cross-item correlation, SLO tracking, and alerting for Fabric workspaces</Description>
      <SupportedCapabilities>
        <Capability>Read</Capability>
        <Capability>Write</Capability>
        <Capability>Delete</Capability>
      </SupportedCapabilities>
      <EntryPoint>
        <Type>iFrame</Type>
        <Url>https://your-host.com/dashboard</Url>
      </EntryPoint>
    </Item>
  </Items>
  <Authentication>
    <Authority>https://login.microsoftonline.com/{tenantId}</Authority>
    <ClientId>{your-entra-app-id}</ClientId>
    <Scopes>
      <Scope>https://analysis.windows.net/powerbi/api/.default</Scope>
    </Scopes>
  </Authentication>
</WorkloadManifest>
```

The manifest is the contract between your workload and the Fabric platform. It controls what items appear in the workspace creation menu, what permissions they request, and where the iFrame points.

**3. Build your first item type.** Replace the "Hello World" item with your use case. Define state, API requirements, and UI.

**4. Use the DevGateway.** Local development without deploying to your tenant. Code changes reflected immediately.

**5. Decide on a backend.** Pure UI over Fabric data? No backend needed. Provisioning or scheduled jobs? Plan a lightweight notification API.

**Requirements**: Fabric tenant, GitHub account, Node.js LTS, Microsoft Entra app registration.

## What Comes Next

The Extensibility Toolkit is still early. CI/CD support, the CRUD notification API, and the Fabric Scheduler are documented as "under development." But the trajectory is clear.

**The Workload Hub becomes a real ecosystem.** As the barrier drops, the quantity and quality of workloads grow. ISVs who establish presence early will have a significant advantage at critical mass.

**Internal platform teams build custom workloads.** Not every workload is for the marketplace. Enterprises will build compliance dashboards, data quality gates, internal tooling, and domain-specific authoring experiences. The toolkit makes this practical for a team of 1-2 frontend developers.

**Observability becomes a platform capability.** When your monitoring tool is inside Fabric, it sees everything with the same permissions and governance as every other component. Not bolted on. Built in.

## Try It

{% embed https://github.com/tenfingerseddy/FabricWorkloads %}

- **Extensibility Toolkit**: [github.com/microsoft/fabric-extensibility-toolkit](https://github.com/microsoft/fabric-extensibility-toolkit)
- **Documentation**: [learn.microsoft.com/en-us/fabric/extensibility-toolkit/](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/extensibility-toolkit-overview)

If you are building a Fabric workload or considering it, we would like to hear from you. What are you building? What problems are you solving? Drop a comment below or open an issue on our repo.

---

*This post is by the team behind [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- an open-source native Fabric workload for production observability in Microsoft Fabric. Follow the project on [GitHub](https://github.com/tenfingerseddy/FabricWorkloads) and join the conversation.*
