# Community Post Templates

> Version 1.0 | March 2026
> 5 templates for Reddit and Microsoft Tech Community
> Strategy: Lead with genuine value, mention the tool only where naturally relevant

---

## Usage Guidelines

- **Never post from a brand account.** Always use a personal account with established posting history in the subreddit.
- **The 9:1 rule.** For every post that references Observability Workbench, make 9 genuinely helpful comments on other threads that have nothing to do with the product.
- **Do not astroturf.** Never ask colleagues or friends to upvote, comment positively, or coordinate engagement. Reddit communities detect and punish this aggressively.
- **Respond to every comment.** Substantive replies within 4-6 hours. If someone criticizes the approach, engage honestly. Defensive responses destroy credibility.
- **Cross-posting cadence.** Wait at least 3 days between posts in the same subreddit. Adapt each post to the subreddit's culture and expectations.
- **Disclosure.** If directly asked "are you affiliated with this tool?" always answer honestly. Never misrepresent your relationship to the project.

---

## Template 1: KQL Monitoring Queries (Value-First)

**Target subreddits:** r/MicrosoftFabric, r/dataengineering
**Target community:** Microsoft Tech Community (Fabric forum)
**Mention of tool:** Minimal -- only in a footnote or "if you want more" context

### Reddit Version

```
Title: 5 KQL queries I use to monitor our Fabric environment (with examples)

We've been running a significant Fabric workload (20+ pipelines across
multiple workspaces) and I've built up a set of KQL queries that I run
against our Eventhouse to keep tabs on things. Sharing the ones that have
been most useful in case others find them helpful.

---

**1. Workspace Health Scorecard**

Shows per-workspace success rate, average duration, and a letter grade
for the last 7 days. I run this every Monday morning.

```kql
FabricEvents
| where StartTimeUtc > ago(7d)
| where Status in ("Completed", "Failed", "Cancelled")
| summarize
    TotalJobs     = count(),
    Succeeded     = countif(Status == "Completed"),
    Failed        = countif(Status == "Failed")
    by WorkspaceName
| extend SuccessRate = round(100.0 * Succeeded / TotalJobs, 1)
| extend Grade = case(
    SuccessRate >= 99, "A",
    SuccessRate >= 95, "B",
    SuccessRate >= 90, "C",
    SuccessRate >= 80, "D",
    "F")
| project WorkspaceName, TotalJobs, SuccessRate, Grade
| order by SuccessRate asc
```

**2. Pipeline Duration Regression Detection**

Flags pipelines whose P95 execution time this week is more than 50%
higher than their 30-day baseline. Catches creeping performance issues
before they become SLO problems.

```kql
let baseline_window = ago(30d);
let recent_window = ago(7d);
FabricEvents
| where ItemType == "DataPipeline" and Status == "Completed"
| summarize
    BaselineP95 = percentile(DurationSeconds, 95) by ItemName
    | join kind=inner (
        FabricEvents
        | where StartTimeUtc > recent_window
        | where ItemType == "DataPipeline" and Status == "Completed"
        | summarize RecentP95 = percentile(DurationSeconds, 95) by ItemName
    ) on ItemName
| extend RegressionPct = round(100.0 * (RecentP95 - BaselineP95) / BaselineP95, 1)
| where RegressionPct > 50
| project ItemName, BaselineP95, RecentP95, RegressionPct
| order by RegressionPct desc
```

**3. Failure Pattern Analysis**

Groups failures by item and error reason to show recurring problems.
The ones at the top are your highest-ROI fixes.

```kql
FabricEvents
| where StartTimeUtc > ago(14d)
| where Status == "Failed"
| summarize
    FailureCount  = count(),
    LastOccurrence = max(StartTimeUtc),
    FirstSeen      = min(StartTimeUtc)
    by ItemName, ItemType, FailureReason
| extend DaysActive = datetime_diff('day', LastOccurrence, FirstSeen)
| order by FailureCount desc
| take 20
```

**4. Stale Items (No Activity in 7+ Days)**

Finds items that used to run regularly but have gone silent. Sometimes
this means a schedule broke. Sometimes it means someone disabled
something without telling anyone.

```kql
let active_items = FabricEvents
    | where StartTimeUtc > ago(90d)
    | summarize LastRun = max(StartTimeUtc), RunCount = count() by ItemId, ItemName, ItemType
    | where RunCount > 5;
