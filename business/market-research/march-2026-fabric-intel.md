# Microsoft Fabric Intelligence Report -- March 2026

**Report Date:** 2026-03-09
**Prepared for:** Observability Workbench Product Team
**Classification:** Internal -- Strategic Intelligence
**Next Update Due:** 2026-03-23 (post-FabCon)

---

## Executive Summary

March 2026 is a pivotal month for the Microsoft Fabric ecosystem. FabCon 2026 (March 16--20, Atlanta) is the largest Fabric community event of the year, with 7,500+ expected attendees and 200+ sessions. Several developments directly affect our Observability Workbench strategy:

1. **Workspace monitoring retention remains at 30 days** -- our core value proposition is intact and validated.
2. **Tenant default change on March 23** will auto-enable the setting allowing workspace admins to turn on monitoring -- increasing awareness of monitoring gaps.
3. **Fabric Extensibility Toolkit** is maturing rapidly with a publishing pipeline, validation tools, and a FabCon session dedicated to building items with AI.
4. **FabCon 2026 has dedicated monitoring/observability sessions** -- confirming market demand and creating awareness.
5. **Purview data quality is expanding** (custom SQL rules GA in March 2026) but does NOT address operational observability.
6. **No Fabric-native observability workload exists** in the Workload Hub -- the gap remains wide open.
7. **Competitor activity** is incremental; no competitor has announced a Fabric-native workload.

**Bottom line: The window of opportunity is open. FabCon will amplify awareness of monitoring gaps. We should target post-FabCon momentum for our launch push.**

---

## 1. FabCon 2026 (March 16--20, Atlanta)

### Event Overview

| Detail | Value |
|---|---|
| Dates | March 16--20, 2026 |
| Location | Georgia World Congress Center, Atlanta, GA |
| Expected Attendance | 7,500+ (13,000+ across last 3 events) |
| Sessions | 200+ across all Fabric workloads |
| Co-located Event | SQLCon (first time co-located) |
| Keynote Speakers | Arun Ulag, Amir Netz, Wangui McKelvey, Nellie Gustafsson, Patrick LeBlanc, Adam Saxton |

