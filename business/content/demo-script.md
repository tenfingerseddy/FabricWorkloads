# Demo Script: Observability Workbench for Microsoft Fabric

> Version 1.0 | March 2026
> 15-minute demo for design partner prospects
> Includes backup plan for CLI-only demo if DevGateway is not ready

---

## Pre-Demo Checklist

Complete these at least 30 minutes before the demo.

- [ ] Fabric tenant accessible and capacity active ("Kanes Trial" FTL64)
- [ ] ObservabilityWorkbench-Dev workspace loaded in browser tab
- [ ] Eventhouse EH_Observability open in a second browser tab
- [ ] KQL query editor open with pre-loaded queries (correlation chain, SLO snapshot, recent failures)
- [ ] CLI terminal open with `npm run` commands ready to paste
- [ ] GitHub repo open in a third tab (for showing test count, CI status)
- [ ] Screen sharing configured: hide bookmarks bar, close unrelated tabs, increase font size to 16px+
- [ ] Notifications silenced on all devices
- [ ] Backup slides loaded (see Section 7 below) in case of environment issues
- [ ] Timer visible to you (not the audience) -- set to 15 minutes

---

## Demo Flow: 15-Minute Structure

### Minute 0:00-2:00 -- Set the Context (Do NOT Open the Product Yet)

**Goal**: Establish the problem before showing the solution. Resist the urge to jump into the tool.

**Talking points:**

> "Before I show you anything, let me set up why this exists. If you are running Fabric in production, you have probably hit some version of this problem."

Open the Fabric monitoring hub in the portal (your real tenant). Point to specific limitations:

> "This is the monitoring hub. It shows me the last 100 activities from the last 30 days. I have [X] workspaces running [Y] pipelines daily. At that volume, this view saturates in less than two days. If I need to investigate something that happened 6 weeks ago, the data is gone."

Scroll the monitoring hub. Let the audience see how limited the list is.

> "Now here is the harder problem. Let's say this pipeline failed [point to a specific failed item]. That pipeline feeds a notebook, which triggers a dataflow, which refreshes a semantic model that powers a report the finance team checks every morning. To trace that chain, I have to open four separate items, compare timestamps manually, and hope all the evidence is still within the 30-day window. There is no 'show me what this failure caused downstream.'"

**Pause and ask:**

> "Is this a scenario your team has dealt with? How do you handle cross-item debugging today?"

Let them talk. Listen for specific pain points you can reference later. This is not a rhetorical question -- their answer tells you which features to emphasize.

---

### Minute 2:00-3:30 -- Introduce the Solution (30-Second Overview)

**Goal**: One sentence on what it is, then immediately show it.

> "Observability Workbench is a Fabric-native observability tool. It ingests monitoring data into an Eventhouse for long retention, correlates events across item types automatically, and tracks SLOs. Everything runs inside your Fabric tenant -- no data leaves your environment. Let me show you what that looks like with real data."

Switch to the ObservabilityWorkbench-Dev workspace in Fabric.

> "This is the tool's home. It lives in a dedicated Fabric workspace. You can see the Eventhouse where all monitoring data is stored, the Lakehouse for long-term archive, and three notebooks that handle ingestion, correlation, and alerting."

Point to each item briefly. Do not click into them yet.

---

### Minute 3:30-6:00 -- Live Data: The Event Store

**Goal**: Show real monitoring data with retention beyond 30 days and full-text search.

Open the Eventhouse KQL query editor. Run this query:

```kql
FabricEvents
| summarize Count = count() by bin(StartTime, 1h)
| order by StartTime desc
| take 48
```

> "This is the FabricEvents table. Every monitoring hub event and workspace monitoring signal gets ingested here automatically every 5 minutes. Right now I have [X] events spanning [Y] days. Native monitoring would have lost everything older than 30 days."

Run a search query:

```kql
FabricEvents
| where Status == "Failed"
| project StartTime, ItemName, ItemType, Status, ErrorMessage
| order by StartTime desc
| take 20
```

> "Full-text search across all historical events. I can find every failure for a specific item, a specific error message, or a specific time window -- regardless of whether it happened yesterday or three months ago."

**Pause and ask:**

> "How far back does your team typically need to look when investigating incidents?"

---

### Minute 6:00-8:30 -- Cross-Item Correlation

**Goal**: This is the highest-value feature. Spend time here.

Run this query:

```kql
EventCorrelations
| join kind=inner (FabricEvents | project EventId, ItemName, ItemType, Status, StartTime) on $left.UpstreamEventId == $right.EventId
| join kind=inner (FabricEvents | project EventId, ItemName, ItemType, Status, StartTime) on $left.DownstreamEventId == $right.EventId
| project
    UpstreamItem = ItemName, UpstreamType = ItemType, UpstreamStatus = Status,
    DownstreamItem = ItemName1, DownstreamType = ItemType1, DownstreamStatus = Status1,
    CorrelationType, Confidence
| take 20
```

