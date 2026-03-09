---
title: "What FabCon 2026 Reveals About the Fabric Observability Gap (And What's Coming Next)"
published: false
description: "FabCon 2026 was the biggest week in the Fabric calendar. Microsoft shipped real monitoring improvements -- but the structural observability gaps remain. Here's what changed, what hasn't, and why the Extensibility Toolkit changes the equation."
tags: microsoft-fabric, dataengineering, observability, opensource
cover_image:
canonical_url:
series: "Fabric Observability Deep Dives"
---

Last week, thousands of data engineers, BI developers, and platform architects converged on the Georgia World Congress Center in Atlanta for FabCon 2026 -- the third annual Microsoft Fabric Community Conference. Five days. Over 200 sessions. Keynotes from Arun Ulag, Amir Netz, Kim Manis, and the rest of Microsoft's Fabric leadership. And for the first time, the co-located SQLCon running alongside it, making it the most significant week in the Microsoft data platform calendar.

If you work with Fabric in production, you already know there was a particular session track worth paying close attention to this year: monitoring, observability, and operational readiness. Sessions like "Monitor and troubleshoot your data solution in Microsoft Fabric," "Unstoppable Fabric: Capacity Planning, Smart Alerting & Workload Tuning," "What's new in Fabric capacities and capacity monitoring," and "Beyond Monitoring: AI-Driven Spark Optimization in Microsoft Fabric" were all on the schedule. That was four sessions explicitly devoted to the operational side of Fabric -- out of 200+.

That ratio says something. And what it says is worth unpacking.

---

## Microsoft Is Making Progress. Let's Give Credit Where It's Due.

Before we talk about what is missing, it is important to acknowledge what Microsoft has shipped recently. The February 2026 Feature Summary alone included several updates that matter for anyone operating Fabric at scale.

**SQL Pool Insights** extends the Query Insights experience with pool-level telemetry for Data Warehouse. A new system view -- `queryinsights.sql_pool_insights` -- logs pool state changes and sustained pressure events, letting you correlate pool-level pressure with query performance and validate resource isolation between workloads. If you have been flying blind on warehouse pool health, this is a meaningful step forward.

**Adaptive Performance Tuning** for Data Factory is now in preview. It dynamically applies performance improvements based on configuration and runtime conditions -- the kind of intelligent optimization that reduces the manual tuning burden on data engineers who are already stretched thin.

**The Modern Evaluator** for Data Factory has reached GA with support for 80+ connectors, rebuilt on .NET 8. Faster, more reliable copy activities across the broadest set of sources.

**Real-Time Dashboard performance** improved dramatically -- up to 6x faster initial loads and 10x faster pie chart rendering. When your on-call dashboards load slowly during an incident, seconds matter.

And looking back over recent months: the Pipeline Monitoring Hub added a hierarchical view for impact analysis. The Item Details page now surfaces item-level lineage. Spark Monitoring APIs went GA with Spark Advisor recommendations and Resource Usage metrics. Capacity Metrics now covers Copilot and VNET Gateway consumption.

Each of these is a genuine improvement. Microsoft is listening and investing. Nobody should pretend otherwise.

---

## But There Is Still a Structural Gap

The improvements above are additive. They make individual tools better within their existing boundaries. What they do not do is solve the structural fragmentation that makes Fabric observability painful for teams operating at scale.

If you have been following the community forums, you have heard the same frustrations repeated. They are not edge cases. They are daily reality.

### Monitoring Hub: Better, But Still Bounded

The hierarchical view for pipeline impact analysis is welcome. But the monitoring hub still shows a maximum of **100 activities from the last 30 days**. Keyword search still only queries data loaded in the current view, not the full backend.

One of the workspaces we instrument has 46 items. On a busy day, that generates 200+ job executions. The monitoring hub shows you half of today. It shows you nothing from two months ago.

### Workspace Monitoring: Now You Pay for 30-Day Retention

Since billing was activated in March 2025, workspace monitoring resources consume real Fabric CUs: 0.22 CU/hour for the Eventstream, 0.342 CU/GB for data traffic, and 1 CU/hour per active v-core for Eventhouse compute.

You are now paying for a monitoring system that caps retention at 30 days with no configuration option to extend it. And workspace monitoring **does not cover dataflows, pipelines, or notebooks** -- the three item types that form the backbone of most orchestration patterns.

### Cross-Item Correlation: Still the Hardest Problem

I wrote about this in detail in [my previous post](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric). The item-level lineage view shows static dependency relationships -- not runtime execution chains.

When a pipeline triggers a notebook, and that notebook writes to a Lakehouse, and a semantic model refreshes from the Lakehouse -- and something in that chain fails -- you need to trace the live execution path. Which specific run triggered which specific downstream execution?