active_items
| where LastRun < ago(7d)
| extend DaysSilent = datetime_diff('day', now(), LastRun)
| order by DaysSilent desc
```

**5. Hourly Job Volume Heatmap**

Shows when your Fabric environment is busiest. Useful for capacity
planning and identifying scheduling conflicts.

```kql
FabricEvents
| where StartTimeUtc > ago(14d)
| extend Hour = hourofday(StartTimeUtc)
| extend DayOfWeek = dayofweek(StartTimeUtc) / 1d
| summarize JobCount = count() by DayOfWeek, Hour
| order by DayOfWeek asc, Hour asc
```

---

I've got about 15 more of these that cover things like cross-item
correlation, SLO compliance tracking, and CU waste estimation. If there's
interest I can share the full set -- I published them as an open-source
query pack here: https://github.com/tenfingerseddy/FabricWorkloads/blob/main/kql/community-query-pack.kql

What KQL queries are you all running for Fabric monitoring? Curious what
I'm missing.
```

### Microsoft Tech Community Version

Adapt the same content but use a more formal tone. Replace "you all" with "the community." Add a brief introduction explaining the context ("I've been working with Fabric Eventhouse for monitoring purposes and wanted to share some queries that have been useful for our team"). Remove any casual language.

---

## Template 2: The Monitoring Retention Problem (Problem-Focused Discussion)

**Target subreddits:** r/MicrosoftFabric, r/PowerBI
**Target community:** Microsoft Tech Community (Ideas forum)
**Mention of tool:** Only if someone asks "how did you solve this?" in comments

### Reddit Version

```
Title: How are you handling the 30-day monitoring retention limit in Fabric?

Genuine question for teams running Fabric in production. The monitoring
hub caps at 30 days of activity history (and really only shows 100
activities at a time in the UI). Workspace monitoring is also 30 days
and is now billed against your capacity.

We had an incident last month where a pipeline started failing
intermittently. By the time we noticed the pattern, the earliest
failures had already aged out of the monitoring hub. We couldn't
establish when the problem actually started or correlate it with a
deployment change from 5 weeks prior.

What we've tried:
- Exporting monitoring hub data via REST API on a schedule and storing
  it in an Eventhouse (this is our current approach -- works but requires
  maintenance)
- Using the capacity metrics app for some historical data, but it
  doesn't have the event-level detail we need
- Purview for lineage, but it doesn't capture runtime events

What we haven't figured out well:
- Cross-item correlation. When a pipeline triggers a notebook that
  feeds a dataflow that refreshes a semantic model, tracing failures
  across that chain is still manual work for us
- SLO tracking. We'd love to define "this semantic model must be
  refreshed within 2 hours" and track compliance over time, but there's
  no native way to do this

How is everyone else dealing with this? Are you:
1. Accepting the 30-day limit and dealing with the blind spots?
2. Building custom solutions to extend retention?
3. Using a third-party tool (and if so, which one)?
4. Something else entirely?

Particularly interested in hearing from teams with 10+ workspaces and
complex pipeline chains. The single-workspace case is manageable, but
it gets painful at scale.
```

### Comment Strategy

- If someone describes a similar pain, empathize and share specific details about your experience.
- If someone asks "what did you end up building?" share a brief description and the GitHub link.
- If someone recommends a third-party tool, ask honest questions about it. Do not badmouth competitors.
- If someone from Microsoft responds about upcoming features, thank them and ask clarifying questions.

---

## Template 3: SLO Framework for Data Engineering (Educational)

**Target subreddits:** r/dataengineering, r/MicrosoftFabric
**Target community:** Microsoft Tech Community
**Mention of tool:** Only as "this is how we implemented it" if asked directly

### Reddit Version

