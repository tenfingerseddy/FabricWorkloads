# Design Partner Pitch: Observability Workbench for Microsoft Fabric

> Version 1.0 | March 2026
> For use in live conversations, screen shares, and follow-up emails with prospective design partners

---

## 60-Second Elevator Pitch

Microsoft Fabric is the fastest-growing data platform in the enterprise, but its operational tooling has a blind spot. The monitoring hub caps at 100 activities and 30 days of retention. Workspace monitoring also caps at 30 days. There is no way to define an SLO like "this semantic model must be fresh within 2 hours" and track it. And when a pipeline fails and cascades into a notebook failure, then a dataflow stall, then a stale report -- tracing that chain is manual detective work across four different surfaces.

We built Observability Workbench to close those gaps. It is the first Fabric-native observability tool: it runs inside your Fabric tenant as a custom workload, stores everything in your own Eventhouse and Lakehouse, and never sends a byte of data outside your environment. It extends retention to 365 days, correlates events across item types automatically, tracks SLOs with error budgets, and fires proactive alerts when something is trending toward breach -- not after it has already broken.

We are looking for 10 organizations to join a 12-week Design Partner Program. You get free Professional-tier access, direct engineering support, and real influence over what we build. We get honest feedback from teams running Fabric in production. No sales pitch, no contract -- just a partnership to build the tool that Fabric should have shipped natively.

---

## The Problem: Fabric's Observability Gaps in Numbers

These are not theoretical concerns. They are documented limitations in Microsoft's own documentation and confirmed by recurring community complaints.

### 1. Monitoring Hub Retention and Visibility

| Limitation | Impact |
|-----------|--------|
| Shows a maximum of **100 activities** at a time | Teams with 50+ daily pipeline runs saturate the view in less than 2 days |
| **30-day retention** | Post-incident investigation beyond 30 days is impossible -- the data is gone |
| Keyword search only queries **loaded data**, not the full backend | Searching for a specific error message often returns nothing even when the failure occurred |
| Status can be **simplified or inconsistent** (e.g., notebook "Stopped" status) | False negatives when filtering for failures |

Source: Microsoft Learn -- "Monitoring hub" known limitations, March 2026.

### 2. No Cross-Item Correlation

A typical Fabric data pipeline involves 4-6 connected items:

```
Data Pipeline --> Notebook --> Dataflow Gen2 --> Semantic Model Refresh --> Report
```

When the report shows stale data, diagnosing the root cause requires:

1. Open the semantic model, check refresh history
2. Open the dataflow, check execution history
3. Open the notebook, check run history
4. Open the pipeline, check activity runs
5. Manually match timestamps across all four surfaces
6. Hope the evidence is still within the 30-day retention window

There is no native "show me everything upstream that contributed to this failure." Every data engineer we have spoken with estimates this manual investigation takes **30-90 minutes per incident**. For a team with 5+ incidents per week, that is 10-30 hours per month of detective work.

### 3. No SLO Framework

Fabric has no concept of:

- "This semantic model must refresh successfully at least 99% of the time over a rolling 7-day window"
- "Data freshness for this pipeline must be under 2 hours"
- "This notebook execution duration must not regress beyond 120% of its 30-day moving average"

Teams discover SLO breaches from business stakeholders filing complaints, not from proactive monitoring. The gap between "something broke" and "someone notices" is often measured in hours or days.

### 4. Workspace Monitoring Retention

| Limitation | Impact |
|-----------|--------|
| **30-day retention** | Cannot analyze trends, seasonal patterns, or slow degradation beyond 1 month |
| Cannot filter by log type or category | High-volume environments produce noise that obscures signal |
| User data operation logs noted as unavailable even when the table exists | Audit trail gaps for compliance-sensitive organizations |
| **Now billed** against capacity consumption | Teams pay for monitoring data they cannot retain long enough to use meaningfully |

### 5. No Proactive Alerting

Fabric does not support:

- Alert rules for job failure thresholds
- "Likely to breach" predictions based on trend analysis
- Error budget burn-rate monitoring
- Notification delivery via Teams webhooks, email, or external systems based on custom conditions

Every alert today is reactive: something broke, someone noticed, someone escalated.

---

## The Solution: Observability Workbench

### Feature-to-Pain-Point Mapping

| Fabric Pain Point | Observability Workbench Feature | How It Works |
|-------------------|-------------------------------|-------------|
| 100-activity / 30-day monitoring hub limit | **Long-Retention Event Store** | Ingests monitoring hub events and workspace monitoring data into an Eventhouse (90-day hot storage) and Lakehouse (365-day cold archive). Full-text search across all historical events. |
| No cross-item correlation | **Correlation Engine** | Automatically discovers and links dependency chains: pipeline to notebook to dataflow to semantic model refresh. When something fails, see the full upstream cause and downstream blast radius in a single timeline. |
| No SLO framework | **SLO Definitions and Tracking** | Define freshness, success rate, and duration SLOs per item. Track error budgets over rolling windows. See compliance trends and breach history. Currently tracking 8 SLO definitions in our live environment. |
| No proactive alerting | **Alert Rules with Breach Prediction** | Configure alert rules for SLO breaches, trend degradation, duration regression, and error spikes. "Likely to breach" predictions fire before impact. Email and Teams webhook delivery. |
| Fragmented monitoring surfaces | **Unified Dashboard** | Six-panel dashboard: health summary, failure timeline, SLO grid, active alerts, recent failures, and correlation chains. One view, all signals. |
| 30-day workspace monitoring cap | **365-Day Archive** | Lakehouse-backed cold storage with KQL query federation. Investigate incidents from 6 months ago without worrying about data expiry. |

### Architecture: How It Runs

```
Your Fabric Tenant
|
|-- Your Existing Workspaces (monitored, read-only)
|     |-- Pipelines, Notebooks, Dataflows, Semantic Models
|
|-- ObservabilityWorkbench Workspace (the tool's home)
      |-- Eventhouse (EH_Observability)
      |     |-- FabricEvents table (all monitoring data)
      |     |-- SloDefinitions table
      |     |-- SloSnapshots table (computed every 15 min)
      |     |-- AlertRules table
      |     |-- AlertLog table
      |     |-- EventCorrelations table
      |     |-- WorkspaceInventory table
      |
      |-- Lakehouse (LH_ObsArchive)
      |     |-- 365-day cold storage
      |
      |-- Ingestion Notebook (runs every 5 min)
      |-- Correlation Notebook (runs every 15 min)
      |-- Alerting Notebook (runs every 15 min)
```

All data stays in your tenant. The tool reads from Fabric REST APIs and writes to its own Eventhouse and Lakehouse. It never modifies your pipelines, notebooks, dataflows, or semantic models.

---

## "Built for Fabric" -- Not "Works with Fabric"

This distinction matters and is the core of our competitive position.

### Zero Data Egress

External observability tools (Monte Carlo, Atlan, Datafold) require shipping telemetry data out of your environment to their SaaS infrastructure. Observability Workbench stores everything in your own Eventhouse and Lakehouse within your Fabric tenant. Your monitoring data never leaves your Azure region.

Why this matters:
- No data residency compliance concerns
- No additional egress costs
- No dependency on an external SaaS uptime for your monitoring
- No procurement complexity for "yet another external vendor"

### Permission-Inherited

Observability Workbench respects Fabric workspace roles. If a data engineer has Contributor access to a workspace, they see monitoring data for that workspace. No separate permission model to manage. No shadow admin access.

### Monitoring Hub Native

The tool's own jobs (ingestion, correlation, alerting) surface in the Fabric monitoring hub like any other Fabric job. You monitor the monitor using the same surface you already know.

### Capacity-Aware

