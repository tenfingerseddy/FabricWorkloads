# Week 2 Social Media Posts

> Theme: The Cost Angle -- CU waste from data quality failures
> Timing: Week of March 9-15, 2026 (Week before FabCon)
> Assets: Blog 3 (Hidden Cost of Bad Data in Fabric)

---

## LinkedIn Post #1: The CU Waste Math

We calculated the CU cost of a single recurring pipeline failure in Microsoft Fabric.

Here is the math for a daily pipeline on F64 capacity:

- **Healthy**: 1 run/day, 45 min avg = ~$62/month
- **15% failure rate + retry**: ~$81/month
- **15% failure + downstream cascade**: ~$120/month

That is a single pipeline. Nearly 2x its expected cost.

Now multiply across 20 pipelines in a workspace.

But the real cost is not the dollars. Every wasted CU-second reduces headroom for legitimate workloads. When headroom hits zero, Fabric throttles background jobs. Throttling creates more failures. More failures create more retries. The negative feedback loop has begun.

The teams that run Fabric well are not the ones with the biggest SKUs. They are the ones that:
- Track failure rates per pipeline (not just "did it run")
- Trend P95 execution duration weekly
- Catch timeout risk before the first timeout
- Eliminate duplicate scheduled runs

We wrote up the full analysis, including a 5-step framework for calculating your workspace's "CU Waste Score":

[Link to blog post]

What is your workspace's failure rate? I am genuinely curious whether most teams even measure this.

#MicrosoftFabric #DataEngineering #FinOps #Observability

---

## LinkedIn Post #2: The Blog Share + Personal Take

I used to think Fabric cost optimization was about picking the right SKU.

After analyzing real workspace data, I learned the biggest cost driver is not the SKU size. It is the invisible waste:

1. **Retry waste** -- Failed pipelines that retry automatically, each attempt burning CUs
2. **Stale data reprocessing** -- Upstream fails at 2 AM, nobody knows until 10 AM, engineer re-runs everything. You paid double.
3. **Timeout cascades** -- A semantic model refresh creeps from 45 min to 1h50m over weeks. Nobody notices until it hits the 2-hour timeout. Full restart. All CUs wasted.
4. **Duplicate schedules** -- A notebook runs via its own schedule AND via a pipeline trigger. Double execution, identical output.

We defined a metric for this:

**Waste Score = (Failed + Duplicate CU-seconds) / Total CU-seconds x 100**

Below 5% = healthy.
Above 20% = you are likely experiencing throttling.

I wrote the full breakdown with calculations and five steps you can take today to measure and reduce this. Link in comments.

#MicrosoftFabric #DataEngineering #CostOptimization

---

## LinkedIn Post #3: FabCon Week Preview (Post March 14-15)

FabCon 2026 starts Monday in Atlanta.

200+ sessions. Announcements across every Fabric workload. The biggest gathering of the Fabric community this year.

One topic I hope gets serious attention: **operational observability.**

Fabric's monitoring tools have improved steadily. The February 2026 update added hierarchical pipeline views in the Monitor Hub and item-level lineage in OneLake details pages. Real progress.

But teams operating Fabric at scale still face fundamental gaps:
- 30-day retention in the Monitoring Hub
- No cross-item correlation across pipeline > notebook > refresh chains
- No SLO framework ("this pipeline must succeed 99% over 7 days")
- No unified cost-to-failure correlation

I would love to see Microsoft address the retention and correlation gaps this week. Even extending Monitoring Hub retention to 90 days would be a game changer for trend analysis.

If you are at FabCon, I would be interested to hear what observability-related sessions you attend. Drop a note in the comments.

We are tracking every Fabric monitoring improvement and building an open-source observability tool that fills the gaps:
https://github.com/tenfingerseddy/FabricWorkloads

#FabCon2026 #MicrosoftFabric #Observability #DataEngineering

---

## Reddit Post: r/MicrosoftFabric

**Title:** PSA: How to estimate the CU cost of pipeline failures and retries

**Body:**

Hey everyone,

Been digging into CU consumption patterns across a few Fabric workspaces and found something that surprised me: the CU cost of data quality failures is much higher than I expected.

Here is a rough framework for estimating it:

**1. Calculate per-item failure rates**

Pull job instances via the REST API:
```
GET /v1/workspaces/{id}/items/{id}/jobs/instances
```

Count failed vs total instances over the last 30 days. Any item above 5% failure rate is worth investigating.

**2. Identify retry patterns**

Look for job instances that start within a few minutes of a failed instance for the same item. Each retry burns CUs regardless of outcome.

**3. Find duplicate schedules**

This one is sneaky. Check if any items run via both their own schedule AND a pipeline trigger. I found a notebook that was executing twice every morning -- once from its workspace schedule, once triggered by a pipeline activity. Same output, double the CU cost.

**4. Track duration regression**

Compare P95 execution time this week vs. last month. A notebook that used to take 12 minutes now taking 35 minutes is not just slower -- it is approaching timeout risk and consuming 3x the CUs.

**5. Your "Waste Score"**

```
Waste Score = (Failed CU-seconds + Duplicate CU-seconds) / Total CU-seconds * 100
```

Under 5% is good. Over 10% is real money. Over 20% and you are probably hitting throttling.

Has anyone else done this kind of analysis on their workspace? Curious what waste patterns others are seeing.

I wrote a longer piece with the full math and optimization steps: [link to blog]

We are also building an open-source tool that automates this analysis: https://github.com/tenfingerseddy/FabricWorkloads

---

## Reddit Post: r/PowerBI

**Title:** How much CU budget are failed Fabric refreshes actually costing you?

**Body:**

Quick PSA for anyone running Fabric capacities.

I went through the exercise of calculating how much CU consumption is wasted by refresh failures, retries, and duplicate schedules in our workspace. The answer was... more than expected.

Some things I found:

- **A pipeline with a 15% failure rate costs nearly 2x its expected CUs** when you account for retries and downstream cascades
- **Semantic model refreshes that creep toward the 2-hour timeout** waste massive CUs when they fail and restart from scratch. If any of your refreshes are above 45 minutes, look into incremental refresh -- the savings can be 80-95%
- **Duplicate schedules are invisible waste.** We had items running from both their own schedule and a pipeline trigger. The Monitoring Hub shows both as separate successful runs. Easy to miss.

The most useful thing I did was define a simple "Waste Score":

```
Waste Score = (Failed + Duplicate CU-seconds) / Total CU-seconds * 100
```

We got ours from ~18% down to ~4% by fixing three things: incremental refresh on our biggest models, removing duplicate schedules, and adding Power Automate alerts on failures so we catch cascades early.

Full writeup with the math: [link to blog]

Anyone else tracking this kind of metric?