```
Title: Applying SRE-style SLOs to data pipelines -- here's what worked (and what didn't)

My team borrowed the SLO (Service Level Objective) framework from SRE
and applied it to our Fabric data pipelines. Six months in, I wanted
to share what we learned.

**Background**

We manage ~40 pipelines, 15 notebooks, and 8 semantic models across
multiple Fabric workspaces. Before SLOs, our definition of "healthy"
was "nobody is yelling at us." That's not a measurement system.

**The 3 SLO types that actually matter for data**

1. **Freshness SLO**: "The data in [semantic model / lakehouse table]
   must be no older than [X hours]."

   This is the one stakeholders care about most. They don't care if
   a pipeline failed -- they care if the dashboard they're looking at
   has stale numbers. We set freshness SLOs per semantic model based
   on how frequently the source data changes and how critical the
   downstream reports are.

   Example: "Sales dashboard semantic model must be refreshed within
   2 hours of source update. Target: 99.5% compliance over 30 days."

2. **Success Rate SLO**: "Pipeline [X] must complete successfully at
   least [Y%] of the time over a rolling [Z] day window."

   This catches intermittent failures that don't show up in spot
   checks. A pipeline that fails 3% of the time doesn't feel broken
   on any given day, but over a month it means 1 failed run per day
   on a daily pipeline.

   Example: "Daily ETL pipeline must succeed >= 99% over rolling
   7 days. Error budget: 1 allowed failure per week."

3. **Duration SLO**: "Pipeline [X] P95 execution time must be under
   [Y minutes] over a rolling [Z] day window."

   This catches performance regression before it causes downstream
   freshness breaches. If a 10-minute pipeline starts taking 25
   minutes, the duration SLO fires before the freshness SLO does.

   Example: "Nightly transformation notebook P95 duration must be
   < 30 minutes over rolling 7 days."

**What worked**

- Starting with freshness SLOs only. We added success rate and
  duration after 2 months. Trying to do all three at once would
  have been overwhelming.
- Setting realistic initial targets. We measured actual performance
  for 2 weeks before setting targets. Starting with aspirational
  targets just means constant breach alerts that everyone learns
  to ignore.
- Error budgets changed the conversation. Instead of "the pipeline
  failed, this is a crisis," the conversation became "we've used
  40% of our error budget this week, should we investigate or is
  this expected?" Much calmer.
- Reviewing SLO compliance weekly in a 15-minute team standup.
  The trends matter more than any single data point.

**What didn't work**

- Alerting on every SLO breach immediately. We got alert fatigue in
  week 2. We switched to alerting only when error budget consumption
  rate suggests we'll exhaust the budget before the window resets.
- Tracking too many SLOs per item. Start with 1 per item. You can
  always add more later.
- Not involving stakeholders in SLO target setting. When the business
  says "we need 100% uptime" and you set 99.5%, you need to have
  that conversation explicitly. Error budgets only work if everyone
  agrees on the budget.

**How we implemented it**

We store events in a Fabric Eventhouse, compute SLO metrics with
scheduled KQL queries, and track compliance in a simple dashboard.
The SLO definitions themselves are just configuration records:
target metric, threshold, time window, and error budget.

Happy to share specific KQL queries or go deeper on any of these if
it would be helpful. Has anyone else tried applying SLOs to their
data platform? What metrics are you tracking?
```

### Comment Strategy

- Engage deeply with anyone who shares their own SLO implementation.
- If asked about the implementation specifics, share KQL snippets from the community query pack.
- If asked "is there a tool for this?" share the GitHub link with context: "I ended up building something for this -- it's open source on GitHub."
- If someone mentions a competing approach (dbt tests, Great Expectations, etc.), discuss how it compares honestly. Acknowledge strengths of other tools.

---

## Template 4: The Cross-Item Correlation Challenge (Technical Deep-Dive)

**Target subreddits:** r/MicrosoftFabric, r/dataengineering
**Target community:** Microsoft Tech Community
**Mention of tool:** Natural reference as "the project I built to solve this"

### Reddit Version