> "This is the correlation engine output. Each row represents a discovered dependency: this upstream item affected this downstream item. The engine runs every 15 minutes and automatically discovers these chains by matching timestamps, workspace context, and item relationships."

Show a specific chain:

> "Here is a concrete example. [Point to a row.] This pipeline failure caused this notebook to produce stale output, which meant this semantic model refresh used old data. In native Fabric, you would need to manually trace this across three different monitoring surfaces. Here, it is one query."

Run the workspace inventory query:

```kql
WorkspaceInventory
| summarize ItemCount = count() by WorkspaceName, ItemType
| order by WorkspaceName asc, ItemCount desc
```

> "The tool also maintains a live inventory of all your workspaces and items. This is the foundation for correlation -- it knows what exists, what depends on what, and what has changed."

**Pause and ask:**

> "When something fails in your environment, how long does it typically take to identify the full blast radius? Is that something your team currently tracks?"

---

### Minute 8:30-11:00 -- SLO Tracking

**Goal**: Show that SLOs are a first-class concept, not just dashboards.

Run this query:

```kql
SloDefinitions
| where IsActive == true
| project SloName, SloType, TargetValue, WindowDays, ItemType
```

> "These are active SLO definitions. Each one says: for this item type, this metric must meet this target over this rolling window. Right now I have [X] active SLOs covering freshness, success rate, and duration targets."

Show SLO snapshots:

```kql
SloSnapshots
| where IsBreaching == true
| project ComputedAt, SloName, CurrentValue, TargetValue, IsBreaching
| order by ComputedAt desc
| take 10
```

> "SLO snapshots are computed every 15 minutes. This shows any SLOs that are currently breaching or have recently breached. The tool tracks error budgets over the defined window -- you can see whether you are burning through your error budget faster than expected."

If there are no current breaches:

> "No active breaches right now, which is what you want to see. Let me show you the historical view to see what a breach looks like."

```kql
SloSnapshots
| summarize BreachCount = countif(IsBreaching == true), TotalSnapshots = count() by SloName
| extend BreachRate = round(todouble(BreachCount) / TotalSnapshots * 100, 1)
| order by BreachRate desc
```

> "This shows the breach rate per SLO over the entire retention period. You can see which SLOs are consistently healthy and which are flaky. This kind of trend analysis is impossible with native monitoring because the data disappears after 30 days."

**Pause and ask:**

> "Does your team have any formal SLO targets today, even informal ones? Something like 'the daily sales refresh must succeed by 7 AM'?"

---

### Minute 11:00-12:30 -- Alerting

**Goal**: Show alert rules and the alert log. Keep this brief.

```kql
AlertRules
| project RuleName, AlertType, Threshold, NotificationChannel, IsActive
```

> "Alert rules define when and how to notify. You can alert on SLO breaches, failure spikes, duration regressions, and trend degradation. Notifications go via email or Teams webhooks."

```kql
AlertLog
| order by FiredAt desc
| take 10
| project FiredAt, RuleName, Severity, Message
```

> "The alert log shows every alert that has fired. This is your audit trail -- when did the alert fire, what triggered it, and what was the severity."

> "The alerting notebook also includes breach prediction: if an SLO's error budget is burning faster than the window allows, it fires a 'likely to breach' alert before the actual breach. You get advance warning instead of an after-the-fact notification."

---

### Minute 12:30-13:30 -- Architecture and Trust

**Goal**: Address the "is this safe" question before they ask it.

> "Let me address the elephant in the room: trust and safety."

Briefly point to the workspace structure:

> "The tool runs in its own dedicated workspace. It reads from your other workspaces via Fabric REST APIs -- the same APIs you already use. It writes only to its own Eventhouse and Lakehouse. It never modifies your pipelines, notebooks, dataflows, or semantic models. It is read-only against your environment."

> "All data stays in your Fabric tenant, in your Azure region. There is no external SaaS dependency, no data egress, no additional vendor to evaluate. The code is MIT-licensed and fully auditable on GitHub."

Switch to the GitHub repo tab. Show:
- Test count: 187 tests passing
- CI status: green
- License: MIT
- Security: audit completed, critical findings fixed

> "187 tests, CI running on every commit, security audit completed with critical findings already resolved. This is not a prototype -- it is working software with production-grade engineering practices."

---

### Minute 13:30-15:00 -- Transition to Design Partner Conversation

**Goal**: Shift from demo to dialogue. Make the ask.

> "That is the product. Let me tell you what I am looking for and what is in it for you."

> "I am building a Design Partner Program with 10 organizations. The deal is simple:"

> "You get full Professional-tier access for 12 weeks -- that is $499/month value, no cost. A direct support channel with the engineering team. And real influence over what gets built next. Partners vote on features each sprint."

> "What I ask: install it against a real Fabric environment within the first week, use it during the program, and give honest feedback every two weeks. A 30-minute call or a Loom video. That is it."

> "No contract, no commitment to purchase, no penalty for leaving. At the end of 12 weeks, you can continue on the free tier, convert to paid at 50% discount, or walk away. The only thing I ask is honesty about what works and what does not."

