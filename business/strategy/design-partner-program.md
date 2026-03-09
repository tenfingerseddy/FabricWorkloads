# Design Partner Program: Observability Workbench

> Version 1.0 | March 2026
> Target: 10 design partners in 8 weeks (Weeks 5-12 of growth plan)

---

## Program Overview

The Design Partner Program is a structured engagement with 10 organizations that will shape the Observability Workbench during its formative months. Design partners are not beta testers -- they are co-creators who influence product direction in exchange for early access, direct support, and free usage during the program period.

The program runs for 12 weeks per cohort. Partners commit time and feedback; we commit to building what they actually need.

---

## Ideal Partner Profile

### Must-Have Criteria

| Criteria | Minimum Threshold | Why It Matters |
|----------|-------------------|----------------|
| Fabric workspaces | 3+ active workspaces | Multi-workspace monitoring is a core differentiator; single-workspace users can use the free tier |
| Daily pipeline execution | 5+ pipelines running daily | Need recurring job volume to test correlation, SLO tracking, and alerting |
| Fabric capacity | F64 or higher | Lower SKUs limit API access and concurrent operations; F64 is the realistic production floor |
| Team size | 2+ data engineers / BI developers | Need at least one person who can install and configure, plus one who validates the outputs |
| Pain point alignment | Actively experiencing monitoring gaps | Partners must have felt the pain -- not hypothetically, but concretely. They should be able to describe a specific incident where Fabric monitoring failed them. |

### Nice-to-Have Criteria

| Criteria | Benefit |
|----------|---------|
| F128+ capacity | Stress-tests performance at scale |
| Mix of item types (Pipelines + Notebooks + Dataflows + Semantic Models) | Validates cross-item correlation across the full Fabric stack |
| Existing dbt-fabric usage | Tests dbt integration path |
| Multi-tenant / ISV setup | Reveals enterprise deployment patterns early |
| Active in Fabric community (forum, Reddit, LinkedIn) | Amplification potential -- they will talk about the tool publicly |
| Located in US, EU, or ANZ time zones | Enables office hours coverage |

### Disqualifying Criteria

- Organizations with fewer than 3 workspaces (use the free tier instead)
- Teams that cannot commit to bi-weekly feedback sessions
- Organizations with strict procurement processes that would delay onboarding by more than 2 weeks
- Teams using Fabric only for Power BI Premium migration (no pipeline/notebook workloads)

---

## What Partners Get

### During the Program (12 weeks)

1. **Free Professional tier access** -- Full Observability Workbench Professional features ($499/mo value) at zero cost for the duration of the program. This includes:
   - 5 workspaces monitored
   - 90-day data retention
   - Unlimited SLOs
   - Full alerting engine
   - Cross-item correlation
   - KQL query pack

2. **Direct support channel** -- Private Discord channel or Teams group with the engineering team. Response time target: 4 hours during business hours.

3. **Weekly 30-minute check-in** -- Dedicated time with the product lead to review issues, discuss features, and provide feedback. Async (Loom video) option available for schedule conflicts.

4. **Influence on roadmap** -- Design partner feedback is weighted heavily in feature prioritization. Partners vote on the next 3 features to build each sprint.

5. **Early access to new features** -- Design partners get features 2 weeks before general release.

6. **Named recognition** -- With permission, design partners are listed on the website and in the README as "founding partners." This carries social proof value in the Fabric community.

7. **Co-created content** -- We will work with willing partners to produce case studies, blog posts, or videos about their observability journey. Partners review all content before publication.

### After the Program

8. **50% discount for 3 months** -- When transitioning to paid Professional tier, design partners get 50% off for the first 3 months ($249.50/mo instead of $499/mo).

9. **Permanent "Founding Partner" badge** -- Recognition on the website and in the product.

10. **Priority feature requests** -- Design partner feature requests continue to receive elevated priority for 6 months after program ends.

---

## What We Get

### Required from Partners

1. **Bi-weekly feedback session** (30 min) -- Structured conversation about what is working, what is broken, and what is missing. Can be async via Loom if scheduling is difficult.

2. **Installation and real usage** -- Partners must install and configure the tool against a real (non-production is acceptable) Fabric environment within the first week. Using a sandbox or fake data does not qualify.

3. **Bug reports and feature requests** -- Partners file GitHub issues for bugs and feature requests. Target: at least 5 issues filed during the program.

4. **End-of-program survey** -- A 15-minute written survey covering satisfaction, NPS, feature gaps, and willingness to convert to paid.

