# Hacker News Show HN Launch Plan

> Target: Week 2 of growth plan
> Goal: 50+ upvotes, 20+ comments, 100+ GitHub stars from HN traffic

---

## Title Options

Keep under 80 characters. HN titles should be descriptive and technical, not marketing-speak.

**Primary (recommended):**
```
Show HN: Open-source observability for Microsoft Fabric (TypeScript, MIT)
```
(71 characters)

**Alternatives:**
```
Show HN: We built cross-item correlation for Microsoft Fabric monitoring
```
(72 characters)

```
Show HN: Fabric monitoring beyond the 30-day wall (open source)
```
(63 characters)

```
Show HN: SLO tracking and alerting for Microsoft Fabric (OSS, TypeScript)
```
(74 characters)

**Avoid:**
- "Introducing..." (sounds like a press release)
- "The first..." (sounds like marketing)
- Anything with "AI-powered" (HN is skeptical of AI claims unless substantiated)
- "Revolutionizing..." (instant credibility death on HN)

---

## Post Body

HN Show posts allow a text body. Keep it concise, technical, and honest. The HN audience values: clear problem statements, technical depth, intellectual honesty about limitations, and humility.

### Recommended Post Body

```
Microsoft Fabric is Microsoft's unified analytics platform (data lake,
data warehouse, pipelines, notebooks, semantic models, reports -- all in one).
It's growing fast, but its observability story has real gaps that bite teams
running it in production.

The core problems:

- Monitoring Hub retains only 30 days of job history (100 activities
  visible at a time)
- No cross-item correlation: when a pipeline triggers a notebook that
  refreshes a semantic model that breaks a report, there's no way to trace
  that chain natively
- No SLO framework: you can't define "this pipeline should succeed 99.5%
  of the time" and get alerted when it doesn't
- Monitoring is fragmented across 4+ tools (Monitoring Hub, Capacity
  Metrics App, Spark UI, Purview) with no unified view

We built Observability Workbench to solve these problems. It's a TypeScript
CLI that collects job data via Fabric REST APIs, stores it in Fabric's own
Eventhouse (KQL database) for long retention, correlates events across item
types using time-window analysis, and tracks SLOs with configurable alert
rules.

What it does today:
- Collects pipeline, notebook, dataflow, and copy job execution data
- Stores in Eventhouse for 90-365 day retention (vs. 30 native)
- Correlates parent pipeline runs with child notebook/dataflow executions
- Defines and tracks SLOs (success rate, freshness, duration targets)
- Fires alerts on SLO breaches and trend-toward-breach predictions
- Includes 30+ KQL queries for common analysis patterns
- CLI dashboard for quick health checks

Tech stack: TypeScript, Fabric REST APIs, KQL/Eventhouse for storage,
Entra ID (OAuth) for auth. 269 tests passing. Currently collecting real
data from a live Fabric environment (135 events, 88 SLO snapshots,
52 alerts, 8 correlations).

GitHub: https://github.com/tenfingerseddy/FabricWorkloads
License: MIT

Limitations and honest caveats:
- This is early-stage (v0.1.0). The core pipeline works but the UX
  needs polish.
- Currently requires a Fabric service principal with API access. We're
  working on delegated user auth for easier setup.
- KQL ingestion requires an Eventhouse, which is a Fabric item that
  consumes capacity units.
- We haven't tested at scale beyond ~10 workspaces yet. Looking for
  teams with larger environments to help stress-test.

If you run Fabric in production, I'd love to hear about your monitoring
setup. What works? What's painful? What are we missing?
```

---

## Preparation Checklist

Complete all items before posting.

### GitHub Repository

- [ ] README is polished: clear problem statement, quickstart, architecture diagram, badges, screenshots
- [ ] CONTRIBUTING.md exists with setup instructions
- [ ] LICENSE file (MIT) is present
- [ ] CI is green (GitHub Actions badge shows passing)
- [ ] At least 5 "good first issue" items are open
- [ ] Repository topics are set: microsoft-fabric, data-observability, typescript, open-source
- [ ] GitHub Discussions are enabled
- [ ] No stale or embarrassing open issues
- [ ] Latest commit is recent (within 24 hours of posting)
- [ ] Star count is visible (do not hide it, even if it is low)

### Demo Readiness

- [ ] Live demo environment is working (ObservabilityWorkbench-Dev workspace)
- [ ] npx install and first run works end-to-end (tested on a clean machine)
- [ ] Terminal GIF or screenshot is in the README showing real output
- [ ] Can do a live demo if someone asks in comments (have the environment warm)

### Content Pipeline

- [ ] Blog post 1 ("State of Fabric Observability") is published on dev.to (provides depth for curious HN readers)
- [ ] Blog post 2 ("Cross-Item Correlation") is published (demonstrates technical depth)
- [ ] Both blog posts are linked from the README

### FAQ Preparation

