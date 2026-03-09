# Building Native Fabric Workloads With the Extensibility Toolkit

**Published:** March 2026
**Series:** Fabric Observability Deep Dives (#6)
**Author:** Kane Snyder
**Reading time:** ~9 minutes

---

## A New Way to Extend Fabric

In September 2025, Microsoft quietly shipped something that changes the economics of building on Fabric: the Extensibility Toolkit. If you missed it, you are not alone. The announcement landed alongside a dense feature summary, and most of the data engineering community was focused on the headline items -- Real-Time Intelligence improvements, OneLake enhancements, new Copilot capabilities. But for anyone building tools, integrations, or custom experiences on top of Fabric, the Extensibility Toolkit is the most consequential infrastructure change since the Workload Development Kit (WDK) launched with Fabric GA.

We have been building the Observability Workbench -- a native Fabric workload for production monitoring, cross-item correlation, and SLO tracking -- and the Extensibility Toolkit fundamentally reshaped how we approach it. This post explains what the toolkit is, how it differs from the WDK, why it matters for ISVs and internal platform teams, and what it means for the Fabric ecosystem.

## What the Extensibility Toolkit Actually Is

At its core, the Extensibility Toolkit is a framework for building web applications that integrate into the Fabric portal as first-class citizens. Your application runs on your own infrastructure but renders inside Fabric via an iFrame. To the end user, your workload looks and behaves like any native Fabric item -- it appears in workspace item lists, participates in search, respects workspace ACLs, supports CI/CD workflows, and stores data in OneLake.

A workload built with the toolkit contributes one or more **item types**. When a user creates one of your items, it shows up in the workspace alongside Lakehouses, Notebooks, Pipelines, and Semantic Models. It has the same lifecycle: create, read, update, delete. It participates in collaboration, sharing, governance, and sensitivity labeling. From the platform's perspective, your custom item is a peer to every built-in Fabric item.

The key architectural characteristics:

- **Hosted by you, rendered in Fabric.** Your web app runs in your cloud. Fabric loads it in an iFrame and provides authentication tokens, theming, navigation, and platform APIs.
- **Manifest-driven.** You declare your item types, capabilities, permissions, and entry points in a manifest file. Fabric reads the manifest to understand how to present and integrate your workload.
- **Entra ID authentication.** Your workload receives scoped tokens via Microsoft Entra ID, including On-Behalf-Of (OBO) tokens that let you call Fabric APIs, Azure APIs, or any Entra-protected endpoint on behalf of the user.
- **OneLake-native storage.** Every item your workload creates gets its own OneLake folder with a Tables directory (Delta/Iceberg) and a Files directory (unstructured). Your item's state -- configuration, metadata, references -- is persisted in a hidden OneLake folder managed by Fabric.

## How It Differs From the Workload Development Kit

The WDK, which shipped with Fabric GA, required a mandatory .NET backend service. Your workload needed a server-side component that handled item CRUD operations, responded to Fabric lifecycle events, and managed data operations. The backend ran as your own cloud service, communicated with Fabric through a specific protocol, and added significant infrastructure overhead.

The Extensibility Toolkit takes a fundamentally different approach. The backend is no longer mandatory for most scenarios. Here is what changed:

**Frontend-centric architecture.** The toolkit shifts the center of gravity to the frontend. You can build a complete workload as a web application -- React, TypeScript, any framework -- without deploying a backend service. The SDK abstracts the complexity of communicating with the Fabric host, managing authentication, and persisting state. For workloads that primarily provide a user experience over Fabric data, this is transformative.

**State management in Fabric.** Instead of building a backend to store item definitions, you store your item's state directly in OneLake through the toolkit's APIs. The definition is saved in a format compatible with Fabric's public APIs and CI/CD system. This means your items automatically participate in deployment pipelines and Git integration without you implementing anything.

**Direct API access from the frontend.** The toolkit provides frontend access to OBO tokens, which means your web app can call Fabric REST APIs, OneLake APIs, and any Entra-protected API directly. Need to query data from a Lakehouse? Call the SQL endpoint from your frontend. Need to list items in a workspace? Hit the Fabric Items API. No backend proxy required.

**Standardized item creation.** The WDK required you to build your own item creation flow -- dialogs, validation, workspace selection, naming. The toolkit provides a built-in Fabric control that handles all of this. Users create your items through the same standardized experience they use for built-in items: workspace selection, sensitivity labels, and settings are all handled by the platform.

**AI-enabled development.** The Starter Kit repository is designed to work with AI coding assistants. You can spin up a GitHub Codespace, run the starter kit, and have a working "Hello World" workload rendering inside Fabric within minutes. The repository is structured so that Copilot and other AI tools can help you scaffold item types, manifest configurations, and API integrations.

**Optional backend for advanced scenarios.** The backend is not gone -- it is optional. If your workload needs to respond to CRUD lifecycle events (for example, provisioning a database when an item is created), you implement a notification API that Fabric calls. If your workload needs scheduled job execution, you implement a job handler API. But these are opt-in capabilities, not baseline requirements.

Here is the practical impact of these changes:

| Capability | WDK | Extensibility Toolkit |
|-----------|-----|----------------------|
| Backend service | Required (.NET) | Optional (any language) |
| Item state storage | Your backend | OneLake (managed by Fabric) |
| Item creation UX | Custom-built | Standardized Fabric control |
| API access | Backend proxy | Direct from frontend (OBO tokens) |
| CI/CD support | Manual implementation | Automatic (format-compatible) |
| Development startup time | Days to weeks | Minutes (Starter Kit + Codespaces) |
| Platform requirement | .NET SDK, Azure hosting | Node.js, any hosting |

## Why This Matters for ISVs

The Extensibility Toolkit opens a direct path to market through the Fabric Workload Hub. This is Fabric's equivalent of an app marketplace -- a place where Fabric users can discover, install, and use partner-built workloads directly from the Fabric portal.

For ISVs, the implications are significant:

**Lower barrier to entry.** Building a WDK workload was a substantial engineering investment. The mandatory .NET backend, the complex authentication flows, the custom item creation UX -- these added months to development timelines. The toolkit collapses that to weeks for most scenarios. You can prototype a workload in a day and iterate to production quality in a fraction of the time.

**Reach.** Microsoft Fabric has millions of users. A workload published to the Workload Hub is discoverable by every one of them. This is not an API integration that someone has to manually configure. It is a first-class Fabric experience that users can activate from the workspace.

**Revenue path.** The Workload Hub supports commercial distribution. ISVs can offer trial experiences, freemium models, and paid subscriptions through the marketplace. The economics of building on Fabric shift from "custom integration for enterprise contracts" to "product distribution at platform scale."

**Native integration depth.** Because your workload is inside Fabric, it has access to everything Fabric offers: OneLake data, Entra authentication, workspace governance, lineage tracking, and the full Fabric REST API surface. You are not integrating with Fabric from outside -- you are extending it from inside.

## What This Means for the Observability Workbench

We have written extensively about the observability gaps in Fabric: the 30-day retention ceiling, the lack of cross-item correlation, the absence of an SLO framework, the status ambiguity problem. Everything we have described in this series -- the long-retention event store in Eventhouse, the correlation engine, the SLO metrics, the proactive alerting -- is designed to run as a native Fabric workload.

The Extensibility Toolkit is what makes this practical. Here is how it maps to our architecture:

**Custom item type: Observability Dashboard.** When you install the Observability Workbench, you get a new item type in your workspace. Create an Observability Dashboard item, and it renders our monitoring UI inside Fabric -- correlation chains, SLO status, alert history, CU waste scores -- all in the same browser tab where you manage your Lakehouses, Pipelines, and Notebooks. No context switching to an external tool.

**OneLake-native storage.** Our item definitions -- SLO configurations, alert rules, dashboard layouts -- are stored in OneLake through the toolkit's state management APIs. This means your observability configuration participates in Fabric's CI/CD system. You can promote SLO definitions from a development workspace to production through the standard Fabric deployment pipeline.

**Direct API access for data collection.** Our collector -- the component that pulls job instances, activity runs, and workspace metadata from the Fabric REST API -- uses OBO tokens acquired through the toolkit's frontend API support. We call the Jobs API, the Items API, and the workspace discovery endpoints directly, without routing through a backend proxy. This simplifies the architecture and reduces latency.

**Eventhouse integration.** The telemetry data we collect -- every job execution, every correlation chain, every SLO snapshot -- is ingested into an Eventhouse that lives in the same workspace. The toolkit's OneLake integration means we can also write archived data to the Lakehouse cold store. The user controls where their observability data lives, and it never leaves their Fabric capacity.

**Scheduled jobs.** The toolkit's Fabric Scheduler support (currently in development) will enable our collection pipeline to run on a Fabric-managed schedule. Today we use external scheduling; the scheduler integration will let the collection job show up in the monitoring hub like any other Fabric job. Our observability tool, monitored by the platform it observes. That is the kind of integration depth you can only get from a native workload.

## Getting Started With the Toolkit

If you are considering building a Fabric workload -- whether for internal use or for the Workload Hub -- here is the fastest path:

**1. Start with the Starter Kit.** Open the Fabric Extensibility Toolkit Starter Kit repository on GitHub (github.com/microsoft/fabric-extensibility-toolkit). Fork it, open a GitHub Codespace, and run the setup script. You will have a working workload rendering in Fabric within 15 minutes.

**2. Understand the manifest.** The manifest file declares your item types, capabilities, and permissions. Study the Starter Kit's manifest to understand how Fabric discovers and integrates your workload.

**3. Build your first item type.** Replace the "Hello World" starter item with your actual use case. Define what state your item needs to persist, what APIs it needs to call, and what UI it presents to the user.

**4. Use the DevGateway for local development.** The DevGateway emulates the Fabric host locally, so you can develop and test without deploying anything to your tenant. Code changes in your app are reflected immediately when you open your item in Fabric.

**5. Decide on a backend.** If your workload is purely a UI experience over Fabric data and APIs, you may not need a backend at all. If you need provisioning logic (creating databases, configuring resources) or scheduled job execution, plan for a lightweight notification API.

**Requirements**: Access to a Fabric tenant, a GitHub account (for Codespaces), a recent Node.js LTS install for local development, and a Microsoft Entra application registration.

## What We Think Comes Next

The Extensibility Toolkit is still early. Several features -- CI/CD support, the CRUD notification API, the Fabric Scheduler integration -- are documented as "currently under development." But the trajectory is clear.

**The Workload Hub becomes a real ecosystem.** As the barrier to building workloads drops, the number and quality of available workloads will grow. Fabric moves from "a platform you use" to "a platform you extend." The ISVs who establish presence in the Workload Hub early will have a significant advantage when the ecosystem reaches critical mass.

**Internal platform teams build custom workloads.** Not every workload is destined for the marketplace. We expect large enterprises to build internal workloads for compliance dashboards, custom data quality gates, internal tooling, and domain-specific authoring experiences. The toolkit makes this practical for a team of 1-2 frontend developers, not just teams with .NET backend expertise.

**Observability becomes a platform capability.** Native workloads like the Observability Workbench can offer a depth of integration that external tools cannot match. When your monitoring tool is inside Fabric, it can see everything -- every item, every job, every API response -- with the same permissions and governance as every other Fabric component. That is the future of Fabric observability: not bolted on, built in.

## Try It

The Extensibility Toolkit is available now. The Observability Workbench is open source.

- **Extensibility Toolkit Starter Kit**: github.com/microsoft/fabric-extensibility-toolkit
- **Observability Workbench**: github.com/tenfingerseddy/FabricWorkloads
- **Extensibility Toolkit documentation**: learn.microsoft.com/en-us/fabric/extensibility-toolkit/

If you are building a Fabric workload or considering it, we would like to hear from you. What are you building? What problems are you solving? Drop a comment or open an issue on our GitHub repo.

---

**Previous in this series:**
- [The State of Fabric Observability in 2026](https://dev.to/observability-workbench/the-state-of-fabric-observability-in-2026)
- [Cross-Item Correlation in Microsoft Fabric](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric)
- [CU Waste Score: Quantifying Compute Waste in Microsoft Fabric](https://dev.to/observability-workbench/cu-waste-score)

---

*This post is by the team behind [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) -- an open-source native Fabric workload for production observability in Microsoft Fabric. Follow the project on [GitHub](https://github.com/tenfingerseddy/FabricWorkloads) and join the conversation.*