5. **Permission for anonymized metrics** -- We may share anonymized aggregate metrics (e.g., "design partners found an average of X undetected failures per week") in marketing. No organization-specific data is shared without explicit written permission.

### Requested (Not Required) from Partners

6. **Testimonial quote** -- A 2-3 sentence quote we can use on the website and in marketing materials. Partner reviews and approves exact wording.

7. **Case study participation** -- A co-authored blog post or video about their experience. We do the writing; partners review and approve.

8. **Public recommendation** -- A LinkedIn post, Fabric Community forum endorsement, or conference mention. We never ask for dishonest endorsement -- only share if you genuinely find value.

9. **Referral** -- Introduction to one other team or organization that would benefit from the program.

---

## Program Timeline

### Pre-Program (Weeks 5-6 of Growth Plan)

| Day | Activity |
|-----|----------|
| Day 1-7 | Outreach begins (see templates below) |
| Day 7-14 | Qualification calls with interested parties (20 min each) |
| Day 14-18 | Partner selection and confirmation |
| Day 18-21 | Onboarding kickoff (credentials, installation, first data collection) |

### Program Execution (12 Weeks)

| Week | Focus |
|------|-------|
| 1 | Onboarding: install, configure, first data collection. Validate that core pipeline works. |
| 2 | First feedback session. Identify top 3 pain points per partner. |
| 3-4 | SLO configuration. Partners define their first 3 SLOs. Identify gaps in SLO templates. |
| 5-6 | Correlation testing. Partners validate cross-item correlation accuracy against known pipeline chains. |
| 7-8 | Alerting configuration. Partners set up alert rules and validate notification delivery. |
| 9-10 | Dashboard and reporting. Partners use dashboard for daily operations. Identify UX issues. |
| 11 | End-of-program survey. Testimonial collection. |
| 12 | Case study interviews. Transition planning (paid tier or continued free usage). |

### Post-Program

- Partners transition to paid Professional tier (50% discount for 3 months) or downgrade to free tier
- Founding Partner recognition added to website
- Case studies published (with partner approval)
- Quarterly check-in maintained for 6 months

---

## Outreach Strategy

### Target Lists

**Channel 1: Engaged Community Members**
- People who commented on our blog posts, Reddit threads, or LinkedIn content
- People who starred the GitHub repo
- People who ran npx fabric-health-check
- These are warm leads -- they already know the problem space

**Channel 2: Fabric Community Forum Active Members**
- Search for forum threads about: monitoring hub limitations, pipeline debugging, alerting needs, workspace monitoring
- Identify people who posted detailed questions about monitoring gaps
- These people have publicly articulated the pain point

**Channel 3: LinkedIn Connections**
- Data engineers and platform team leads who post about Fabric
- People who engaged with our LinkedIn content (likes, comments, reposts)
- Fabric MVPs and community leaders

**Channel 4: Fabric Consulting Partners**
- Consulting firms that specialize in Fabric deployments
- They have clients who need this tool
- A consulting firm design partner is worth 5x a single organization because they bring multiple client use cases

### Outreach Volume Targets

To sign 10 partners, plan for:
- 80 outreach messages sent (across all channels)
- 30 responses (37% response rate -- achievable because most are warm leads)
- 20 qualification calls scheduled
- 15 qualified candidates
- 10 confirmed partners (67% close rate from qualified)

---

## Outreach Templates

### Template 1: Cold Email (for people who engaged with content)

```
Subject: Your thoughts on Fabric monitoring -- quick question

Hi [Name],

I noticed your [comment on our Fabric observability post / Reddit thread about
monitoring hub limitations / LinkedIn post about pipeline debugging]. You clearly
know this space well.

We're building an open-source observability tool specifically for Fabric --
long-retention metrics, cross-item correlation, SLO tracking, and alerts.
It's on GitHub: https://github.com/tenfingerseddy/FabricWorkloads

We're starting a Design Partner Program for 10 teams who want to shape the
product while getting free Professional-tier access. The commitment is light:
install the tool, use it on a real Fabric environment, and give us honest
feedback every two weeks.

Based on [specific thing they said/posted], I think your team would get real
value from this. Would you be open to a 20-minute call to see if it's a fit?

No pressure either way -- I genuinely appreciate the insights you've already
shared in the community.

Best,
[Name]
```

### Template 2: LinkedIn DM (for connections / engaged followers)

```
Hi [Name] -- I've been following your posts about [Fabric topic] and wanted
to reach out directly.

We're running a Design Partner Program for our open-source Fabric observability
tool (MIT, on GitHub). Looking for 10 teams who use Fabric in production and
want better monitoring than what the native tools provide.

Partners get free Professional access, direct support, and real influence on
the roadmap. The ask is honest feedback every 2 weeks.

Here's the repo if you want to look first:
https://github.com/tenfingerseddy/FabricWorkloads

Would a quick call make sense, or would you prefer I send more details async?
```

