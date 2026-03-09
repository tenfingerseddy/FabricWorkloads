# Week 3 Social Media Posts — FabCon 2026 Week

> Theme: FabCon 2026 — Capitalizing on the biggest Fabric event of the year
> Timing: March 16-20, 2026 (FabCon + SQLCon, Atlanta)
> Strategy: Real-time engagement with announcements, reference our content, position as observability thought leader

---

## Pre-FabCon (Sunday March 15)

### LinkedIn Post: FabCon Preview

FabCon 2026 starts tomorrow. 200+ sessions, thousands of data engineers, and some major announcements expected.

Here's what I'm watching for in the observability space:

**1. Monitoring Hub improvements.** February's update added hierarchical pipeline views — great progress. But we still can't monitor dataflows, notebooks, or get cross-item correlation natively. Will FabCon close the gap?

**2. Workspace Monitoring billing.** Now that it's a paid feature, will Microsoft expand what it can actually monitor? Currently it doesn't cover pipelines, dataflows, or notebooks.

**3. Data Activator at scale.** Per-item configuration doesn't work when you have 200 pipelines across 8 workspaces. Will we see wildcard/workspace-level monitoring?

**4. Extensibility Toolkit workloads.** Partners can now publish to the Workload Hub. Will we see observability-focused workloads announced?

These are the gaps that keep data engineers up at night. Fabric's compute model is powerful, but without comprehensive observability, teams fly blind on reliability, cost, and incident response.

Following along from home? I'll be sharing highlights and analysis all week.

#FabCon2026 #MicrosoftFabric #DataEngineering #Observability

---

## Monday March 16 (Day 1)

### LinkedIn Post: Day 1 Observations

Day 1 of FabCon 2026 — here are my key takeaways from the keynote and early sessions:

[TEMPLATE — fill in after keynote announcements]

What I'm still waiting to hear:
- Cross-item correlation (pipeline → notebook → dataflow → semantic model)
- SLO frameworks for data reliability
- Long-retention monitoring beyond 30 days

If you're attending, what announcements are you most excited about?

#FabCon2026 #MicrosoftFabric

---

## Tuesday March 17 (Day 2)

### LinkedIn Post: The Monitoring Gap Reality Check

Interesting sessions at FabCon today. Let me share a reality check.

Here's what Fabric monitoring looks like today for a team running 50+ pipelines:

1. Check Monitoring Hub (30-day retention, 100 activity limit)
2. Cross-reference with Workspace Monitoring (if enabled — now billed)
3. Query the API for comprehensive history (rate limited)
4. Create wrapper pipelines with Outlook activities for alerting (yes, really)
5. Build custom PowerShell scripts to track failures
6. Manually correlate across item types when something breaks

This is the state of the art in 2026. For the most advanced unified analytics platform on the market.

The good news? Microsoft is investing. The Feb 2026 updates show real progress. And the Extensibility Toolkit means the community can fill gaps faster than ever.

We're building an open-source observability workbench specifically for these pain points. Early version on GitHub: https://github.com/tenfingerseddy/FabricWorkloads

#FabCon2026 #MicrosoftFabric #DataEngineering #Observability

---

## Wednesday March 18 (Day 3 — typically biggest announcement day)

### LinkedIn Post: Announcements Analysis

[TEMPLATE — update with actual Day 3 announcements]

Key question: Does anything announced today change the observability landscape?

What's improved:
- [list actual improvements announced]

What's still missing:
- Cross-item correlation engine
- Long-retention telemetry (beyond 30 days)
- SLO/error budget framework
- Cost-per-pipeline attribution
- Proactive "likely to breach" alerting

We built the Observability Workbench to address exactly these gaps. Today's announcements [reinforce/change] our thesis that teams need a dedicated observability layer.

Star the repo if this resonates: https://github.com/tenfingerseddy/FabricWorkloads

#FabCon2026 #MicrosoftFabric

---

## Thursday March 19

### LinkedIn Post: Practical Takeaway

The best FabCon sessions are the ones that give you something actionable to do Monday morning.

Here's my "FabCon action list" for observability:

**Do this week:**
□ Enable Workspace Monitoring (if you haven't — but know it's now billed)
□ Audit your pipeline retry policies (default retries = hidden CU waste)
□ Check your Monitoring Hub — are you hitting the 100-activity cap?

**Do this month:**
□ Set up alerting for your top 5 critical pipelines (even if it's manual)
□ Document your data freshness expectations (the first step to SLOs)
□ Calculate CU cost per pipeline (use the formula from our blog series)

**Consider:**
□ Evaluate purpose-built observability tools for Fabric
□ Try our open-source Observability Workbench: https://github.com/tenfingerseddy/FabricWorkloads
□ Start tracking P95 duration trends — the leading indicator of pipeline degradation

#FabCon2026 #MicrosoftFabric #DataEngineering

---

## Friday March 20 (Wrap-up)

### LinkedIn Post: FabCon Wrap-Up

FabCon 2026 wrap-up — the state of Fabric observability:

**What Microsoft shipped that matters:**
- Hierarchical pipeline monitoring views (Feb 2026)
- Item Details with lineage visualization
- Workspace Monitoring (now GA with billing)
[Add any FabCon announcements]

**What the community still needs:**
- Cross-workspace, cross-item observability
- Retention beyond 30 days for trend analysis
- SLO frameworks for data reliability engineering
- Alert rules that don't require per-item configuration
- Cost attribution and FinOps integration

**What we're doing about it:**
Building the Observability Workbench — an open-source Fabric workload that fills these gaps. Already collecting and correlating data from real Fabric environments.

Current capabilities:
✓ Multi-workspace discovery and inventory
✓ Job collection with long-retention storage (Eventhouse)
✓ Cross-item correlation engine
✓ SLO metrics (success rate, duration, freshness)
✓ Alert rules with Teams/webhook notifications
✓ CLI dashboard for terminal-first operators

Star the repo: https://github.com/tenfingerseddy/FabricWorkloads

Great conference. See you next year — hopefully with fewer observability gaps to talk about.

#FabCon2026 #MicrosoftFabric #DataEngineering #Observability #OpenSource

---

## Reddit Posts

### r/MicrosoftFabric (Tuesday)

**Title:** "FabCon 2026 — Any announcements about monitoring/observability improvements?"

**Body:**
Following FabCon from home. Curious if anyone attending has heard about improvements to:

- Monitoring Hub (still limited to 100 activities, 30-day retention?)
- Cross-item correlation (pipeline → notebook → dataflow)
- Alerting beyond per-item Data Activator setup
- Workspace Monitoring expansion (currently doesn't cover pipelines)

The Feb 2026 update added hierarchical pipeline views which is nice, but we're running 60+ items across 4 workspaces and the monitoring story is still pretty fragmented.

What are others using for comprehensive Fabric observability?

### r/MicrosoftFabric (Friday)

**Title:** "Post-FabCon: What's your monitoring/alerting setup for Fabric pipelines?"

**Body:**
Now that FabCon is wrapping up, wanted to start a practical discussion.

What does your Fabric monitoring look like? Here's our current setup:
- Monitoring Hub for quick spot checks
- Custom notebook that queries the Fabric API for job history
- Eventhouse for long-term telemetry storage
- KQL queries for cross-item correlation

We've been building tooling around this and open-sourced it: https://github.com/tenfingerseddy/FabricWorkloads

Curious what others are doing. Anyone using Data Activator for pipeline alerts? How are you handling the per-item configuration limitation?
