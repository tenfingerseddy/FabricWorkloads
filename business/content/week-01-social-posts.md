# Week 1 Social Media Posts

## LinkedIn Post #1: The Pain Thread

I counted 4 different places you need to check when something breaks in Microsoft Fabric.

Here's what happened last week:
- A pipeline failed at 2am
- I checked Monitoring Hub -- saw it failed, but no root cause
- Went to Spark UI to check the notebook it triggered -- different tool, different context
- Opened Capacity Metrics App to see if we hit CU throttling -- completely separate interface
- Finally found the issue in the data source itself -- which no Fabric tool flagged

4 tools. 3 browser tabs. Zero correlation between them.

The worst part? The Monitoring Hub only keeps 30 days of history. So when someone asked "did this happen before?" -- I had no way to answer.

Fabric is an incredible platform. But its observability story is still fragmented across tools that don't talk to each other.

There has to be a better way.

What's your debugging workflow when something breaks? I'd love to hear how others handle this.

#MicrosoftFabric #DataEngineering #Observability #Analytics

---

## LinkedIn Post #2: Poll

How do you monitor your Microsoft Fabric workloads today?

A) Monitoring Hub only
B) Monitoring Hub + Capacity Metrics App
C) Third-party tool (which one?)
D) We built something custom
E) We... don't really monitor them yet

Asking because I've been researching the Fabric observability space and finding a surprising gap. The native tools give you pieces of the puzzle but nothing connects them.

Curious what the community's experience has been.

#MicrosoftFabric #DataEngineering #Poll

---

## Reddit Post: r/MicrosoftFabric

**Title:** What's your monitoring setup for Fabric? Finding the native tools pretty fragmented

**Body:**

Hey everyone,

Been working with Fabric for a while now and I'm finding the monitoring/observability story pretty fragmented. Between the Monitoring Hub, Capacity Metrics App, Spark UI, and individual item views, there's no single place to get a unified view of what's happening.

Some specific pain points I'm hitting:

- **30-day retention limit** in Monitoring Hub -- can't do month-over-month trending
- **No cross-item correlation** -- when a pipeline triggers a notebook that refreshes a semantic model, there's no way to see that chain natively
- **Search only works on loaded data** in Monitoring Hub -- have to scroll/filter first
- **Status inconsistencies** -- a notebook showing "Stopped" could mean success or cancellation

Has anyone built custom monitoring for their Fabric environment? Would love to hear what approaches people are taking.

Some things I've been exploring:
- Using the Jobs API (`/v1/workspaces/{id}/items/{id}/jobs/instances`) to collect job history externally
- Storing events in an Eventhouse for longer retention + KQL analysis
- Building correlation logic based on time-window overlap between pipeline and notebook runs

What's working for you?

---

## Reddit Post: r/PowerBI

**Title:** For those migrating to Fabric, how are you handling data quality monitoring?

**Body:**

We're in the process of moving from a traditional PBI Premium setup to Fabric, and one thing I'm noticing is there isn't a great story for data quality monitoring yet.

In our old setup we had custom monitoring around dataset refreshes -- timing trends, failure rates, row counts. Moving to Fabric, the Monitoring Hub gives basic pass/fail visibility but:

- Only 30 days of history
- No alerting (beyond basic Fabric alerts)
- No way to track data quality metrics over time (freshness, completeness, schema changes)
- No SLO framework -- we can't define "this pipeline should succeed 99.5% of the time" and get alerted when it doesn't

How are others handling this? Are you:
1. Using Purview for everything?
2. Building custom notebooks to check data quality?
3. Using third-party tools (Monte Carlo, Soda, etc.)?
4. Just relying on the native Monitoring Hub?

Any advice appreciated. This seems like a gap that's going to become more painful as we scale.