Fabric gives you no way to answer this in a single view. We built three correlation strategies (activity-run matching, rootActivityId propagation, time-window overlap) because no single API signal reliably connects the chain.

### Alerting: Per-Item Configuration Does Not Scale

Data Activator requires per-item configuration. If you have 40 pipelines and want to alert on failures across all of them, you need 40 alert rules. No wildcard scope. No "alert me when anything in this workspace fails."

The community has evolved workarounds: wrapper pipelines with Outlook activities on the failure path, Azure Monitor through Event Hubs. These work, but they are brittle parallel systems that duplicate what should be a platform capability.

In the infrastructure world, nobody configures alerts per-server anymore. In the data world -- at least in Fabric -- you still configure alerts per-pipeline.

### Status Ambiguity

A notebook execution shows a status of "Stopped." Cancelled? Terminated? Completed successfully with a misleading label? When you are building automated alerting or SLO tracking, status is the foundational signal. If the status signal is ambiguous, everything built on top inherits that ambiguity.

---

## The Extensibility Toolkit: Why This Gap Will Get Filled

Here is where the FabCon 2026 story gets interesting. While the monitoring gaps persist, Microsoft has simultaneously opened a path for the community and partners to fill them.

The **Fabric Extensibility Toolkit** is now production-ready. Partners can build custom workloads and publish them to the **Fabric Workload Hub**, where customers discover and install them alongside native Fabric workloads.

The Copilot-optimized Starter Kit means scaffolding a new workload in hours instead of weeks. Validation guidelines and a preview validation tool establish quality standards. The publishing pipeline ensures workloads meet Fabric's UX, security, and integration requirements.

This represents a philosophical shift. Microsoft is saying: *we will build the platform and core workloads, and we will make it possible for the ecosystem to extend Fabric in native, discoverable, first-class ways.*

The infrastructure world has this model. Kubernetes does not ship with every monitoring tool -- but its extensibility spawned Prometheus, Grafana, and dozens of purpose-built observability tools. Fabric has arrived at the same inflection point. The Extensibility Toolkit is the mechanism. The observability gap is the opportunity.

---

## What We're Building

The [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) is an open-source toolkit for Microsoft Fabric that addresses these gaps:

**Long-retention telemetry.** Ingest monitoring hub events and workspace data into an Eventhouse with configurable retention -- 90, 180, or 365 days. When someone asks "has this pipeline been degrading over the last quarter?" you have the data to answer.

**Cross-item correlation.** Our correlation engine links pipeline runs to notebook executions, dataflow runs, and semantic model refreshes using three strategies. One query shows the entire dependency path for a single pipeline run.

**SLO tracking.** Define freshness, success rate, and duration targets for any Fabric item. Track compliance over time. Know when you are burning error budget before your stakeholders notice.

**Workspace-wide alerting.** Alert rules that span an entire workspace without per-item configuration. Proactive "likely to breach" detectors that warn you before an SLO violation.

**KQL-native.** Everything runs on Fabric's own KQL infrastructure. No external dependencies. No data leaving your tenant.

The project is MIT-licensed, runs on npm, and is designed for any Fabric workspace with F64 or higher capacity.

Check it out: **[github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)**

---

## What to Take Away from FabCon

**Review the monitoring session recordings.** "Monitor and troubleshoot your data solution in Microsoft Fabric" and "What's new in Fabric capacities and capacity monitoring" are the key ones. Pay attention to roadmap items -- they signal what is coming in 6-12 months.

**Push for cross-item correlation.** In community forums, feedback channels, and your Microsoft contacts -- ask when Fabric will natively link pipeline runs to downstream executions. The more the product team hears this, the higher it moves on the backlog.

**Explore the Extensibility Toolkit.** The Data Factory roadmap and Extensibility Toolkit sessions signal where Microsoft sees partners fitting into the operational tooling story. If you missed them, the recordings will be available.

**Try the open-source tooling.** If you are running Fabric in production and feeling these gaps, give the Observability Workbench a look. Star the repo if it is useful. Open an issue if it is not. The best tools get built by the people who feel the pain.

---

## The Bottom Line

FabCon 2026 happened at an inflection point for Fabric operations. Microsoft is investing in monitoring improvements, but the structural gaps -- limited retention, no cross-item correlation, per-item alerting, status ambiguity -- remain. The Extensibility Toolkit opens the door for the ecosystem to fill those gaps with native, first-class solutions.

The observability gap in Fabric is real, well-documented, and affects every team operating at scale. It will get solved. The question is not whether, but when -- and the answer is: it has already started.

---

*This is the fourth post in our Fabric Observability series. Previous posts:*
- *[The State of Fabric Observability in 2026](https://dev.to/observability-workbench/the-state-of-fabric-observability-in-2026)*
- *[Cross-Item Correlation in Microsoft Fabric](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric)*

*The Observability Workbench is open source and MIT-licensed: [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)*
