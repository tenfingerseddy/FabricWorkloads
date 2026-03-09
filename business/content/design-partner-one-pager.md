# Observability Workbench -- Design Partner Program

> One-Page Overview | March 2026
> For sharing as PDF with prospective design partners

---

## The Problem

Microsoft Fabric is becoming the default analytics platform, but its operational tooling has not kept pace. Teams running Fabric in production face a set of observability gaps that create real operational risk:

**30-day retention limit.** The monitoring hub and workspace monitoring both cap at 30 days. When an incident requires investigating what happened 6 weeks ago, the data is gone. Compliance-driven organizations need 90-365 days of operational history.

**No cross-item correlation.** A pipeline triggers a notebook, which feeds a dataflow, which refreshes a semantic model. When something breaks at the end of that chain, tracing the root cause requires manual investigation across 4 different monitoring surfaces. There is no native way to see "this pipeline failure caused these 3 downstream impacts."

**No SLO framework.** There is no way to define "this semantic model must be refreshed within 2 hours" or "this pipeline must succeed at least 99% of the time over a rolling 7 days" and track compliance. Teams discover SLO breaches from angry stakeholders, not from proactive monitoring.

**Fragmented monitoring.** Monitoring hub, workspace monitoring, capacity metrics app, and Purview each show a partial picture. No single tool connects them into a unified operational view.

These are not edge cases. They are the daily reality for every data engineering team managing Fabric at scale.

---

## The Solution

**Observability Workbench** is the first Fabric-native observability tool. It runs inside your Fabric tenant as a custom workload -- not as an external SaaS that requires data egress.

| Capability | What It Does |
|------------|-------------|
| **Long-Retention Store** | Captures monitoring hub events and workspace monitoring data into an Eventhouse (90-day hot) and Lakehouse (365-day archive). Full-text search across all historical events. |
| **Cross-Item Correlation** | Automatically discovers dependency chains: pipeline to notebook to dataflow to semantic model refresh. When something fails, see the full upstream cause and downstream blast radius. |
| **SLO Tracking** | Define freshness, success rate, and duration SLOs per item. Track error budgets. See compliance trends over time. |
| **Proactive Alerting** | Alert rules for SLO breaches, trend degradation, and error spikes. "Likely to breach" predictions so you act before impact, not after. Email and Teams webhook delivery. |
| **Incident Timeline** | Select any failed event and see the full story: what triggered it, what it affected, timestamps, durations, and error details in a single view. |

**Open source.** MIT license. Full source code on GitHub.
**Zero data egress.** All data stays in your Fabric tenant -- your Eventhouse, your Lakehouse, your OneLake.
**Read-only by design.** The tool queries Fabric APIs and writes to its own storage. It never modifies your pipelines, notebooks, or data.

GitHub: https://github.com/tenfingerseddy/FabricWorkloads

---

## What Design Partners Get

The Design Partner Program runs for **12 weeks** with a cohort of **10 organizations**. Partners are co-creators, not beta testers.

| Benefit | Details |
|---------|---------|
| **Free Professional Tier** | Full Professional features ($499/month value) at zero cost for the entire 12-week program: 5 workspaces, 90-day retention, unlimited SLOs, full alerting, cross-item correlation. |
| **Direct Support Channel** | Private Discord or Teams channel with the engineering team. 4-hour response time target during business hours. |
| **Roadmap Influence** | Partners vote on the next features to build each sprint. Your priorities directly shape the product. |
| **Early Access** | New features delivered to design partners 2 weeks before general release. |
| **Founding Partner Recognition** | Listed on the website and in the project README as a founding partner (with your permission -- anonymized attribution is also an option). |
| **Co-Created Content** | We co-author a case study or blog post about your observability journey. You review and approve all content before publication. |
| **Post-Program Discount** | 50% off Professional tier for 3 months after the program ends ($249.50/mo instead of $499/mo). |

---

## What We Ask From Partners

| Commitment | Time Required |
|------------|--------------|
| **Install and configure** against a real Fabric environment within the first week. Non-production environments are fine, but real workloads are required (not synthetic data). | 1-2 hours (Week 1) |
| **Bi-weekly feedback session** -- structured conversation about what works, what's broken, and what's missing. Async via Loom video is an option if scheduling is difficult. | 30 minutes every 2 weeks |
| **File bugs and feature requests** on GitHub. Honest reports of what doesn't work are more valuable than praise. | As encountered |
| **End-of-program survey** covering satisfaction, feature gaps, and willingness to continue. | 15 minutes (Week 11) |
| **Permission for anonymized metrics** -- we may share aggregate statistics (e.g., "design partners detected an average of X unmonitored failures per week") in marketing. No organization-specific data without explicit written consent. | One-time approval |

**Optional (not required):** Testimonial quote, case study participation, public recommendation (LinkedIn post or forum endorsement), referral to another team that would benefit.

---

## Ideal Partner Profile

We are looking for organizations that meet these criteria:

- **3+ active Fabric workspaces** (multi-workspace monitoring is a core differentiator)
- **F64 or higher capacity** (lower SKUs limit API access)
- **5+ pipelines running daily** (need recurring job volume to test correlation and SLO tracking)
- **2+ data engineers or BI developers** on the team
- **A real monitoring pain point** -- you should be able to describe a specific incident where Fabric's native monitoring failed you

Consulting firms that deploy Fabric for clients are also welcome. A consulting partner brings multiple client use cases and accelerates product-market fit validation.

---

## Program Timeline

| Phase | Duration | What Happens |
|-------|----------|-------------|
| **Onboarding** | Week 1 | Install, configure, first data collection. Validate that ingestion and correlation work against your environment. |
| **SLO Setup** | Weeks 2-4 | Define your first SLOs. Identify gaps in the SLO template library. First feedback sessions. |
| **Correlation and Alerting** | Weeks 5-8 | Validate cross-item correlation accuracy. Configure alert rules. Test notification delivery. |
| **Daily Operations** | Weeks 9-10 | Use the dashboard for day-to-day monitoring. Surface UX issues and missing features. |
| **Wrap-Up** | Weeks 11-12 | End-of-program survey. Testimonial collection (optional). Case study interview (optional). Transition planning. |

---

## About Us

We are building the definitive operations platform for Microsoft Fabric, starting with observability and expanding to release management, cost control, and data quality.

- **Product**: Observability Workbench (current) with Release Orchestrator, FinOps Guardrails, and Schema Drift Gate on the roadmap
- **Architecture**: Fabric-native custom workload, TypeScript frontend, .NET backend, Eventhouse + Lakehouse storage
- **Status**: MVP complete, 187 tests passing, live infrastructure in a production Fabric tenant, CI/CD operational
- **License**: MIT -- use it, fork it, contribute to it
- **Pricing**: Free tier (1 workspace, 7-day retention, 5 SLOs) available to everyone. Professional ($499/mo) and Enterprise ($1,499/mo) tiers for production use.

---

## Next Steps

Interested in joining the program? Here's how:

1. **Review the repo**: https://github.com/tenfingerseddy/FabricWorkloads
2. **Schedule a 20-minute call** to discuss fit and answer questions
3. **Complete a short application form** (10 questions, 5 minutes)
4. **Onboarding kickoff** within one week of acceptance

Questions? Reach out directly:

- GitHub: https://github.com/tenfingerseddy/FabricWorkloads/discussions
- Email: [your-email@domain.com]
- LinkedIn: [Your LinkedIn URL]

---

*Observability Workbench is an open-source project (MIT license). Design partner participation is free. We will never share your organization's data or identity without your explicit written permission.*