Prepare written answers for these predictable questions. Have them ready to paste and personalize.

**Q: Why not just use Purview / Monitoring Hub?**
```
Purview is great for data governance and is improving its data quality
features. But it's not an observability tool -- it doesn't do cross-item
correlation, SLO tracking, or proactive alerting. The Monitoring Hub is
useful for real-time spot-checking but only retains 30 days of data and
shows 100 activities at a time with no full-text search. We build on top
of the Fabric APIs that power these tools, adding the long-retention,
correlation, and SLO layers that are missing.
```

**Q: How does this compare to Monte Carlo / Atlan / Soda?**
```
Monte Carlo and Atlan are excellent tools for multi-cloud data
observability, but they're external integrations that bolt onto Fabric
from outside. They don't understand Fabric-specific concepts like
capacity units, workspace roles, or the pipeline->notebook->semantic
model execution chain. They also start at $80K+/year (Monte Carlo) or
$198K+/year (Atlan). We're Fabric-native, open source, and free for
small teams. Different tool for a different problem shape.
```

**Q: Why TypeScript and not Python?**
```
A few reasons: (1) The Fabric Extensibility Toolkit (Microsoft's new
framework for building custom Fabric workloads) is TypeScript-first, so
building in TS aligns with the path to becoming a native Fabric workload.
(2) The CLI and future web dashboard share a codebase. (3) TypeScript's
type system catches API contract mismatches early, which matters when
you're talking to 10+ different Fabric REST API endpoints. We do have
PySpark notebooks (NB_ObsIngestion, NB_ObsCorrelation) for Fabric-native
execution if you prefer running inside Fabric itself.
```

**Q: Does this send my data to your servers?**
```
No. All data stays in your Fabric tenant. The tool writes to your
Eventhouse and your Lakehouse in your workspace. We have zero access
to your data. The tool authenticates as your service principal, not ours.
The only external call is to the Fabric REST API (api.fabric.microsoft.com),
which is Microsoft's own API running in your tenant's context.
```

**Q: What's the business model?**
```
Classic open-core. The CLI tool and core features are MIT-licensed and
free forever. We plan to offer paid tiers for teams that need more
workspaces, longer retention, advanced alerting, and enterprise features
(SSO, audit trails, SLA). Free tier: 1 workspace, 7-day retention,
5 SLOs. Professional: $499/mo per capacity. Haven't launched paid tiers
yet -- focused on getting the open-source core right first.
```

**Q: Isn't Microsoft going to build this themselves?**
```
They might, eventually. Microsoft's monitoring tools are improving
monthly. But they're built by different teams (Monitoring Hub team,
Purview team, Capacity Metrics team, Spark team) and there's no sign
of a unified observability experience. Even if Microsoft builds something,
it will likely be governance-focused (admin/IT persona) rather than
engineer-focused (our target). We're betting that a purpose-built,
engineer-first tool will always have a place, similar to how Datadog
coexists with AWS CloudWatch.
```

**Q: How do you handle authentication / security?**
```
Entra ID service principal with client credentials flow. You register
an app in your Entra tenant, grant it Fabric API permissions, and
provide the credentials to the tool via environment variables. No
passwords stored, no tokens persisted. For the future Fabric workload
version, we'll use delegated access with on-behalf-of flows, which
means the tool inherits your existing Fabric workspace permissions
automatically.
```

---

## Posting Strategy

### Timing

**Best time to post on HN:**
- Tuesday, Wednesday, or Thursday
- 10:00-11:00 AM US Eastern (7:00-8:00 AM Pacific)
- This catches US morning readers while EU is still active in the afternoon

**Avoid:**
- Monday (people are catching up on email)
- Friday (lower traffic, posts die over the weekend)
- Weekends (lowest traffic)
- Holiday weeks

### First 2 Hours: Engagement Plan

The first 2 hours after posting determine whether a Show HN gets traction. Plan for sustained, high-quality engagement.

**Minute 0-15:**
- Post goes live. Verify the link works and the title rendered correctly.
- Open the post in an incognito window to confirm it appears on Show HN.
- Do NOT share the link anywhere else yet. Do NOT ask anyone to upvote. HN actively penalizes coordinated voting and will kill the post.

**Minute 15-60:**
- Monitor for comments. Respond to every comment within 10 minutes.
- Responses should be substantive (3+ sentences), technical, and honest.
- If someone finds a bug or asks a hard question, acknowledge it directly. "Great catch, I hadn't considered that. Filed as issue #X."
- If the post is not gaining traction, do not panic. Some Show HN posts take 30-60 minutes to start climbing.

**Minute 60-120:**
- Continue responding to all comments.
- If technical questions arise that require code examples, provide them inline.
- If someone asks about a feature that does not exist yet, be transparent: "We don't do that yet. It's on the roadmap for [timeframe]. Here's the issue: [link]."
- Start noting common themes in feedback for the post-launch retrospective.