### Template 3: Reddit DM (for people who posted about monitoring pain)

```
Hi [username] -- saw your post in r/MicrosoftFabric about
[specific monitoring issue they described]. I've been dealing with the exact
same frustrations.

I ended up building an open-source tool to solve some of these problems --
long-retention event collection, cross-item correlation, and SLO tracking
for Fabric: https://github.com/tenfingerseddy/FabricWorkloads

We're looking for a few teams to be design partners -- free access, direct
support, and you help shape what gets built next. Would love to hear if this
addresses the issues you described.

No sales pitch -- it's open source (MIT) and the free tier is genuinely
useful on its own.
```

### Template 4: Fabric Community Forum (public post, not DM)

```
Title: Looking for feedback on an open-source Fabric observability project

Hi everyone,

I've been building an open-source observability tool for Fabric that addresses
some of the monitoring gaps discussed frequently in this forum:

- Long-retention event storage (beyond the 30-day Monitoring Hub limit)
- Cross-item correlation (pipeline --> notebook --> semantic model refresh chains)
- SLO definitions and tracking (success rate, freshness, duration targets)
- Proactive alerting when SLOs are trending toward breach

The project is MIT-licensed and on GitHub:
https://github.com/tenfingerseddy/FabricWorkloads

I'm starting a Design Partner Program for teams who use Fabric in production
and would like to shape this tool with real-world feedback. Partners get free
Professional-tier access and direct support.

If this sounds interesting, I'd love to hear from you -- either reply here or
DM me. And if you have feedback on the approach itself, that's equally valuable.

Thanks for being such a helpful community.
```

### Template 5: Consulting Partner Outreach

```
Subject: Partnership opportunity -- open-source Fabric observability

Hi [Name],

I see [Firm] does significant work with Microsoft Fabric implementations.
I'm building the first Fabric-native observability tool -- open source,
MIT licensed, purpose-built for data engineering teams running Fabric
in production.

The tool solves problems your clients likely face: monitoring hub retention
limits, no cross-item correlation, no SLO framework, and fragmented
monitoring across 4+ Microsoft tools.

I'm looking for a few consulting firms to join our Design Partner Program:

What you'd get:
- Free Professional-tier access for your team and one client deployment
- Early access to new features
- Co-marketing (case study, joint blog post)
- Referral commission on client conversions (20% of first year)

What I'd ask:
- Install and test against a real Fabric environment
- Bi-weekly feedback (30 min)
- Honest assessment of where it falls short

GitHub: https://github.com/tenfingerseddy/FabricWorkloads

Would a 20-minute call be worthwhile?

Best,
[Name]
```

---

## Application Form Questions

For interested parties, use a simple Typeform or Google Form:

1. **Your name and role**
2. **Organization name** (can be anonymized in public materials if preferred)
3. **How many Fabric workspaces does your team manage?** (1 / 2-5 / 6-10 / 11+)
4. **What Fabric capacity SKU are you using?** (F2-F32 / F64 / F128 / F256+ / Not sure)
5. **What Fabric item types do you use regularly?** (checkboxes: Pipelines, Notebooks, Dataflows Gen2, Semantic Models, Lakehouses, Eventhouses, Copy Jobs, Other)
6. **How many pipelines run daily in your environment?** (1-5 / 6-20 / 21-50 / 50+)
7. **What is your biggest monitoring/observability pain point today?** (open text, 2-3 sentences)
8. **How do you currently monitor your Fabric environment?** (checkboxes: Monitoring Hub only / Capacity Metrics App / Purview / Third-party tool / Custom notebooks / We don't really monitor)
9. **Can you commit to bi-weekly 30-minute feedback sessions for 12 weeks?** (Yes / Probably / Not sure)
10. **How did you hear about Observability Workbench?** (open text)
11. **Anything else you'd like us to know?** (open text, optional)

### Scoring Rubric

| Criteria | Points |
|----------|--------|
| 5+ workspaces | 3 |
| F64+ capacity | 3 |
| 20+ daily pipelines | 2 |
| Uses 3+ item types | 2 |
| Clear pain point articulation | 3 |
| No current monitoring solution | 2 |
| Can commit to bi-weekly feedback | 3 |
| Active in Fabric community | 2 |
| **Total possible** | **20** |

Accept partners scoring 12+ out of 20. Waitlist partners scoring 8-11. Redirect partners scoring below 8 to the free tier with an offer to rejoin a future cohort.

---

## Partner Communication Cadence

| Touchpoint | Frequency | Channel | Owner |
|------------|-----------|---------|-------|
| Onboarding kickoff | Once (Week 1) | Video call (30 min) | Product lead |
| Feedback session | Bi-weekly | Video call or Loom (30 min) | Product lead |
| Async questions | Ad-hoc | Private Discord channel or Teams | Engineering team |
| Feature preview | Every 2 weeks | Email + private Discord | Product lead |
| Newsletter | Bi-weekly | Email | Marketing |
| Milestone celebration | At star/feature milestones | Discord + email | Product lead |
| End-of-program survey | Once (Week 11) | Google Form | Product lead |
| Case study interview | Once (Week 12) | Video call (45 min) | Content lead |
| Post-program check-in | Quarterly | Email | Product lead |

---

## Partner Success Metrics

Track these for each design partner individually:

| Metric | Target | When Measured |
|--------|--------|---------------|
| Time to onboard (install + first data) | < 48 hours | Week 1 |
| SLOs configured | 3+ | Week 4 |
| Feedback sessions attended | 5+ out of 6 | Ongoing |
| GitHub issues filed | 5+ | End of program |
| Would recommend (NPS) | 8+ out of 10 | Week 11 survey |
| Willing to provide testimonial | 70%+ of partners | Week 11 |
| Convert to paid after program | 50%+ of partners | Week 12+ |
| Still active 3 months after program | 70%+ of partners | Month 6 |

---

## Program Economics

### Cost to Run the Program

| Item | Cost | Notes |
|------|------|-------|
| Professional tier for 10 partners (12 weeks) | $0 (marginal cost) | No infrastructure cost per partner; they use their own Fabric capacity |
| Product lead time (12 weeks, ~10 hrs/week) | ~120 hours | Feedback sessions + partner management |
| Engineering support time | ~40 hours total | Bug fixes and partner-requested improvements |
| Content creation (case studies) | ~20 hours | Writing, reviewing, publishing |
| **Total investment** | **~180 hours** | |

### Expected Return

| Outcome | Value |
|---------|-------|
| 5 partners convert to Professional at $499/mo | $2,495/mo MRR |
| 5 testimonials for marketing | High (social proof is the #1 conversion driver for developer tools) |
| 3 case studies published | Medium-high (content assets with 12+ month shelf life) |
| 50+ GitHub issues (real-world bug reports and feature requests) | High (6 months of product insight compressed into 12 weeks) |
| 3+ public recommendations (LinkedIn, forum, conference) | High (organic amplification) |
| 1 consulting partner relationship | High (channel for future enterprise deals) |

### Break-Even Analysis

If 5 out of 10 partners convert to Professional ($499/mo) after the 50% discount period, the program generates $2,495/mo in MRR starting month 6. The 180 hours of investment pays back within the first month of full-price revenue.

More importantly, the qualitative returns (product-market fit validation, testimonials, community credibility) are worth far more than the time invested.

---

## Frequently Asked Questions (Partner-Facing)

**Q: Do I need to use this in production?**
A: No. A non-production Fabric environment with real (or realistic) workloads is perfectly fine. We need real pipeline runs and job histories -- not necessarily production data.

**Q: What if the tool breaks something in my Fabric environment?**
A: The tool is read-only by design. It queries Fabric REST APIs and writes to its own Eventhouse and Lakehouse. It does not modify your pipelines, notebooks, or data. We can walk through the architecture on the onboarding call.

**Q: What happens to my data after the program?**
A: All observability data is stored in your own Fabric tenant (your Eventhouse, your Lakehouse). We have no access to your data. If you stop using the tool, the data remains in your tenant under your control.

**Q: Can I use this for a client engagement (consulting firm)?**
A: Yes. We welcome consulting partners. You can deploy against one client environment as part of the program. If you want to deploy for multiple clients, we should discuss a partner agreement.

**Q: What if I can't make the bi-weekly calls?**
A: Async feedback via Loom video or written responses is completely acceptable. The important thing is consistent, honest feedback -- the format is flexible.

**Q: Will my organization's name be used publicly?**
A: Only with your explicit written permission. You can participate fully with anonymized attribution (e.g., "a Fortune 500 financial services company" or "a mid-market retail data team").

**Q: What if the tool doesn't meet our needs?**
A: That is a valid and valuable outcome. If the tool falls short, we want to understand exactly where and why. There is no penalty for honest negative feedback -- it is the most useful kind.
