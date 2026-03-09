# Week 6-8 Social Media Posts

> Posting cadence: LinkedIn 2x/week (Tuesday + Thursday), Reddit 2x/week across subreddits
> Tone: authentic data engineer sharing insights, not brand marketing
> Phase: Community Engagement + Practical How-Tos (per content calendar)

---

## Week 6

### LinkedIn Post #1 (Tuesday): Insight -- The 24.5% Alert Rate

I ran an observability tool against a live Fabric environment for one week. 24.5% of job events triggered an alert.

The monitoring hub showed almost all of these as "Completed."

Here is what the alerts caught:
- 2 notebooks with silent duration regressions (P95 up 150%+ week-over-week). They succeeded every run. They were just getting slower.
- 1 semantic model refreshing on stale data because its source pipeline was running 2 hours later than usual.
- 1 pipeline that triggered 3 notebooks -- 2 ran for 12 minutes as expected, 1 completed in 8 seconds (empty input table, early exit). Pipeline status: Completed.

The monitoring hub showed green checkmarks for all of these. SLO tracking caught every one.

The takeaway: "Completed" tells you the job ran. It does not tell you the data is correct.

If you are running Fabric in production, I wrote a guide on building your first SLO (success rate, duration, and freshness) with KQL queries you can run today: [link to Blog 03]

#MicrosoftFabric #DataEngineering #Observability #SLO

---

### LinkedIn Post #2 (Thursday): Engagement Question -- Error Budgets

Question for data engineering teams running Fabric:

When your daily pipeline fails, how do you decide if it is a problem worth investigating immediately or something that can wait?

In SRE, the concept of an "error budget" solves this. You define a target (e.g., 99% success rate over 7 days). Failures consume from that budget. When the budget is exhausted, you stop shipping new features and fix reliability.

Most data teams I have talked to do not have this. The decision to investigate a failure is based on who notices, how loudly they escalate, and whether the on-call person is busy with something else.

I think error budgets for data pipelines are coming. The concept is too useful to stay exclusive to infrastructure SRE.

Are any Fabric teams using error budgets for data pipelines today? What does your decision framework look like when something fails?

#MicrosoftFabric #DataEngineering #SRE #DataQuality

---

### Reddit Post #1: r/MicrosoftFabric

**Title:** PSA: Your Fabric pipeline can "Succeed" while delivering stale data -- here's how to check

**Body:**

Something I have been digging into recently that I think more people should be aware of.

In Fabric, a pipeline's status of "Completed" means the job ran to completion without an unhandled exception. It does NOT mean:
- The source data was fresh
- The expected number of rows was processed
- Upstream dependencies completed before this pipeline ran
- The output data is actually different from yesterday

I have seen a pattern where a Dataflow Gen2 fails or returns partial data, but the downstream pipeline runs on schedule anyway, processes stale data, and reports "Completed." The semantic model refreshes on that stale data. The monitoring hub shows green across the board. The report is wrong for hours.

Some things that help catch this:
- Track freshness (hours since last successful run) per item, not just pass/fail
- Compare today's run duration against the baseline -- a pipeline that usually takes 15 min completing in 8 seconds is probably processing zero rows
- If you have an Eventhouse, this KQL query finds items that might be serving stale data:

```kql
FabricEvents
| where Status == "Completed"
| summarize LastSuccess = max(EndTimeUtc) by ItemName
| extend FreshnessHours = datetime_diff('hour', now(), LastSuccess)
| where FreshnessHours > 12
| order by FreshnessHours desc
```

Has anyone else run into this? Curious how teams are handling the "succeeded but stale" problem.

---

### Reddit Post #2: r/dataengineering

**Title:** SLOs for data pipelines -- is anyone actually doing this?

**Body:**

I have been implementing SLOs (Service Level Objectives) for data pipelines in Microsoft Fabric and wanted to see if anyone else in this sub is doing similar.

The three SLO types I am tracking:
1. **Success rate**: % of runs that completed over a rolling 7-day window (target: 99%)
2. **Duration**: P95 execution time compared to baseline (flag if >50% regression)
3. **Freshness**: Hours since last successful completion (target depends on cadence)

The freshness one has been the most valuable by far. We caught a pipeline that had a 100% success rate over 30 days but was running on stale upstream data 10% of the time. The monitoring tools showed green. The SLO framework caught the freshness gap.

I wrote the KQL queries for this against a Fabric Eventhouse. Happy to share the query pack if anyone is interested -- it is part of an open-source project: https://github.com/tenfingerseddy/FabricWorkloads

For people not on Fabric: the same concepts apply to any orchestrator. The idea is that pass/fail status is a necessary but insufficient signal for data pipeline health.

Are other teams tracking SLOs for data workloads? What metrics are you using?

---

## Week 7

### LinkedIn Post #3 (Tuesday): Product Update -- KQL Query Pack

