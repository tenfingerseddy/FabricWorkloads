# What FabCon 2026 Reveals About the Fabric Observability Gap (And What's Coming Next)

*Published: March 14, 2026*
*Author: Observability Workbench Team*

---

This week, thousands of data engineers, BI developers, and platform architects are converging on the Georgia World Congress Center in Atlanta for FabCon 2026 -- the third annual Microsoft Fabric Community Conference. Five days. Over 200 sessions. Keynotes from Arun Ulag, Amir Netz, Kim Manis, and the rest of Microsoft's Fabric leadership. And for the first time, the co-located SQLCon running alongside it, making this the most significant week in the Microsoft data platform calendar.

If you work with Fabric in production, you already know there is a particular session track worth paying close attention to this year: monitoring, observability, and operational readiness. Sessions like "Monitor and troubleshoot your data solution in Microsoft Fabric," "Unstoppable Fabric: Capacity Planning, Smart Alerting & Workload Tuning," "What's new in Fabric capacities and capacity monitoring," and "Beyond Monitoring: AI-Driven Spark Optimization in Microsoft Fabric" are all on the schedule. That is four sessions explicitly devoted to the operational side of Fabric -- out of 200+.

That ratio says something. And what it says is worth unpacking.

## Microsoft Is Making Progress. Let's Give Credit Where It's Due.

Before we talk about what is missing, it is important to acknowledge what Microsoft has shipped recently. The February 2026 Feature Summary alone included several updates that matter for anyone operating Fabric at scale.

**SQL Pool Insights** extends the Query Insights experience with pool-level telemetry for Data Warehouse. A new system view -- `queryinsights.sql_pool_insights` -- logs pool state changes and sustained pressure events, letting you correlate pool-level pressure with query performance and validate resource isolation between read-optimized and write-optimized workloads. If you have been flying blind on warehouse pool health, this is a meaningful step forward.

**Adaptive Performance Tuning** for Data Factory is now in preview. It dynamically applies performance improvements based on configuration and runtime conditions -- the kind of intelligent optimization that reduces the manual tuning burden on data engineers who are already stretched thin.

**The Modern Evaluator** for Data Factory has reached general availability with support for 80+ connectors, rebuilt on .NET 8. This is the plumbing that makes copy activities faster and more reliable across the broadest set of sources.

**Real-Time Dashboard performance** improved dramatically in some scenarios -- up to 6x faster initial loads and 10x faster pie chart rendering. When your on-call dashboards load slowly during an incident, seconds matter. This helps.

And looking back over the last several months, the trajectory is clear. The Pipeline Monitoring Hub added a hierarchical view for impact analysis. The Item Details page now surfaces item-level lineage. Spark Monitoring APIs went GA, giving programmatic access to Spark Advisor recommendations and Resource Usage metrics. Capacity Metrics now covers Copilot and VNET Gateway consumption.

Each of these is a genuine improvement. Microsoft is listening to the community and investing in the operational tooling. Nobody should pretend otherwise.

## But There Is Still a Structural Gap

Here is the problem: the improvements above are additive. They make individual tools better within their existing boundaries. What they do not do is solve the structural fragmentation that makes Fabric observability so painful for teams operating at scale.

If you attended FabCon last year in Stockholm, or if you have been following the community forums since, you have heard the same set of frustrations repeated in different variations. They are not edge cases. They are the daily reality of operating Fabric in production.

### Monitoring Hub: Better, But Still Bounded

The hierarchical view for pipeline impact analysis is a welcome addition. But the monitoring hub still shows a maximum of 100 activities from the last 30 days. Keyword search still only queries data loaded in the current view, not the full backend. If your workspace runs hundreds of executions daily -- and any non-trivial production workspace does -- you are seeing a fraction of what actually happened.

For context: one of the workspaces we instrument has 46 items including pipelines, notebooks, lakehouses, semantic models, and reports. On a busy day, that generates 200+ job executions. The monitoring hub shows you half of today. It shows you nothing from two months ago.

The REST API gives you more, but you are still constrained by the API's retention window. You end up writing custom scripts to do what should be a search box with a date range picker.

### Workspace Monitoring: Now You Pay for 30-Day Retention

Workspace monitoring is the broader telemetry layer -- Spark logs, SQL analytics, operational events ingested into a dedicated Eventhouse per workspace. Since billing was activated in March 2025, those Eventstream and Eventhouse resources consume real Fabric Capacity Units: 0.22 CU/hour for the Eventstream, 0.342 CU/GB for data traffic, and 1 CU/hour per active v-core for the Eventhouse compute.