**The close:**

> "Based on what you have told me about [reference their pain point from earlier in the conversation], I think this would be directly relevant to your team. Does this sound like something worth exploring? The next step would be a 10-question application form that takes about 5 minutes, and then we can schedule onboarding within a week."

---

## Section 7: Backup Plan -- CLI Demo + Slides

Use this plan if the Fabric portal is inaccessible, the Eventhouse is down, or the DevGateway environment is not ready.

### Setup

- Terminal with the CLI installed (`@kane-ai/observability-workbench`)
- Pre-captured screenshots of KQL query results (save 5-6 screenshots before the demo as insurance)
- Architecture diagram slide (use the one from the one-pager or README)

### Modified Flow

**Minutes 0-2**: Same context-setting (use Fabric portal screenshots of monitoring hub limitations if portal is accessible; use pre-captured screenshots if not).

**Minutes 2-5**: Show the CLI.

```bash
npx @kane-ai/observability-workbench health-check
```

> "This is the CLI entry point. It connects to your Fabric tenant, queries your workspaces, and produces a health summary. Let me run it."

If the CLI connects and produces output, walk through the output. If it does not connect (tenant issues), use pre-captured output:

> "I am going to show you captured output from our live environment because [brief honest explanation of why live is unavailable]."

**Minutes 5-10**: Walk through pre-captured KQL screenshots.

Show each screenshot and explain what the query does, using the same talking points from the live demo sections above. Be explicit:

> "This is a screenshot from our live Eventhouse taken [timeframe]. I would normally run this live, but [reason]. The data and queries are identical."

**Minutes 10-13**: Architecture diagram + GitHub repo walkthrough.

Open the GitHub repo. Walk through:
- README (problem statement, quickstart)
- Test output (`npm test` -- run this live even in backup mode)
- CI/CD pipeline status
- KQL table definitions in `kql/` directory

**Minutes 13-15**: Same design partner transition and close as the live demo.

### Key Rule for Backup Mode

Be transparent about why you are not showing the live environment. Never pretend pre-captured data is live. Prospects respect honesty; they do not respect smoke and mirrors.

---

## Handling Common Questions During the Demo

### "Can you show it with our data?"

> "That is exactly what the design partner onboarding does. In the first session, we set up the tool against your environment and you see your own monitoring data flowing within 45 minutes. This demo uses our development environment, but the onboarding session uses yours."

### "How does this handle [specific Fabric item type we haven't mentioned]?"

> "Good question. Right now we support [list: pipelines, notebooks, dataflows, semantic model refreshes]. If [their item type] is something your team relies on, that is exactly the kind of feedback that shapes the roadmap. Design partners get to prioritize features like that."

### "What about permissions? Our Fabric admin is very security-conscious."

> "The tool uses a service principal with Contributor access to the workspaces it monitors. It reads monitoring data via the same Fabric REST APIs that any Contributor-level user can access. It writes only to its own dedicated workspace. No admin-level permissions required for the monitoring itself. We have a security audit report and checklist we can share with your admin."

### "Is this ready for production, or is it a proof of concept?"

> "The core ingestion and query path is production-grade: 187 tests, CI/CD, security audit completed. The SLO and alerting features are operational but benefit from broader testing -- which is why the design partner program exists. I would position it as: the data pipeline is solid, the analytical features are maturing, and the UX is where you will have the most feedback."

### "We are still on Power BI Premium / not yet on Fabric."

> "The tool requires Fabric capacity (F-SKU) because it uses Fabric REST APIs and Eventhouse for storage. If your organization is in the process of migrating to Fabric, the design partner program could run once that migration is underway. If you are not planning a Fabric move, this is not the right fit today -- but our roadmap includes a tool specifically for migration readiness if that becomes relevant."

### "Can we fork it and run it ourselves since it's MIT?"

> "Absolutely. MIT license means you can fork, modify, and deploy it independently. The paid tiers exist for teams that want managed features (longer retention, more workspaces, alerting, SSO) and direct support. But if you want to self-host the core engine, you are welcome to."

---

## Post-Demo Follow-Up (Within 2 Hours)

Send a follow-up message with:

1. Thank them for their time
2. Reference one specific thing they said during the demo that connects to a product feature
3. Link to the GitHub repo
4. Link to the design partner one-pager (as PDF attachment)
5. Link to the application form (or send the 10 questions inline)
6. Propose a specific onboarding date: "How does [day] at [time] work for the onboarding session?"

Do not send a generic follow-up. Personalize it based on what they said during the demo.

---

## Demo Environment Maintenance

Before every demo:

1. Verify ingestion notebook ran successfully in the last 15 minutes
2. Verify Eventhouse has recent data: `FabricEvents | summarize max(StartTime)` should be within the last 10 minutes
3. Verify at least one SLO snapshot exists from the last hour
4. Verify at least one correlation chain exists
5. Clear any personal/sensitive data from recent KQL query history
6. Test screen sharing with the correct window/tab configuration

Schedule a 15-minute "demo prep" block before every prospect call.