**Source:** [FabCon 2026 Official Site](https://fabriccon.com/) | [Microsoft Fabric Blog -- FabCon Atlanta](https://blog.fabric.microsoft.com/en-us/blog/microsoft-fabric-community-conference-comes-to-atlanta)

### Observability and Monitoring-Relevant Sessions

| Session | Speakers | Time | Relevance |
|---|---|---|---|
| "Monitor and troubleshoot your data solution in Microsoft Fabric" | Joe Muziki, Li Liu | Thu 11:30 AM | **CRITICAL** -- Direct competitor session. Likely showcases native monitoring capabilities and gaps. |
| "What's new in Fabric capacities and capacity monitoring" | Arsalan Yarveisi, Pankaj Arora | Thu 8:00 AM | **HIGH** -- Capacity monitoring improvements could overlap with our FinOps Guardrails roadmap. |
| "Beyond Monitoring: AI-Driven Spark Optimization in Microsoft Fabric" | Anu Venkataraman, Virginia Roman | Fri 2:00 PM | **MEDIUM** -- AI-driven optimization for Spark; potential feature inspiration for our alert engine. |
| "Trusted Analytics: Data Quality in Microsoft Fabric & Purview" | Shafiq Mannan, Wolfgang Strasser | Thu 10:10 AM | **HIGH** -- Purview DQ expansion; important to understand boundaries vs. operational observability. |
| "Fabric Extensibility Toolkit: Build your own Fabric item in minutes with AI" | Gerd Saurer, Teddy Bercovitz | Thu 2:00 PM | **CRITICAL** -- Our delivery mechanism. Must monitor for new capabilities, publishing updates. |
| "Mastering Fabric Data Engineering Admin and Capacity Management" | Christopher Finlan, Santhosh Kumar Ravindran | Fri 11:30 AM | **MEDIUM** -- Admin/governance controls relevant to our target persona. |
| "Unlocking Copilot in Fabric: Administration, Governance, and Beyond!" | Dan English, Sandeep Pawar | Wed 3:05 PM | **LOW** -- Copilot admin focus; tangential but relevant for AI-assisted observability. |
| "Herding Fabric Cats: Administration and Governance Guidance" | TBD | Fri | **MEDIUM** -- Admin pain points = our target audience pain points. |
| "Bulletproof Your Dataflows: Error Handling and Data Quality in Fabric" | TBD | Thu | **LOW** -- Dataflow-specific; potential correlation data source. |

**Source:** [FabCon 2026 Session Schedule](https://fabriccon.com/program/schedule) | [Top Sessions Blog Post](https://www.microsoft.com/en-us/microsoft-fabric/blog/2026/02/03/top-sessions-you-wont-want-to-miss-at-the-microsoft-fabric-community-conference-2026/)

### Implications for Observability Workbench

- **Session "Monitor and troubleshoot your data solution"** will likely surface the exact pain points we solve. Content from this session can feed directly into our marketing materials and blog posts.
- **Extensibility Toolkit session** is led by Gerd Saurer (the FET lead). Any new capabilities announced here directly affect our development roadmap.
- **No dedicated observability workload session exists** -- reinforcing that Microsoft sees this as a gap, not a solved problem.
- **Post-FabCon content wave** will create peak Fabric community engagement. We should publish content within 1--2 weeks of the event.

### Action Items

- [ ] Monitor FabCon keynote recordings for observability-related announcements
- [ ] Watch Gerd Saurer's Extensibility Toolkit session for new FET capabilities
- [ ] Capture monitoring session content for competitive intelligence
- [ ] Prepare a post-FabCon blog post: "What FabCon 2026 Revealed About Fabric Observability Gaps"
- [ ] Engage with FabCon attendees on LinkedIn/Twitter using #FabCon2026 #MicrosoftFabric

---

## 2. March 2026 Fabric Monthly Update

### Status: Not Yet Published (as of 2026-03-09)

The March 2026 Feature Summary has not been published yet. Based on historical patterns, it typically drops in the last week of the month. The most recent update is February 2026.

### February 2026 Feature Summary (Most Recent)

Key features relevant to our product:

| Feature | Category | Impact on Us |
|---|---|---|
| **SQL Pool Insights** (`queryinsights.sql_pool_insights`) | Monitoring | NEW system view for Data Warehouse pool-level telemetry. We should ingest this data. |
| **Real-Time Scoring Endpoint Monitoring** | Monitoring | ML model monitoring for request volume, error rates, latency. Parallel to our approach. |
| **OneLake Catalog Enhanced Details** | Governance | Item-level lineage visualization, schema display, permissions management in one page. Potential data source for our lineage correlation. |
| **Fabric Identity Limit Increase** | Admin | Default limit raised from 1,000 to 10,000 identities. Larger enterprise adoption = bigger market. |
| **Notebook CMK Encryption** | Security | Customer-managed key support for notebooks. Enterprise compliance enabler. |
| **VS Code Extension Enhancements** | Developer | Workspace browsing, item definition editing, Fabric MCP server integration with GitHub Copilot. |
| **Notebook Version History Labels** | Developer | Version source tracking (portal, Git, deployment pipeline, VS Code). Useful for audit trail correlation. |

**Source:** [Fabric February 2026 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-february-2026-feature-summary/)

### January 2026 Feature Summary

Key features relevant to our product:

| Feature | Category | Impact on Us |
|---|---|---|
| **OneLake Diagnostics Immutable Logs** | Monitoring | Diagnostic events can be made immutable during retention. Strengthens audit trails -- potential data source. |
| **Lineage for Materialized Lake Views** | Governance | Notebook source tracking for materialized views, deleted source flagging. New lineage data point. |
| **High Concurrency Mode Monitoring** | Monitoring | HC_ sessions traceable in Monitoring Hub. We need to handle this naming convention in our correlation engine. |
| **Granular OneLake Security APIs** | Security | New REST APIs for Get/Create/Delete role operations. Enables our permission-aware features. |
| **Item Reference Variable Type** | Security | Variables validate user access to referenced items. Relevant for secure pipeline orchestration. |

**Source:** [Fabric January 2026 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-january-2026-feature-summary/)

### Critical Tenant Setting Change (March 23, 2026)

**MC1234653: "Workspace Admins Will Be Allowed to Enable Monitoring" -- Default Enabled March 23**

| Detail | Value |
|---|---|
| Effective Date | March 23, 2026 |
| Change | Tenant setting "Workspace admins can turn on monitoring for their workspaces" will be **enabled by default** |
| Impact | Does NOT auto-enable monitoring; gives workspace admins the ability to opt in |
| Current Default | Disabled (admins must explicitly grant this permission) |

**Source:** [MC1234653 -- Tenant Default Change](https://blog.tophhie.cloud/m365-message-center/message/mc1234653/)

**Implications for Observability Workbench:**
- This change will cause a **surge in workspace monitoring adoption** as admins discover they can now enable it without tenant admin intervention.
- More users will experience the **30-day retention limitation** firsthand, creating demand for our long-retention solution.
- This is a **marketing trigger event** -- we should publish content explaining what workspace monitoring provides and what it lacks (retention, cross-item correlation, SLOs).
- **Timing is perfect**: March 23 (tenant change) + post-FabCon awareness = peak opportunity for our messaging.

### Workspace Monitoring Retention: Still 30 Days

After exhaustive searching, workspace monitoring retention **remains fixed at 30 days** with no announced plans to extend it. This is the single most important validation of our value proposition.

| Monitoring Limitation | Status (March 2026) | Our Solution |
|---|---|---|
| Workspace monitoring retention | **30 days (unchanged)** | 90-365 days configurable |
| Monitoring hub activity limit | **100 activities (unchanged)** | Unlimited historical |
| Cross-item correlation | **Not available natively** | Correlation engine with cross-item tracking |
| SLO framework | **Not available** | Built-in SLO definitions, dashboards, alerting |
| Proactive alerting | **Not available** | "Likely to breach" detectors |
| Keyword search scope | **Only loaded data** | Full historical search |

---

## 3. Fabric Extensibility Toolkit Updates

### Current State (March 2026)

The Fabric Extensibility Toolkit (FET) is the official path forward for building custom Fabric workloads. It replaces the older Workload Development Kit (WDK) with a TypeScript-first, frontend-centric approach.

| Milestone | Date | Status |
|---|---|---|
| FET Introduction (FabCon Vienna) | Sep 2025 | Complete |
| Publishing Workloads Announcement | Dec 2025 | Complete |
| Validation Guidelines Published | Dec 2025 | Complete |
| Validation Tool (Preview) | Dec 2025 | Available |
| Community Contest Submissions | Feb 13, 2026 | Closed |
| Contest Winners Announced | Feb 20, 2026 | Announced (details not found) |
| FabCon Session: "Build your own Fabric item in minutes with AI" | Mar 19, 2026 | Upcoming |

**Source:** [FET Publishing Announcements](https://blog.fabric.microsoft.com/en-us/blog/fabric-extensibility-toolkit-publishing-workloads-announcements) | [FET Contest Announcement](https://blog.fabric.microsoft.com/en-us/blog/announcing-the-fabric-extensibility-toolkit-contest/)

### Key Capabilities Available Now

- **Copilot-Optimized Starter Kit**: Build Fabric items in hours/days
- **Integrated Authentication**: Microsoft Entra tokens out of the box
- **OneLake Integration**: Store item state in Fabric
- **Native Fabric Integration**: Power BI reports, Spark jobs
- **Platform Capabilities**: SaaS scalability and security foundation
- **Workload Hub Publishing**: Partners can publish directly to the hub

### Features Still Under Development

| Feature | Status | Impact on Us |
|---|---|---|
| **Fabric Scheduler Support** | Under development | CRITICAL -- needed for our scheduled collection jobs |
| **CI/CD Support** | Under development | HIGH -- needed for our deployment pipeline |
| **CRUD Notification API** | Under development | HIGH -- needed for real-time event capture |

**Source:** [FET Overview](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/extensibility-toolkit-overview) | [FET GitHub](https://github.com/microsoft/fabric-extensibility-toolkit)

### FabCon Session Preview

The session "Fabric Extensibility Toolkit: Build your own Fabric item in minutes with AI" (Thu 2:00 PM) is led by **Gerd Saurer and Teddy Bercovitz**. Key expectations:
- Demo of AI-assisted item creation using the Copilot Starter Kit
- Potential announcement of new FET capabilities (scheduler? CI/CD?)
- Publishing pipeline updates and new partner workloads
- Contest winner showcases

### Implications for Observability Workbench

- Our TypeScript-first approach aligns perfectly with FET's architecture.
- **Scheduler support** is the biggest blocker for our FET migration. If announced at FabCon, we should accelerate our migration timeline.
- The Validation Tool and guidelines give us a clear path to Workload Hub publishing.
- The FabCon session may announce new FET features that change our implementation approach -- we must watch this session closely.

### Action Items

- [ ] Monitor FabCon FET session for scheduler/CI/CD announcements
- [ ] Review FET Validation Tool against our current codebase
- [ ] Prepare FET migration plan (conditional on scheduler support announcement)
- [ ] Track contest winners for potential partnership or competitive intelligence

---

## 4. Fabric Workload Hub

### Current Workloads (as of March 2026)

Only **3 partner workloads** are published in the Fabric Workload Hub:

| Workload | Publisher | Category | Relevance |
|---|---|---|---|
| **2TEST** | 2TEST | Quality Assurance | Automated testing and data quality checks. Adjacent to our space but focused on QA, not operational observability. |
| **Informatica Cloud Data Quality** | Informatica | Data Quality | Profile, detect, and fix data quality issues in Fabric. Data quality, NOT operational monitoring. |
| **SQL2Fabric-Mirroring** | Striim | Data Replication | Zero-code SQL Server to OneLake mirroring. Not competitive. |

**Source:** [Add a Microsoft Fabric Workload](https://learn.microsoft.com/en-us/fabric/workload-development-kit/more-workloads-add)

### Analysis

- **No observability or monitoring workload exists in the Workload Hub.** This is our greenfield opportunity.
- The Hub is still very early (only 3 workloads), meaning early publishers will get disproportionate visibility.
- Informatica's DQ workload validates that data quality ISVs see value in the Fabric workload model, but they focus on data quality (schema, values, profiling) not operational observability (job health, SLOs, correlations).
- The low number of workloads suggests the publishing process is still maturing. Early entrants face friction but also face less competition.

### Implications for Observability Workbench

- **First-mover advantage is real**: Being the first observability workload in the Hub would establish category ownership.
- We should aim to publish within Q2 2026 if FET scheduler support is available.
- The Workload Hub is likely to be prominently featured at FabCon, driving awareness.

---

## 5. Competitor Activity

### Overview: Data Observability Market in 2026

The data observability market continues to grow but remains fragmented. No competitor has announced a Fabric-native workload (published to the Workload Hub). All existing solutions use external integrations.

### Monte Carlo

| Detail | Value |
|---|---|
| Market Position | Leader -- enterprise-grade, end-to-end data observability |
| Fabric Integration | Available via Azure Marketplace (SaaS). Monitors Fabric via metadata APIs. NOT a native workload. |
| Pricing | Starts ~$80K+/year (enterprise) |
| Recent Activity | Expanded to "Data + AI Observability" branding. Added transactional database integrations (Postgres, MySQL, SQL Server). Positioned in common stack: "Purview + Monte Carlo for always-on observability" |
| Threat Level | **MEDIUM** -- Strong product but prohibitive pricing for most Fabric shops. External tool, not native. |

**Source:** [Monte Carlo Fabric Integration Blog](https://www.montecarlodata.com/blog-monte-carlo-microsoft-azure-synapse-fabric/) | [Monte Carlo Platform](https://www.montecarlodata.com/)

### Atlan

| Detail | Value |
|---|---|
| Market Position | Leader in Data Governance (Gartner Magic Quadrant 2026) |
| Fabric Integration | Catalog connector -- discovers workspaces, reports, dashboards, datasets, pipelines, dataflows. Governance focus, not operational monitoring. |
| Pricing | Starts ~$198K+/year (enterprise) |
| Recent Activity | Named Leader in 2026 Gartner MQ for D&A Governance. Positioning as "active metadata platform." |
| Threat Level | **LOW** -- Governance/catalog focus, not operational observability. Different buyer persona. |

**Source:** [Atlan Fabric Integration Docs](https://docs.atlan.com/apps/connectors/business-intelligence/microsoft-fabric) | [Atlan Data Observability Tools List](https://atlan.com/know/data-observability-tools/)

### Soda

| Detail | Value |
|---|---|
| Market Position | Developer-centric data quality and observability |
| Fabric Integration | Direct connection via SodaCL. Supports data contracts and monitoring on Fabric. |
| Pricing | Freemium + Cloud paid tiers (more accessible than Monte Carlo/Atlan) |
| Recent Activity | **Soda 4.0 launched January 28, 2026** -- major rewrite. New data contracts engine, unified cloud platform, full observability features. Positioned in common stack: "Purview + Soda for always-on observability" |
| Threat Level | **MEDIUM** -- Closest to our approach in terms of developer audience and pricing. But still external, not Fabric-native. |

**Source:** [Soda Fabric Connection Docs](https://docs.soda.io/data-source-reference/connect-fabric) | [Soda Release Notes](https://docs.soda.io/release-notes/soda-cloud-release-notes)

### Elementary (dbt-native)

| Detail | Value |
|---|---|
| Market Position | dbt-native data observability |
| Fabric Integration | Works via dbt-fabric adapter. Anomaly detection, freshness/volume/schema monitoring. |
| Pricing | OSS (free) + Cloud paid tiers |
| Recent Activity | Elementary Cloud expanded to "Data & AI Control Plane" with ML monitoring, column-level lineage, built-in catalog, AI agents. dbt-Fabric integration expanding to Fusion engine in 2026. |
| Threat Level | **LOW** -- Requires dbt adoption. Only covers dbt-managed assets, not full Fabric operational observability. |

**Source:** [Elementary GitHub](https://github.com/elementary-data/elementary)

### Great Expectations (GX)

| Detail | Value |
|---|---|
| Market Position | Python-first data quality validation |
| Fabric Integration | Via Python/PySpark in Fabric notebooks |
| Pricing | OSS (free) + GX Cloud paid tiers |
| Recent Activity | Positioned in common stack: "Purview + GX for detailed pipeline validation" |
| Threat Level | **LOW** -- Data quality validation focus, not operational monitoring. Requires custom implementation. |

**Source:** [Comparing Fabric DQ Tools](https://www.timextender.com/blog/product-technology/comparing-microsoft-fabric-data-quality-features-to-other-tools)

### DataKitchen

| Detail | Value |
|---|---|
| Market Position | DataOps and open-source data observability |
| Fabric Integration | No direct Fabric integration found |
| Recent Activity | Published comprehensive "2026 Data Quality and Data Observability Commercial Software Landscape" report. Offers certification programs. |
| Threat Level | **NEGLIGIBLE** -- No Fabric presence. |

**Source:** [DataKitchen 2026 Commercial Landscape](https://datakitchen.io/the-2026-data-quality-and-data-observability-commercial-software-landscape/)

### Microsoft Purview (Native -- Platform Risk)

| Detail | Value |
|---|---|
| Market Position | Microsoft's first-party data governance and quality platform |
| Fabric Integration | Native -- deeply integrated with Fabric |
| Recent Activity (March 2026) | **Custom SQL expression rules reached GA in March 2026**. Incremental scanning in preview (Feb 2026). Error record publishing GA (Feb 2026). AI-powered profiling. |
| Threat Level | **MEDIUM-HIGH for data quality. LOW for operational observability.** Purview focuses on data quality dimensions (accuracy, completeness, consistency) NOT operational metrics (job health, SLOs, duration regression, cross-item correlation). |

**Source:** [Purview DQ in Unified Catalog](https://learn.microsoft.com/en-us/purview/unified-catalog-data-quality) | [Custom SQL Rules Article](https://medium.com/@marcoOesterlin/microsoft-just-made-data-quality-in-microsoft-purview-easier-with-sql-expressions-and-nobody-779dbbbbc8c4)

### Competitive Positioning Summary

```
                    Fabric-Native    Operational Observability    Price Point
                    Integration      (Jobs, SLOs, Correlation)
---------------------------------------------------------------------------
Our Workbench       YES (Workload)   YES (core focus)            $499-1,499/mo
Monte Carlo         NO (SaaS)        Partial (metadata)          $80K+/yr
Atlan               NO (Connector)   NO (governance focus)       $198K+/yr
Soda 4.0            NO (External)    Partial (data quality)      Freemium+
Elementary          NO (dbt-native)  Partial (dbt assets only)   Freemium+
Great Expectations  NO (Python lib)  NO (validation only)        Freemium+
Purview             YES (Native)     NO (data quality only)      Included
---------------------------------------------------------------------------
```

**Key Insight:** We are the ONLY solution combining Fabric-native integration with operational observability focus at an accessible price point. This positioning is unique and defensible.

---

## 6. Microsoft Purview Data Quality Expansion

### March 2026 GA: Custom SQL Expression Rules

Microsoft Purview's data quality capabilities are expanding rapidly:

| Feature | Status | Date |
|---|---|---|
| Custom SQL expression rules | **GA** | March 2026 |
| Incremental scanning | Preview | February 2026 |
| Error record publishing | **GA** | February 2026 |
| AI-powered data profiling | Available | 2025 |
| No-code/low-code rule creation | Available | 2025 |

### Differentiation: Purview DQ vs. Observability Workbench

| Dimension | Purview DQ | Observability Workbench |
|---|---|---|
| **Focus** | Data quality (values, schema, completeness) | Operational observability (job health, SLOs, correlations) |
| **What it monitors** | Data content and structure | Job execution, pipeline runs, refresh cycles |
| **Cross-item correlation** | No | Yes -- pipeline to notebook to dataflow to refresh |
| **SLO framework** | No | Yes -- freshness, success rate, duration |
| **Long-term retention** | N/A (quality rules, not event logs) | 90--365 days |
| **Proactive alerting** | No | Yes -- "likely to breach" detectors |
| **Target persona** | Data stewards, governance teams | Data engineers, platform admins |

**Key Insight:** Purview DQ and our Observability Workbench are **complementary, not competitive**. We should position integration with Purview as a feature, not a conflict.

---

## 7. Technology Signals and Emerging Patterns

### Fabric Ecosystem Trends (Q1 2026)

1. **AI/Agentic capabilities are the dominant theme.** FabCon 2025 was about "agentic capabilities" and FabCon 2026 continues this with Fabric IQ, ontologies, and AI agents. Our product should incorporate AI-driven anomaly detection to align with this trend.

2. **30,000+ organizations in Fabric production.** Confirmed by community sources. The addressable market is large and growing.

3. **SQLCon co-location signals SQL-first strategy.** Microsoft is leaning hard into SQL for Fabric. Our KQL-based approach is differentiated but we should ensure SQL accessibility for broader adoption.

4. **dbt-Fabric integration deepening.** dbt running natively in Fabric (Fabric dbt Job) means dbt-adjacent tools like Elementary gain relevance. We should support ingesting dbt run results.

5. **VS Code + MCP Server integration.** The Fabric VS Code extension now integrates with MCP servers and GitHub Copilot. This is a developer experience trend we should monitor for our own tooling.

6. **Spark Monitoring APIs expanding.** Spark Advisor API (recommendations, skew diagnostics) and Resource Usage API (vCore metrics) provide new data sources for our collector.

### Emerging Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Microsoft builds native SLO framework | Low (12-month) | High | Ship first, build community, establish as default |
| Microsoft extends workspace monitoring retention | Low (6-month) | Medium | Our value is correlation + SLOs, not just retention |
| Monte Carlo builds Fabric-native integration | Low-Medium | Medium | Price advantage + native workload experience |
| FET scheduler delayed beyond Q2 2026 | Medium | High | Continue with current npm/API approach, migrate when ready |
| Purview DQ expands into operational monitoring | Low (12-month) | Medium | Different persona and use case; maintain differentiation |

---

## 8. Strategic Recommendations

### Immediate Actions (March 2026)

1. **Prepare post-FabCon content** -- Blog post analyzing observability gaps highlighted at the conference. Target publication: March 24--28.

2. **Monitor March 23 tenant setting change** -- This is a marketing trigger. Publish content explaining what workspace monitoring gives you and what it does not (retention, correlation, SLOs).

3. **Watch FabCon Extensibility Toolkit session** -- If scheduler support is announced, immediately begin FET migration planning.

4. **Engage FabCon community** -- Comment on session recordings, share insights on LinkedIn with #FabCon2026.

### Short-Term (April--May 2026)

5. **Ingest new data sources** -- Add SQL Pool Insights, Spark Advisor API, and OneLake Diagnostics immutable logs to our collector.

6. **Begin FET validation** -- Run our codebase against the Validation Tool preview to understand migration effort.

7. **Position as Purview complement** -- Marketing messaging should emphasize "Purview for data quality + Observability Workbench for operational observability."

8. **Publish competitive comparison content** -- "Why Fabric Teams Don't Need $80K/year Observability" targeting Monte Carlo and Atlan price sensitivity.

### Medium-Term (Q2--Q3 2026)

9. **Target Workload Hub publication** -- Aim to be the first observability workload in the Hub.

10. **Build FabCon 2026 recap into content calendar** -- Reference session content in blog posts to capture search traffic.

11. **Explore dbt integration** -- Support ingesting dbt run results for teams using dbt-Fabric.

12. **AI-driven anomaly detection** -- Align with the dominant AI theme in the Fabric ecosystem.

---

## 9. Key Dates and Timeline

| Date | Event | Action Required |
|---|---|---|
| Mar 9 | This report published | Distribute to team |
| Mar 16--20 | FabCon 2026, Atlanta | Monitor sessions, engage community |
| Mar 19 | FET session (Thu 2:00 PM) | Watch for scheduler/CI/CD announcements |
| Mar 19 | Monitoring session (Thu 11:30 AM) | Capture competitive intelligence |
| Mar 23 | Tenant default change (workspace monitoring) | Publish marketing content |
| Mar ~25 | March 2026 Feature Summary (expected) | Analyze for product impact |
| Apr | Post-FabCon content push | Blog posts, social media |
| Q2 2026 | FET scheduler (hoped) | Begin FET migration if available |
| Q2 2026 | Workload Hub submission (target) | First observability workload |

---

## Sources

### Microsoft Official
- [Fabric February 2026 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-february-2026-feature-summary/)
- [Fabric January 2026 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-january-2026-feature-summary/)
- [FabCon 2026 Official Site](https://fabriccon.com/)
- [FabCon 2026 Session Schedule](https://fabriccon.com/program/schedule)
- [Top FabCon 2026 Sessions -- Microsoft Blog](https://www.microsoft.com/en-us/microsoft-fabric/blog/2026/02/03/top-sessions-you-wont-want-to-miss-at-the-microsoft-fabric-community-conference-2026/)
- [FabCon/SQLCon Workshops and Keynotes](https://www.microsoft.com/en-us/microsoft-fabric/blog/2025/12/17/fabcon-and-sqlcon-from-workshops-and-keynotes-to-demos-and-deep-dives/)
- [FET Publishing Announcements](https://blog.fabric.microsoft.com/en-us/blog/fabric-extensibility-toolkit-publishing-workloads-announcements)
- [FET Contest Announcement](https://blog.fabric.microsoft.com/en-us/blog/announcing-the-fabric-extensibility-toolkit-contest/)
- [FET Overview -- Learn](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/extensibility-toolkit-overview)
- [FET GitHub](https://github.com/microsoft/fabric-extensibility-toolkit)
- [Workspace Monitoring Overview](https://learn.microsoft.com/en-us/fabric/fundamentals/workspace-monitoring-overview)
- [MC1234653 -- Tenant Default Change](https://blog.tophhie.cloud/m365-message-center/message/mc1234653/)
- [Purview Data Quality in Unified Catalog](https://learn.microsoft.com/en-us/purview/unified-catalog-data-quality)
- [Fabric Roadmap](https://roadmap.fabric.microsoft.com/)
- [Fabric What's New](https://learn.microsoft.com/en-us/fabric/fundamentals/whats-new)
- [Fabric Workload Hub](https://learn.microsoft.com/en-us/fabric/workload-development-kit/more-workloads-add)
- [Eventhouse Monitoring Preview Blog](https://blog.fabric.microsoft.com/en-us/blog/eventhouse-monitoring-public-preview)

### Competitor Sources
- [Monte Carlo -- Fabric Integration](https://www.montecarlodata.com/blog-monte-carlo-microsoft-azure-synapse-fabric/)
- [Monte Carlo -- Azure Marketplace](https://marketplace.microsoft.com/en-us/product/saas/montecarlo.montecarlodata)
- [Atlan -- Fabric Integration Docs](https://docs.atlan.com/apps/connectors/business-intelligence/microsoft-fabric)
- [Atlan -- Data Observability Tools 2026](https://atlan.com/know/data-observability-tools/)
- [Soda -- Fabric Connection](https://docs.soda.io/data-source-reference/connect-fabric)
- [Elementary -- GitHub](https://github.com/elementary-data/elementary)
- [DataKitchen -- 2026 Commercial Landscape](https://datakitchen.io/the-2026-data-quality-and-data-observability-commercial-software-landscape/)
- [DataKitchen -- 2026 Open Source Landscape](https://datakitchen.io/the-2026-open-source-data-quality-and-data-observability-landscape/)

### Industry Analysis
- [Comparing Fabric DQ to Other Tools -- TimeXtender](https://www.timextender.com/blog/product-technology/comparing-microsoft-fabric-data-quality-features-to-other-tools)
- [Fabric 2026 Trends -- PowerBI Consulting](https://powerbiconsulting.com/blog/microsoft-fabric-2026-trends)
- [Fabric Security 2026 -- Data-Driven](https://data-driven.com/blog/whats-next-for-microsoft-fabric-security-compliance-in-2026/)
- [What to Expect at FabCon 2026 -- SQL Server BI Blog](https://sqlserverbi.blog/2026/03/02/fabcon-sqlcon-what-to-expect-in-atlanta-this-year/)
- [Top Data Observability Tools 2026 -- Integrate.io](https://www.integrate.io/blog/top-data-observability-tools/)
- [Purview Custom SQL Rules -- Medium](https://medium.com/@marcoOesterlin/microsoft-just-made-data-quality-in-microsoft-purview-easier-with-sql-expressions-and-nobody-779dbbbbc8c4)

---

*Report prepared by Product Trend Researcher Agent. Next scheduled update: 2026-03-23 (post-FabCon review).*