Here is the thing: you are now paying for a monitoring system that still caps retention at 30 days. There is no configuration option to extend it. The `user_data_operations` table exists in the schema but, as many have reported, does not reliably populate operational logs in all scenarios.

And there is a coverage gap that catches people off guard: workspace monitoring does not monitor dataflows, pipelines, or notebooks. It covers Spark sessions and SQL analytics, but the three item types that form the backbone of most Fabric orchestration patterns are not in scope.

So you pay CU costs for a monitoring layer that covers some workloads for 30 days. For anything beyond that boundary, you are on your own.

### Cross-Item Correlation: Still the Hardest Problem

This is the gap we wrote about in detail in [our second blog post](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric). The item-level lineage view in the Item Details page is a step in the right direction, but it shows static dependency relationships -- not runtime execution chains.

When a pipeline triggers a notebook, and that notebook writes to a Lakehouse, and a semantic model refreshes from the Lakehouse, and a report renders from the semantic model -- and something in that chain fails or produces stale data -- you need to trace the live execution path. Which specific run of the pipeline triggered which specific run of the notebook? Did the notebook that finished at 10:14 PM actually land the data the semantic model refresh at 10:15 PM expected?

Fabric gives you no way to answer these questions in a single view. The Pipeline Activity Runs API (`queryactivityruns`) gives you activity-level detail within a single pipeline run, but correlating those activities to the downstream job instances they spawned requires matching on timestamps, names, and heuristics. We built three correlation strategies to handle this -- activity-run matching, rootActivityId propagation, and time-window overlap -- because no single signal reliably connects the chain.

The community continues to ask for this. The fact that FabCon 2026 has sessions on monitoring but none (that we have seen) specifically on cross-item execution tracing suggests it is not on the near-term roadmap as a first-party feature.

### Alerting: Per-Item Configuration Does Not Scale

Data Activator is Fabric's native alerting layer. It works. But it requires per-item configuration. If you have a workspace with 40 pipelines and you want to alert on failures across all of them, you need 40 alert rules. There is no wildcard scope. No "alert me when anything in this workspace fails" option.

The community has evolved workarounds. People build wrapper pipelines with Outlook or Teams activities on the failure path as a DIY alerting system. Others connect to Azure Monitor or Log Analytics through Event Hubs. These work, but they are brittle, parallel systems that duplicate what should be a platform capability.

The contrast with what data engineers expect from modern observability tooling is stark. In the infrastructure world, nobody configures alerts per-server anymore. In the data world -- at least in Fabric -- you still configure alerts per-pipeline.

### The Status Ambiguity Problem Persists

A notebook execution shows a status of "Stopped." Does that mean it was cancelled? Terminated by the system? Completed successfully with a misleading label? The Fabric documentation acknowledges this ambiguity. In practice, it means you cannot reliably filter for "all failed executions" and trust the results.

This is not a cosmetic issue. When you are building automated alerting or SLO tracking, status is the foundational signal. If the status signal is ambiguous, every system built on top of it inherits that ambiguity.

## The Extensibility Toolkit: Why This Gap Will Get Filled

Here is where the FabCon 2026 story gets interesting. While the monitoring gaps persist, Microsoft has simultaneously opened a path for the community and partners to fill them.

The Fabric Extensibility Toolkit -- the modern evolution of the Workload Development Kit -- is now production-ready. Partners can build custom Fabric workloads and publish them to the Fabric Workload Hub, where customers can discover and install them alongside native Fabric workloads.

The Copilot-optimized Starter Kit means partners can scaffold a new workload in hours instead of weeks. Validation guidelines and a validation tool (currently in preview) establish quality standards. The publishing pipeline ensures workloads in the Hub meet Fabric's UX, security, and integration requirements.

This matters because it represents a philosophical shift. Microsoft is saying: we will build the platform and the core workloads, and we will make it possible for the ecosystem to extend Fabric in ways that are native, discoverable, and first-class.

The infrastructure world has this model. Kubernetes does not ship with every monitoring tool you need -- but its extensibility model spawned Prometheus, Grafana, Datadog integrations, and dozens of purpose-built observability tools. AWS does not ship comprehensive monitoring -- but CloudWatch, plus the partner ecosystem, plus open-source tooling, fills the gaps.