```
Title: Tracing failures across Fabric item types -- pipelines, notebooks,
dataflows, and semantic models

One of the most frustrating things about debugging failures in Fabric
is the lack of cross-item correlation. When a downstream semantic model
refresh shows stale data, the investigation is entirely manual:

1. Check the semantic model refresh history
2. Find the dataflow that feeds it -- check its history
3. Find the notebook that dataflow depends on -- check its history
4. Find the pipeline that orchestrates the notebook -- check its history
5. Somewhere in that chain, find the actual root cause

With 4+ items in a dependency chain, each with its own monitoring
surface, this takes 15-30 minutes per incident. For a team handling
5+ incidents per week, that's real time.

**The correlation problem**

Fabric doesn't natively connect events across item types. The
monitoring hub shows each item's activity independently. There's no
"rootActivityId" that traces through the full chain the way distributed
tracing works in microservices.

Here's what I found works for building correlation:

**Approach 1: Pipeline Activity Runs API**

The `QueryActivityRuns` endpoint on the pipeline API is underused. It
returns activity-level detail including the triggered child item IDs.
For a pipeline that invokes a notebook:

```
GET /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/{jobId}/queryActivityRuns
```

The response includes InvokedItemId for each activity, which gives
you the direct parent-child link between the pipeline run and the
notebook execution.

**Approach 2: Temporal Proximity + Item Metadata**

For items not directly invoked by pipelines (e.g., event-triggered
dataflows, scheduled semantic model refreshes), you can infer
correlation by:

1. Querying workspace item metadata to know which items exist
2. Matching event timestamps: if a dataflow completes at 10:15 and
   a semantic model refresh starts at 10:16, and there's a known
   dependency relationship, the correlation has high confidence

This requires maintaining a dependency graph, which you can build
from a combination of lineage API data and manual configuration.

**Approach 3: RootActivityId Matching**

In some cases, Fabric propagates a RootActivityId across related
operations. This isn't documented consistently, but for pipeline-
triggered jobs, the RootActivityId from the parent often appears
in the child event. When present, this is the most reliable
correlation signal.

**What I built**

I ended up building an automated correlation engine that combines
all three approaches, assigns confidence scores (API-confirmed
links get 100%, temporal matches get a confidence based on time
gap and known dependency), and stores the correlation chains in
an Eventhouse table. It runs every 15 minutes.

The result: when a semantic model shows stale data, I can query
the correlation chain and see the full story in seconds instead
of 15 minutes of manual investigation.

I published the whole thing as open source (MIT):
https://github.com/tenfingerseddy/FabricWorkloads

The correlation logic is in the notebooks if you want to see the
implementation details.

**Questions for the community**

- Has anyone found other reliable correlation signals in Fabric
  that I'm missing?
- Are there undocumented APIs or event properties that carry
  correlation context?
- How are you handling this in your environments?
```

---

## Template 5: "What I Learned" Retrospective (Builder Narrative)

**Target subreddits:** r/MicrosoftFabric, r/dataengineering, r/SideProject
**Target community:** Microsoft Tech Community
**Mention of tool:** Central to the post, but the focus is on lessons learned, not product promotion

### Reddit Version

```
Title: I built a Fabric observability tool and here's what I learned about
monitoring data platforms

Over the past few months, I've been building an open-source observability
tool specifically for Microsoft Fabric. I want to share some things I
learned along the way -- not about the tool itself, but about the problem
space. Some of these surprised me.

**1. The monitoring data you think you have, you don't**

Fabric's monitoring hub shows 100 activities at a time with 30-day
retention. Workspace monitoring also caps at 30 days. My assumption
was that most teams would be supplementing this with custom solutions.

In conversations with data engineers, I found the opposite: most teams
rely exclusively on the native monitoring hub and don't realize how
much they're missing until they need historical data for an incident
investigation and it's already gone.

The gap between "what teams think they can see" and "what they can
actually see" is wider than I expected.

**2. Cross-item correlation is the real pain, not retention**

I started this project thinking retention was the biggest problem. It
is a real problem, but in every conversation with practitioners, the
frustration that generates the most energy is cross-item correlation.

"When the dashboard is stale, I need to check 4 different places to
find out why" -- some version of this came up in nearly every
conversation. The monitoring hub shows each item independently. There
is no way to say "show me everything related to this failure."

In hindsight, this makes sense. Retention is an infrastructure
problem that you solve once. Correlation is an operational problem
that you deal with multiple times per week.

**3. Nobody has SLOs for their data platform**

In the SRE world, SLOs are standard practice. In data engineering,
they're almost nonexistent. I asked teams: "What's your freshness
target for your most important semantic model?" The most common
answer was something like "as fast as possible" or "within a few
hours, I guess."

Without explicit SLOs, there's no error budget, no objective
measurement of health, and no shared definition of "good enough"
between the data team and stakeholders. Every stale report becomes
an emergency because there's no framework for distinguishing
"within tolerance" from "actually broken."

**4. Teams underestimate the cost of manual monitoring**

I asked one team how they currently handle monitoring. Their answer:
a senior data engineer spends about 2 hours every morning checking
the monitoring hub, capacity metrics, and a custom Power BI report.
That is 10 hours per week of a senior engineer's time on a task
that should be automated.

When I calculated the annual cost of that (senior DE salary / 40
hours * 10 hours * 52 weeks), the number was eye-opening for them.
It significantly exceeded the cost of any monitoring tool.

**5. Read-only tooling has a massive trust advantage**

The biggest objection I heard from IT admins wasn't about cost or
features -- it was about trust. "What does it do to my environment?"
When I could answer "it reads Fabric APIs and writes to its own
storage; it never modifies your items," the conversation changed
immediately.

For anyone building tools in the Fabric ecosystem: design for
read-only access from day one. The permission model matters more
than the feature set for initial adoption.

**6. Fabric's API surface is deeper than the documentation suggests**

The Pipeline Activity Runs API (`QueryActivityRuns`) is barely
documented but returns rich data about individual pipeline activity
executions, including triggered child items. The lineage APIs
provide dependency information that's useful for building
correlation graphs. The monitoring hub REST API returns data that
isn't surfaced in the UI.

The data is there. It just requires significant effort to discover,
combine, and maintain.

**The project**

If you want to see what came out of all this:
https://github.com/tenfingerseddy/FabricWorkloads

MIT license. 187 tests. Live infrastructure. The KQL community
query pack alone might be useful even if you don't use the rest
of the tool.

I'm also looking for 10 design partners -- teams who use Fabric
in production and want to shape the tool's direction in exchange
for free Professional access. Details are in the repo's discussions.

What are your biggest observability pain points in Fabric? I'm
genuinely curious whether these observations match your experience
or if I'm missing something.
```