The tool runs on your existing Fabric capacity. There is no separate infrastructure to provision, no external VMs, no Kubernetes clusters. Capacity consumption is transparent and follows the same billing model you already operate under.

### Extensibility Toolkit Aligned

The architecture is designed for the Extensibility Toolkit migration path (arriving September 2025 for TypeScript-first development). This means the investment is durable across the platform evolution Microsoft has publicly committed to.

---

## Competitive Differentiation

### Detailed Comparison Matrix

| Capability | Observability Workbench | Monte Carlo | Atlan | Fabric Native Monitoring |
|-----------|------------------------|-------------|-------|-------------------------|
| **Runs inside Fabric tenant** | Yes -- custom workload | No -- external SaaS | No -- external SaaS | Yes |
| **Data stays in your environment** | Yes -- your Eventhouse + Lakehouse | No -- shipped to Monte Carlo cloud | No -- shipped to Atlan cloud | Yes (30-day limit) |
| **Retention** | 90-365 days (configurable) | Unlimited (in their cloud) | Unlimited (in their cloud) | 30 days |
| **Cross-item correlation** | Native: pipeline to notebook to dataflow to refresh | Limited Fabric support | Lineage only (no operational correlation) | None |
| **SLO framework** | Yes -- freshness, success rate, duration | Yes (data freshness focused) | No native SLO | None |
| **Proactive alerting** | Yes -- breach prediction, trend analysis | Yes | Limited | None |
| **Fabric-specific context** | Deep: workspace roles, capacity, item types | Generic data platform | Generic data catalog | Native but limited |
| **Pricing** | Free tier + $499/mo Professional | $80,000+/year | $198,000+/year | Included (limited) |
| **Open source** | Yes -- MIT license | No | No | N/A |
| **Setup time** | 1-2 hours (same-day value) | Weeks (integration project) | Weeks (integration project) | Already there (limited) |
| **Requires procurement approval** | No -- open source, runs on existing capacity | Yes -- enterprise SaaS contract | Yes -- enterprise SaaS contract | No |

### Why Not Just Use Native Monitoring?

Native monitoring is fine for answering "did this specific job succeed in the last 30 days." It falls apart when you need:

- Historical trend analysis beyond 30 days
- Cross-item root cause analysis
- SLO compliance tracking
- Proactive alerting before business impact
- Full-text search across all historical events

Observability Workbench is complementary to native monitoring, not a replacement. It ingests the same signals and adds the retention, correlation, and SLO layers that the native surface does not provide.

### Why Not Monte Carlo or Atlan?

Three reasons:

1. **Cost**: Monte Carlo starts at $80K/year. Atlan starts at $198K/year. Our Professional tier is $6K/year. For a mid-market team, the external tools are priced for data mesh at Fortune 500 scale.

2. **Architecture**: External tools require data egress, separate authentication, and introduce a dependency on an external SaaS for your operational monitoring. If Monte Carlo has an outage, your Fabric monitoring goes dark.

3. **Fabric depth**: External tools treat Fabric as "another data source." They do not understand Fabric workspace roles, capacity SKUs, monitoring hub semantics, or the specific failure modes of Fabric items. Observability Workbench is purpose-built for Fabric's operational model.

---

## Design Partner Value Proposition

### What You Get

| Benefit | Details |
|---------|---------|
| **Free Professional Tier** | Full Professional features ($499/month value) at zero cost for the 12-week program. Includes 5 workspaces, 90-day retention, unlimited SLOs, full alerting, and cross-item correlation. |
| **Direct Engineering Access** | Private Discord or Teams channel with the engineering team. 4-hour response time during business hours (AEST/UTC). |
| **Roadmap Influence** | Partners vote on next features each sprint. Your priorities directly shape what gets built. Not a suggestion box -- actual prioritization input. |
| **Early Access** | New features delivered to design partners 2 weeks before general release. |
| **Founding Partner Recognition** | Listed on the website and project README as a founding partner (with your permission; anonymous attribution available). |
| **Co-Created Content** | We co-author a case study or blog post about your observability journey. You review and approve all content before publication. |
| **Post-Program Discount** | 50% off Professional tier for 3 months after the program ends ($249.50/mo instead of $499/mo). |
| **Priority Bug Fixes** | Issues reported by design partners are triaged within 24 hours and prioritized above general backlog items. |