We just published a community query pack for Microsoft Fabric observability. 30+ KQL queries, organized by use case:

**Pipeline Health**
- Success rate by item (rolling 7-day window)
- Consecutive failure detection
- Duration regression week-over-week

**SLO Tracking**
- Combined SLO dashboard (success rate + duration + freshness)
- Error budget burn rate calculation
- SLO trend over time

**Silent Failure Detection**
- Stale data detector (items that succeeded after upstream failures)
- Anomalous duration detector (suspiciously fast completions)
- Freshness gap analysis

**Cross-Item Correlation**
- Pipeline-to-notebook execution chains
- End-to-end chain duration
- Blast radius mapping

Every query is copy-paste ready for any Eventhouse with Fabric job event data.

The full pack is in the GitHub repo, and we are accepting community contributions -- if you have a useful KQL query for Fabric monitoring, open a PR.

Link: https://github.com/tenfingerseddy/FabricWorkloads

#MicrosoftFabric #KQL #DataEngineering #OpenSource

---

### LinkedIn Post #4 (Thursday): Insight -- The Freshness Problem

The most dangerous metric in data engineering is a stale report that looks current.

When a pipeline fails, someone notices. There is an error. There is a red status. People investigate.

When a pipeline succeeds on stale data, nobody notices. The report renders. The numbers look plausible (they are real numbers -- just from yesterday). Decisions get made on wrong information. The failure is invisible until a domain expert says "wait, this does not look right."

In our Fabric environment, freshness violations account for more real-world impact than outright failures. A failed pipeline is a 30-minute fix. A report that has been wrong since midnight is 8 hours of decisions based on bad data.

This is why freshness SLOs matter more than success rate SLOs for most data teams. "Is the data current?" is a more important question than "did the pipeline run?"

We wrote up how to build freshness tracking with KQL: [link to Blog 03]

#MicrosoftFabric #DataQuality #Observability #DataEngineering

---

### Reddit Post #3: r/MicrosoftFabric

**Title:** Free KQL query pack for Fabric monitoring -- 30+ queries covering SLOs, duration regression, freshness tracking

**Body:**

I have been building KQL queries for monitoring our Fabric environment and packaged them into a reusable query pack. Thought others might find it useful.

**What is included:**

Success rate tracking:
- Rolling 7-day success rate per item
- Error budget calculation
- Consecutive failure detection

Duration monitoring:
- P50/P95 duration by item
- Week-over-week regression detection (flags 50%+ increases)
- Anomalous duration detector (catches suspiciously fast runs)

Freshness tracking:
- Hours since last successful completion
- Freshness trend over time (is your pipeline finishing later each day?)
- Freshness gap detector

Cross-item correlation:
- Pipeline-to-notebook execution chains
- End-to-end chain duration
- Blast radius queries

**Requirements:**
- A Fabric Eventhouse with job event data (the repo includes an ingestion notebook that sets this up)
- The queries use a `FabricEvents` table schema documented in the repo

Everything is open source (MIT): https://github.com/tenfingerseddy/FabricWorkloads

If you have KQL queries you use for Fabric monitoring that are not covered here, I would love to add them. PRs welcome or just share in the comments and I will add attribution.

---

### Reddit Post #4: r/BusinessIntelligence

**Title:** For BI teams on Fabric: how do you know your reports are showing fresh data?

**Body:**

This is a question I have been wrestling with as we scale our Fabric deployment.

The scenario: a semantic model refreshes on schedule and shows "Completed." The report renders fine. But the upstream pipeline that feeds the model ran on stale source data because an earlier step failed. The report is technically "refreshed" -- it is just refreshed with yesterday's data.

Fabric's monitoring hub does not connect these dots. You see each item's status independently. There is no native way to ask "is the data in this report actually current?"

We have been building freshness tracking that works backwards from the report: what is the timestamp of the most recent data in the semantic model's source table? Is it within the expected window? If the source table has not been updated in the last N hours, flag the report as stale -- regardless of whether the refresh "succeeded."

This KQL query is the simplest version of this check:

```kql
FabricEvents
| where Status == "Completed"
| summarize LastSuccess = max(EndTimeUtc) by ItemName, ItemType
| extend FreshnessHours = round(datetime_diff('second', now(), LastSuccess) / 3600.0, 1)
| where ItemType == "SemanticModel"
| extend Status = case(
    FreshnessHours <= 6, "Fresh",
    FreshnessHours <= 12, "Aging",
    "Stale"
  )
| order by FreshnessHours desc
```

How are other BI teams handling this? Are you tracking data freshness, or relying on refresh status alone?

---

## Week 8

### LinkedIn Post #5 (Tuesday): Thought Leadership -- Status vs. Behavior

I have been thinking about a distinction that keeps coming up in conversations with Fabric teams:

**Status monitoring**: Did it run? Did it succeed?
**Behavior observability**: Did fresh data flow end-to-end? Did it arrive on time? Is the volume consistent with expectations?

Most teams have the first one covered. Almost nobody has the second.

The gap matters because status is a proxy for correctness, and it is a leaky proxy. I have seen pipelines with 100% success rates that delivered wrong data 10% of the time (they ran before their upstream dependencies completed). I have seen notebooks that succeeded every run but got 50% slower over two weeks (invisible until they eventually timed out).

Behavior observability requires three things status monitoring does not provide:
1. Cross-item correlation (knowing that Pipeline A feeds Notebook B feeds Model C)
2. SLO tracking over rolling windows (not just individual run pass/fail)
3. Freshness validation (did the data actually change, not just did the job run?)

This is what we are building with Observability Workbench. But even without our tool, these are questions every Fabric team should be asking.

Wrote up the full argument with examples: [link to Blog 04]

#MicrosoftFabric #DataEngineering #Observability

---

### LinkedIn Post #6 (Thursday): Engagement Question -- Monitoring Tooling

Poll for Fabric data engineers:

What is the single most useful improvement to Fabric's native monitoring that would save you the most time?

A) Retention beyond 30 days in the monitoring hub
B) Cross-item correlation (see pipeline-to-notebook-to-model chains)
C) SLO / error budget framework built into Fabric
D) Better alerting (not just Data Activator, but SLO-aware alerts)
E) Something else (drop it in the comments)

I have been talking to a lot of Fabric teams and the answers vary more than I expected. Curious what this audience thinks.

#MicrosoftFabric #DataEngineering #Poll

---

### Reddit Post #5: r/MicrosoftFabric

**Title:** We caught a pipeline with 100% success rate that was delivering wrong data 10% of the time -- here's how

**Body:**

Sharing a pattern we found that I think is worth being aware of.

We have a production pipeline in Fabric that maintains a 100% success rate over the last 30 days. The monitoring hub shows green every single day.

But when we built cross-item correlation (mapping which items feed which downstream items), we found that on 3 of those 30 days, the pipeline ran *before* its upstream dependency completed. It processed yesterday's data instead of today's. The semantic model refreshed on that stale data. The reports were subtly wrong for approximately 4 hours.

The monitoring hub correctly reported "Completed" for all items. The data was incorrect.

How we caught it:
1. We ingest all job events into an Eventhouse with timestamps
2. We correlate pipeline execution start times with upstream item completion times
3. If a pipeline starts before its expected upstream completes, we flag it as "ran on stale data"
4. We track freshness (hours since last successful upstream completion at the time of downstream execution)

This is essentially what the concept of "freshness SLOs" solves. Instead of just checking pass/fail, you check whether the data the pipeline consumed was actually current.

The open-source tool we built for this is here: https://github.com/tenfingerseddy/FabricWorkloads

But even without a tool, the mental model is useful: "Completed" means the job ran successfully. It does not mean the data is correct. Those are different questions, and they need different monitoring.

Has anyone else found similar patterns in their Fabric environments?

---

### Reddit Post #6: r/dataengineering

**Title:** Duration regression detection for data pipelines -- catching the slow creep before it becomes an outage

**Body:**

One of the more useful monitoring patterns I have implemented recently: tracking P95 execution duration week-over-week for data pipelines and flagging regressions.

The scenario: a notebook runs every day. It always succeeds. But it has been getting 5-10% slower each week for the past month. Nobody notices because it still completes within the schedule window. Then one day it does not complete in time, the downstream pipeline starts processing partial data, and you have an incident.

The fix is surprisingly simple: compare this week's P95 duration against last week's for every item, and flag anything with more than a 50% increase.

In KQL (we use a Fabric Eventhouse, but the logic translates to any time-series store):

```kql
let CurrentWeek = FabricEvents
    | where Timestamp > ago(7d) and Status == "Completed" and DurationMs > 0
    | summarize CurrentP95 = percentile(DurationMs, 95) by ItemName;
let PreviousWeek = FabricEvents
    | where Timestamp between (ago(14d) .. ago(7d))
    | where Status == "Completed" and DurationMs > 0
    | summarize PreviousP95 = percentile(DurationMs, 95) by ItemName;
CurrentWeek
| join kind=inner PreviousWeek on ItemName
| extend Ratio = round(todouble(CurrentP95) / PreviousP95, 2)
| where Ratio > 1.5
| project ItemName,
    Previous_Min = round(PreviousP95 / 60000.0, 1),
    Current_Min = round(CurrentP95 / 60000.0, 1),
    Ratio
| order by Ratio desc
```

In our environment, this caught two notebooks with silent duration regressions before they caused downstream failures. Both had 100% success rates. Both were heading toward eventual timeouts.

Anyone else tracking duration trends for data pipelines? What thresholds do you use?