Fabric is arriving at the same inflection point. The Extensibility Toolkit is the mechanism. The observability gap is the opportunity.

## What We're Building

This is where our work fits in. The [Observability Workbench](https://github.com/tenfingerseddy/FabricWorkloads) is an open-source toolkit for Microsoft Fabric that addresses the gaps described above:

**Long-retention telemetry storage.** We ingest monitoring hub events and workspace monitoring data into an Eventhouse with configurable retention -- 90 days, 180 days, 365 days. You stop losing history. When someone asks "has this pipeline been degrading over the last quarter?" you have the data to answer.

**Cross-item correlation.** Our correlation engine links pipeline runs to the notebook executions, dataflow runs, and semantic model refreshes they trigger. Three correlation strategies -- activity-run matching, rootActivityId propagation, and time-window overlap -- produce unified execution chains. One query shows you the entire dependency path for a single pipeline run.

**SLO tracking.** Define freshness, success rate, and duration targets for any Fabric item. Track SLO compliance over time. Know when you are burning through your error budget before your stakeholders notice.

**Workspace-wide alerting.** Alert rules that span an entire workspace without per-item configuration. Proactive "likely to breach" detectors that warn you before an SLO violation, not after.

**KQL-native.** Everything runs on Fabric's own KQL infrastructure. Events are ingested into an Eventhouse. Queries use KQL. Dashboards render from KQL datasets. No external dependencies. No data leaving your Fabric tenant.

The project is MIT-licensed, runs on npm, and is designed to be deployed into any Fabric workspace with an F64 or higher capacity. The codebase includes a collector that discovers workspaces and items via the Fabric REST API, a correlation engine, an alert engine, a scheduler, and a CLI dashboard. We have also published Fabric-native PySpark notebooks for teams that prefer to run the ingestion and correlation logic inside Fabric itself.

You can see the code, the architecture, and the getting-started guide at [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads).

## What FabCon Tells Us About Where This Is Headed

The session lineup at FabCon 2026 tells a story about Fabric's maturity curve. The platform is moving from "can I build on this?" to "can I operate on this at scale?" The presence of sessions on capacity planning, smart alerting, Spark optimization, and troubleshooting signals that Microsoft knows operational readiness is the next frontier.

But conference sessions and first-party features move at Microsoft's pace. The Extensibility Toolkit moves at the community's pace. And the community has been asking for deeper observability since Fabric went GA.

If you are at FabCon this week, here is what we would suggest:

**Attend the monitoring sessions.** "Monitor and troubleshoot your data solution in Microsoft Fabric" and "What's new in Fabric capacities and capacity monitoring" will give you the latest on what Microsoft is shipping. Take notes on the roadmap items -- they will tell you what is coming in 6-12 months.

**Ask about cross-item correlation.** In the Q&A sessions, in the hallway conversations, at the community booth -- ask when Fabric will natively link pipeline runs to the downstream executions they trigger. The more the product team hears this request, the higher it moves on the backlog.

**Look at the Extensibility Toolkit sessions.** The CORENOTE on Data Factory roadmap and any Extensibility Toolkit content will signal where Microsoft sees partners fitting into the operational tooling story.

**Try the open-source tooling.** If you are running Fabric in production and feeling the monitoring gaps, give the Observability Workbench a look. Star the repo if it is useful. Open an issue if it is not. The best tools get built by the people who feel the pain.

## The Bottom Line

FabCon 2026 is happening at an inflection point for Fabric operations. Microsoft is investing in monitoring improvements, but the structural gaps -- limited retention, no cross-item correlation, per-item alerting, status ambiguity -- remain. The Extensibility Toolkit opens the door for the ecosystem to fill those gaps with native, first-class solutions.

The observability gap in Fabric is real, it is well-documented, and it affects every team operating at scale. It will get solved -- either by Microsoft, by partners, by the open-source community, or most likely by all three. The question is not whether, but when, and the answer is: it has already started.

---

*This is the fourth post in our series on Fabric observability. Previous posts: [The State of Fabric Observability in 2026](https://dev.to/observability-workbench/the-state-of-fabric-observability-in-2026) and [Cross-Item Correlation in Microsoft Fabric](https://dev.to/observability-workbench/cross-item-correlation-in-microsoft-fabric).*

*The Observability Workbench is open source and MIT-licensed: [github.com/tenfingerseddy/FabricWorkloads](https://github.com/tenfingerseddy/FabricWorkloads)*