### What This Is NOT

- This is not a beta test where you are QA labor for free software
- This is not a sales motion disguised as a partnership
- There is no contract, no commitment to purchase, and no penalty for leaving
- You are a co-creator, not a test subject

---

## What We Ask in Return

| Commitment | Time Investment | Cadence |
|-----------|----------------|---------|
| **Install and configure** against a real Fabric environment (non-production is fine, but real workloads required -- not synthetic data) | 1-2 hours | Week 1 (one-time) |
| **Active usage** during the program -- use the dashboard, define SLOs, review alerts | 15-30 min/day (passive monitoring) | Ongoing |
| **Bi-weekly feedback session** -- structured conversation about what works, what is broken, and what is missing. Async via Loom recording is fine if scheduling is difficult. | 30 minutes | Every 2 weeks |
| **File bugs and feature requests** on GitHub. Honest reports of what does not work are more valuable than compliments. | As encountered | Ongoing |
| **End-of-program survey** covering satisfaction, feature gaps, and willingness to continue | 15 minutes | Week 11 |
| **Permission for anonymized aggregate metrics** in marketing (e.g., "design partners detected an average of X unmonitored failures per week"). No organization-specific data without explicit written consent. | One-time approval | Program start |

### Optional (Appreciated but Not Required)

- Testimonial quote for marketing use
- Case study participation (co-authored, you approve final content)
- Public recommendation (LinkedIn post, Fabric Community forum endorsement, or conference mention)
- Referral to another team that would benefit from the tool
- Logo usage on the website (with written permission)

---

## Ideal Partner Profile

We are selective about design partners because close collaboration requires mutual fit. The ideal partner:

| Criterion | Why It Matters |
|-----------|---------------|
| **3+ active Fabric workspaces** | Multi-workspace monitoring is a core differentiator; single-workspace teams undertest it |
| **F64 or higher capacity** | Lower SKUs restrict some REST API endpoints and reduce concurrency |
| **5+ pipelines or notebooks running daily** | Recurring job volume is needed to test correlation, SLO tracking, and trend detection |
| **2+ data engineers or BI developers** on the team | Ensures enough operational surface area and diverse feedback perspectives |
| **A real monitoring pain point** | You should be able to describe a specific incident where Fabric's native monitoring failed you |

**Consulting firms** that deploy Fabric for multiple clients are especially welcome. A consulting partner brings diverse use cases across industries and accelerates product-market fit validation.

---

## Frequently Asked Questions

### "Is this production-ready?"

The MVP is operational with 187 tests passing, live infrastructure in a production Fabric tenant, and CI/CD pipelines running green. The ingestion, correlation, and alerting notebooks have been running continuously with 100% reliability on ingestion and correlation, and 68%+ on alerting (improving). It is production-grade for the core ingestion and querying path. The design partner program exists precisely to harden edge cases, improve UX, and validate against diverse real-world environments.

### "What if it breaks our Fabric environment?"

It cannot. The tool is read-only against your existing workspaces. It calls Fabric REST APIs to read monitoring data and job history, then writes to its own dedicated Eventhouse and Lakehouse in a separate workspace. It never modifies your pipelines, notebooks, dataflows, semantic models, or any other items. The worst case is that ingestion stops and you lose new monitoring data until it resumes -- your actual Fabric environment is unaffected.

### "How much capacity does it consume?"

The three notebooks (ingestion every 5 minutes, correlation every 15 minutes, alerting every 15 minutes) consume modest capacity units. On our F64 trial capacity, the workload is negligible relative to normal pipeline and notebook activity. We are actively optimizing CU consumption and will publish transparent benchmarks during the design partner program.