---

## Posting Schedule

Recommended cadence to avoid over-posting while maintaining presence:

| Week | Post | Subreddit | Template |
|------|------|-----------|----------|
| 1 | KQL Queries | r/MicrosoftFabric | Template 1 |
| 1 | SLO Framework | r/dataengineering | Template 3 |
| 2 | Retention Problem | r/MicrosoftFabric | Template 2 |
| 2 | KQL Queries | Microsoft Tech Community | Template 1 (adapted) |
| 3 | Cross-Item Correlation | r/MicrosoftFabric | Template 4 |
| 3 | Builder Retrospective | r/dataengineering | Template 5 |
| 4 | SLO Framework | r/MicrosoftFabric | Template 3 |
| 4 | Builder Retrospective | r/SideProject | Template 5 (adapted) |

Between these posts, maintain 9:1 ratio of helpful comments to promotional posts. Comment on other threads about Fabric monitoring, pipeline debugging, capacity optimization, and data quality -- providing genuine help without mentioning the tool unless directly relevant to the question.

---

## Comment Templates for Other Threads

When answering questions in existing threads (not your own posts), use these patterns.

### When someone asks about monitoring hub limitations

```
Yeah, the 100-activity display limit and 30-day retention are the two
biggest constraints. For the retention issue, you can use the monitoring
hub REST API to export events on a schedule and store them in an
Eventhouse for long-term querying. The API endpoint is:

GET /v1/workspaces/{workspaceId}/monitoringHub/activities

If you set up a notebook on a 5-minute schedule to pull new events,
you can build up a 90+ day history pretty quickly. Happy to share
the KQL table schema if that would help.
```

### When someone asks about tracking pipeline failures

```
Two things that helped us:

1. The QueryActivityRuns API on pipelines gives you activity-level
   detail that the monitoring hub doesn't surface. You can see which
   specific activity in a pipeline failed and what child items it
   triggered.

2. Storing events in an Eventhouse and running a failure pattern
   query periodically. This groups failures by item and error reason
   so you can see recurring issues:

[Include the failure pattern KQL query from Template 1]

The recurring failures at the top of that list are your highest-ROI
fixes.
```

### When someone asks about Fabric monitoring tools / best practices

```
I've been looking into this extensively. The native options are:

- Monitoring hub (30 days, 100 activities, limited search)
- Workspace monitoring (30 days, now billed against capacity)
- Capacity metrics app (capacity-level, not item-level)
- Purview (lineage and governance, not operational monitoring)

For third-party options, Monte Carlo and Atlan support Fabric but as
external integrations -- they require data egress and start at $80K+/yr.

If you're comfortable with a more hands-on approach, you can build a
monitoring pipeline yourself: REST API export to Eventhouse + KQL
queries for analysis. I published a set of KQL queries that cover
common monitoring use cases: [GitHub link to query pack]
```

---

## Metrics to Track

For each community post, track:

| Metric | Where to Measure |
|--------|-----------------|
| Post karma / upvotes | Reddit, Tech Community |
| Comment count | Reddit, Tech Community |
| GitHub repo referral traffic | GitHub Insights > Traffic > Referring sites |
| Star increases within 48 hours of post | GitHub star history |
| Inbound messages (DMs, emails) | Personal inbox |
| Design partner inquiries | Outreach tracking spreadsheet |
| New discussions opened on GitHub | GitHub Discussions |