**Hour 2-6:**
- Continue monitoring but with 30-minute check intervals.
- New comments at this stage tend to be more in-depth. Match the depth.
- If the post hits the front page, expect a traffic spike to GitHub. Ensure the README and getting-started flow work.

**Hour 6-24:**
- Respond to any remaining comments.
- Post a "thank you" comment summarizing what you learned if the thread was productive.
- Do NOT edit the original post body (HN frowns on stealth edits).

### Engagement Principles

1. **Never be defensive.** If someone criticizes the approach, engage with curiosity: "Interesting point. What would you expect instead?"

2. **Acknowledge competitors respectfully.** If someone mentions Monte Carlo or Soda, say what they do well, then explain the different trade-off you made.

3. **Be specific.** Instead of "we handle that," say "we handle that by querying the Pipeline Activity Runs API and correlating via rootActivityId. Here's the relevant code: [link to file]."

4. **Show vulnerability.** "This is v0.1.0 and there are definitely rough edges. The correlation engine has only been tested against 10 workspaces so far. I'd love help stress-testing it." This kind of honesty builds trust on HN.

5. **Answer the question that was actually asked.** HN readers can tell when you are deflecting to a talking point. If someone asks "does this work with Dataflows Gen2?" and the answer is "not yet," say that.

6. **Link to code, not marketing pages.** When substantiating a claim, link to the specific file or function on GitHub, not the landing page.

---

## Post-Launch Actions

### Immediate (Day 1-2)

- [ ] Screenshot the HN thread for records (upvote count, comment count, ranking)
- [ ] Respond to every remaining comment
- [ ] Fix any bugs that HN readers surface (ideally same-day, with a commit message like "fix: [issue] -- thanks to HN feedback")
- [ ] Update README if any common confusion points emerged from the thread
- [ ] Track GitHub star count hourly for the first 24 hours

### Day 2-3

- [ ] Write a brief internal retrospective: what worked, what surprised us, what to do differently
- [ ] If the post performed well (50+ upvotes), share it on LinkedIn with a genuine "here's what I learned launching on HN" narrative
- [ ] If specific feature requests came up multiple times, create GitHub issues and label them "HN-requested"
- [ ] Update the newsletter with HN launch results

### Week 1 After Launch

- [ ] Publish a follow-up comment on the HN thread with any improvements made based on feedback
- [ ] Track how many HN visitors converted to GitHub stars, npm installs, and free tier activations (use UTM parameters)
- [ ] Determine if a future HN submission is worthwhile (e.g., when v0.2.0 ships with major improvements)

---

## Success Metrics

| Metric | Minimum | Good | Great |
|--------|---------|------|-------|
| HN upvotes | 20 | 50 | 100+ |
| HN comments | 10 | 25 | 50+ |
| GitHub stars from HN traffic | 30 | 75 | 200+ |
| npm installs from HN traffic | 10 | 30 | 80+ |
| Time on front page | 0 min | 2 hours | 6+ hours |
| Bug reports from HN users | 1 | 3 | 5+ |
| Design partner inquiries from HN | 0 | 1 | 3+ |

### What "Failure" Looks Like (and Why It Is Fine)

If the post gets fewer than 10 upvotes and dies quickly, that is not a catastrophe. Possible reasons:
- HN audience is less Fabric-specific; the topic may be too niche for broad HN appeal
- Timing was wrong (competing with a major tech news story)
- Title did not resonate

In this case:
- Extract any feedback from the comments (even 3 comments can be valuable)
- Do not repost the same thing. Wait until there is a significant milestone (v0.5.0, 1K stars, first enterprise customer) and submit a new link
- Redirect energy to Reddit and dev.to, which have more concentrated Fabric audiences

---

## Appendix: Anatomy of Successful Show HN Posts in Data Infrastructure

Studied for tone and structure:

**Grai (YC S22) -- Open-Source Data Observability Platform (101 points, 44 comments)**
- Led with relatable pain point ("why does revenue look different in different dashboards")
- Positioned as preventative, not reactive
- Generated discussion about licensing (Elastic License v2 debate)
- Takeaway: MIT license is a significant advantage -- HN strongly prefers true open source

**Common patterns in successful data tool Show HN posts:**
- Problem statement in first paragraph (before mentioning the tool)
- Concrete technical details (specific API endpoints, data models, query languages)
- Honest limitations section (builds credibility)
- "What would you want this to do?" question at the end (invites engagement)
- Quick response time from the poster (within 5-10 minutes for first hour)

**Common reasons data tool Show HN posts fail:**
- Too much marketing language, not enough technical substance
- Vague problem statement ("data teams struggle with observability")
- No working demo or code to inspect
- Poster is defensive when challenged
- "Open source" but with restrictive license (BSL, SSPL, Elastic License)
- No limitations section -- readers assume you are hiding something