### "We already have Azure Monitor / Log Analytics. Why do we need this?"

Azure Monitor and Log Analytics are infrastructure monitoring tools. They tell you "a Fabric API returned a 500" or "capacity utilization hit 90%." Observability Workbench is operational monitoring: it tells you "your daily sales pipeline failed, which caused the semantic model to go stale, which means the CFO's dashboard is showing yesterday's numbers, and your freshness SLO is now breached." The two are complementary, not competitive.

### "Why open source? What is the business model?"

The core observability engine is MIT-licensed and will remain so. The business model is tiered features: the Free tier covers 1 workspace with 7-day retention and 5 SLOs. Professional ($499/mo per capacity) adds 5 workspaces, 90-day retention, unlimited SLOs, and alerting. Enterprise ($1,499/mo per capacity) adds unlimited workspaces, 365-day retention, SSO, audit logs, and SLA guarantees. Open source is the acquisition engine; paid tiers are the business.

### "What happens after the 12-week program?"

Three options:

1. **Continue on Free tier** -- 1 workspace, 7-day retention, 5 SLOs. No cost, no obligation.
2. **Convert to Professional at 50% discount** for 3 months ($249.50/mo instead of $499/mo), then standard pricing.
3. **Walk away** -- no penalty, no hard feelings. You keep any data already stored in your Eventhouse. We ask only for a brief exit survey.

### "Can we run this on F2 or lower SKUs?"

F2 works for evaluation but has limitations: some REST API endpoints restrict concurrency and throughput on lower SKUs. We recommend F64 or higher for production use. If F2 is all you have available, we can work around some limitations -- let us know during onboarding.

### "What about multi-tenant support for consulting firms?"

This is a roadmap item we are actively exploring. The current architecture monitors workspaces within a single tenant. Multi-tenant support (central dashboard across client tenants) is a high-priority feature request that design partners from consulting firms would directly influence.

### "How does this compare to the upcoming Fabric monitoring improvements Microsoft has announced?"

Microsoft continues to improve native monitoring, and we track those announcements closely. Our thesis is that Microsoft will improve the monitoring hub incrementally but will not build a full SLO framework, cross-item correlation engine, or long-retention observability platform -- those are not core platform features, they are operational tooling. If Microsoft ships something that makes a specific Observability Workbench feature redundant, we deprecate that feature and focus on the layers Microsoft will not build. This is the same dynamic that makes Datadog valuable even though AWS has CloudWatch.

---

## Call to Action: Next Steps

If this conversation has been productive and you see a fit, here is the exact next step:

### Step 1: Review the Repository (5 minutes)

Visit https://github.com/tenfingerseddy/FabricWorkloads and browse the README, architecture docs, and test coverage. This is not a slide deck project -- it is working software.

### Step 2: Schedule a 20-Minute Technical Walkthrough

We will share our screen, show the live infrastructure running in our Fabric tenant, and walk through the ingestion-to-dashboard flow. You will see real monitoring data, real SLO snapshots, and real correlation chains. No slides.

### Step 3: Complete a Short Application (5 minutes)

10 questions about your Fabric environment, team size, and monitoring pain points. This helps us confirm mutual fit and prepare onboarding materials for your specific setup.

### Step 4: Onboarding Kickoff (Within 1 Week of Acceptance)

A 45-minute session where we help you set up the tool against your environment. You will see your own monitoring data flowing within the first session.

---

## Contact

- **GitHub**: https://github.com/tenfingerseddy/FabricWorkloads
- **Discussions**: https://github.com/tenfingerseddy/FabricWorkloads/discussions
- **Email**: [your-email@domain.com]
- **LinkedIn**: [Your LinkedIn URL]

---

*Observability Workbench is open-source software (MIT license). Design partner participation is free. We will never share your organization's data or identity without your explicit written permission. This document is confidential and intended for prospective design partner conversations only.*
