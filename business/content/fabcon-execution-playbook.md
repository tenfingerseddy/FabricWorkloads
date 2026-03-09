# FabCon 2026 Execution Playbook

> Final operational plan for maximizing visibility during FabCon 2026
> Conference: March 16-20, Georgia World Congress Center, Atlanta
> Our posture: Remote (not attending in person)
> Today: March 9, 2026 -- 7 days to Day 1
> This document is the single source of truth for all FabCon activity

---

## Table of Contents

1. [Pre-FabCon: March 10-15](#1-pre-fabcon-march-10-15)
2. [During FabCon: March 16-20](#2-during-fabcon-march-16-20)
3. [Post-FabCon: March 21-23](#3-post-fabcon-march-21-23)
4. [Success Metrics](#4-success-metrics)
5. [Asset Inventory](#5-asset-inventory)
6. [Risk Scenarios and Contingencies](#6-risk-scenarios-and-contingencies)

---

## 1. Pre-FabCon: March 10-15

### 1.1 Daily Social Post Schedule

| Date | Day | Platform | Content | Status |
|------|-----|----------|---------|--------|
| Mon Mar 10 | -6 | LinkedIn | Week 2 Post #1: CU Waste Math (from `week-02-social-posts.md`) | Ready -- publish at 8:30 AM AEST |
| Tue Mar 11 | -5 | Reddit | r/MicrosoftFabric: PSA on CU waste calculation (from Week 2 content) | Ready -- publish at 10:00 AM EST |
| Wed Mar 12 | -4 | LinkedIn | Week 2 Post #2: Share Blog 3 (Hidden Cost of Bad Data) | Ready -- publish at 8:30 AM AEST |
| Thu Mar 13 | -3 | LinkedIn | Teaser: "FabCon starts Monday. 9 sessions I'm tracking for observability implications." | Write Thursday morning -- reference the 9 sessions from intel report |
| Fri Mar 14 | -2 | dev.to | Publish Blog 4: "What FabCon 2026 Reveals About the Fabric Observability Gap" | Ready in `blog-04-devto.md` |
| Sat Mar 15 | -1 | LinkedIn | FabCon Preview post (from `week-03-fabcon-social-posts.md`) | Ready -- publish at 8:30 AM AEST |
| Sun Mar 15 | -1 | Reddit | Monitor r/MicrosoftFabric for pre-event threads; comment helpfully | Ongoing |

### 1.2 Blog 4 Publish Strategy

**Title:** "What FabCon 2026 Reveals About the Fabric Observability Gap (And What's Coming Next)"
**Status:** Written and ready in `blog-04-fabcon-observability-gap.md` and `blog-04-devto.md`

**Timing:** Publish Friday March 14 (two days before FabCon opens). This positions the article to:
- Appear in weekend reading lists before the conference
- Be linkable in our FabCon week social posts
- Capture search traffic from people researching "FabCon 2026 observability" before attending

**Distribution plan:**
1. Publish on dev.to Friday morning (10:00 AM EST)
2. Share on LinkedIn Saturday (the preview post already references observability gaps)
3. Submit to r/MicrosoftFabric only if there is an organic thread about FabCon prep -- do not force it
4. Add the URL to our GitHub README as a "Related Reading" link

### 1.3 Reddit Seeding Strategy

**Goal:** Be a familiar, helpful voice in FabCon-adjacent threads before the conference starts. Do NOT post promotional content during the seeding phase.

**Daily actions (15 minutes/day, March 10-15):**

1. **Monitor these subreddits:**
   - r/MicrosoftFabric (primary)
   - r/PowerBI (secondary)
   - r/dataengineering (tertiary -- only if Fabric comes up)

2. **Engage with these thread types:**
   - "Getting ready for FabCon" / "What sessions to attend" -- share our 9-session list as a helpful comment
   - "Monitoring Hub" / "pipeline alerting" / "workspace monitoring" questions -- answer with specific technical help
   - "CU cost" / "capacity planning" threads -- share the CU waste calculation methodology
   - "Extensibility Toolkit" / "custom workload" discussions -- share genuine technical insights

3. **Comment template (adapt per thread):**
   > "We've been looking at this too. The [specific thing] is documented at [Microsoft Learn link]. One thing that's not obvious is [genuine technical insight]. If you're running into [specific pain point], [actionable suggestion]."

4. **Rules:**
   - Never link to our GitHub in seeding comments unless someone explicitly asks for tooling
   - Never mention "Observability Workbench" by name during seeding
   - Answer the actual question first; position ourselves as knowledgeable, not salesy
   - If someone asks "what are you using?" then share the repo link naturally

### 1.4 GitHub Repo Cleanup and Presentation Checklist

Complete by end of day Wednesday March 12 (giving 3 days of buffer before FabCon).

**README improvements:**
- [ ] Verify all code examples in README actually work with current `main` branch
- [ ] Add a "Quick Start" section at the top (3 commands to first output)
- [ ] Add a "Related Blog Posts" section linking to Blog 1-4
- [ ] Verify the GitHub repo description reads: "Open-source observability for Microsoft Fabric -- cross-item correlation, SLO tracking, CU waste analysis"
- [ ] Confirm topics are set: `microsoft-fabric`, `observability`, `data-engineering`, `fabric-workload`, `monitoring`

**Code quality:**
- [ ] Run `npm test` and ensure all tests pass
- [ ] Run `npm start --help` and verify the CLI output is clean
- [ ] Remove any TODO comments that reference internal details
- [ ] Verify `.env.example` has clear instructions (no real credentials)
- [ ] Confirm `package.json` version is `0.1.0` and metadata (description, keywords, repository) is correct

**CI/CD:**
- [ ] Verify GitHub Actions CI workflow passes on latest commit
- [ ] Ensure the CI badge in README is green

**Landing page:**
- [ ] Verify `landing-page/index.html` loads correctly with current messaging
- [ ] Check all links on the landing page resolve

**Community readiness:**
- [ ] GitHub Issues templates are in place (bug report, feature request)
- [ ] GitHub Discussions is enabled
- [ ] CONTRIBUTING.md exists with clear instructions
- [ ] LICENSE file is MIT

**Health check script:**
- [ ] Verify `scripts/fabric-health-check.sh` runs cleanly and outputs useful results
- [ ] This is our open-source lead gen tool -- it should work flawlessly out of the box

---

## 2. During FabCon: March 16-20

### 2.1 Daily Operating Rhythm

Repeat this cycle every day, Monday through Friday:

| Time (AEST) | Time (EST) | Activity |
|-------------|------------|----------|
| 7:00 AM | 4:00 PM (prior day) | Check #FabCon2026 on LinkedIn and X for overnight US activity |
| 8:30 AM | 5:30 PM (prior day) | Publish scheduled LinkedIn post (if applicable) |
| 9:00 AM | 6:00 PM (prior day) | Scan r/MicrosoftFabric for new FabCon threads |
| 11:00 PM | 8:00 AM | FabCon sessions begin. Monitor live tweet streams. |
| 11:00 PM-6:00 AM | 8:00 AM-3:00 PM | Active monitoring window (sessions running) |
| 6:00 AM+1 | 3:00 PM | Sessions end. Compile daily notes. Draft reactive content. |

Note: Atlanta is EST (UTC-5). AEST is UTC+11. FabCon sessions run approximately 8 AM - 5 PM EST, which is 11 PM - 8 AM AEST. Plan for late-night/early-morning monitoring during the conference.

### 2.2 Hour-by-Hour Session Monitoring Plan

#### Monday March 16 (Day 1 -- Keynotes and Opening)

| Time (EST) | Session | Priority | Why |
|-------------|---------|----------|-----|
| 8:30-10:00 AM | **Opening Keynote** (Arun Ulag, Amir Netz) | CRITICAL | Flagship announcements. Watch for monitoring/observability roadmap items, Extensibility Toolkit news, new workloads. |
| All day | Monitor #FabCon2026 social stream | HIGH | Capture community reaction to keynote announcements |

**Post-keynote action:** Within 2 hours, publish a LinkedIn comment or short post reacting to specific announcements. Use Day 1 template from `week-03-fabcon-social-posts.md`.

#### Tuesday March 17 (Day 2 -- Deep Dive Sessions Begin)

| Time (EST) | Session | Priority | Why |
|-------------|---------|----------|-----|
| All day | No critical sessions identified | MEDIUM | Monitor social feeds for session recaps |
| 10:00 AM | **Publish Reddit post** (r/MicrosoftFabric): "FabCon 2026 -- Any announcements about monitoring/observability improvements?" | EXECUTE | From `week-03-fabcon-social-posts.md` |

**Daily LinkedIn post:** Day 2 "Monitoring Gap Reality Check" from week-03 templates. Update with any actual announcements from Day 1.

#### Wednesday March 18 (Day 3 -- Historically the Biggest Announcement Day)

| Time (EST) | Session | Priority | Why |
|-------------|---------|----------|-----|
| 3:05 PM | "Unlocking Copilot in Fabric: Administration, Governance, and Beyond!" | LOW | Tangential but watch for admin tooling |
| All day | **Peak announcement monitoring** | CRITICAL | Historically Wednesday is the biggest announcement day at FabCon |

**Daily LinkedIn post:** Day 3 "Announcements Analysis" template from week-03. This is the most important reactive post of the week.

#### Thursday March 19 (Day 4 -- Our Two Critical Sessions)

| Time (EST) | Session | Priority | Why |
|-------------|---------|----------|-----|
| 8:00 AM | **"What's new in Fabric capacities and capacity monitoring"** (Arsalan Yarveisi, Pankaj Arora) | HIGH | Capacity monitoring improvements. Direct relevance to our FinOps roadmap. May announce extended retention or new metrics. |
| 10:10 AM | **"Trusted Analytics: Data Quality in Microsoft Fabric & Purview"** (Shafiq Mannan, Wolfgang Strasser) | HIGH | Purview DQ expansion. Must confirm it stays in data quality lane and does not cross into operational observability. |
| 11:30 AM | **"Monitor and troubleshoot your data solution in Microsoft Fabric"** (Joe Muziki, Li Liu) | CRITICAL | This is THE session. Direct competitor content. Whatever Microsoft presents here defines the native observability ceiling. Every gap they do not address is our positioning. |
| 2:00 PM | **"Fabric Extensibility Toolkit: Build your own Fabric item in minutes with AI"** (Gerd Saurer, Teddy Bercovitz) | CRITICAL | Our delivery mechanism. Watch for: scheduler support announcement, CI/CD support, CRUD notification API, new publishing capabilities, contest winner showcases. |
| TBD | "Bulletproof Your Dataflows: Error Handling and Data Quality in Fabric" | LOW | Dataflow-specific. Note any new error handling APIs. |

**Daily LinkedIn post:** Day 4 "Practical Takeaway" from week-03 templates. This is the actionable FabCon checklist post.

**SPECIAL ACTION:** If the FET session announces scheduler support, immediately update our internal development timeline. This unblocks our FET migration and changes our Q2 roadmap.

#### Friday March 20 (Day 5 -- Wrap-Up)

| Time (EST) | Session | Priority | Why |
|-------------|---------|----------|-----|
| 11:30 AM | "Mastering Fabric Data Engineering Admin and Capacity Management" | MEDIUM | Admin persona pain points. Note anything our tool should address. |
| 2:00 PM | "Beyond Monitoring: AI-Driven Spark Optimization in Microsoft Fabric" | MEDIUM | AI-driven optimization. Feature inspiration for our alert engine. |
| TBD | "Herding Fabric Cats: Administration and Governance Guidance" | MEDIUM | Admin pain points = our buyer persona pain points. |

**Daily LinkedIn post:** FabCon Wrap-Up from week-03 templates. This is the summary post and must include specific session references.

**Reddit post:** "Post-FabCon: What's your monitoring/alerting setup for Fabric pipelines?" from week-03 templates.

### 2.3 Announcement Scenario Response Templates

For each scenario, publish the LinkedIn response within 4 hours of the announcement. Speed matters during FabCon week.

---

#### Scenario A: Microsoft Announces Extended Monitoring Hub Retention

**Likelihood:** Low
**Impact on us:** Medium (reduces one value prop but validates the market need)

**LinkedIn response template:**

> This is genuinely great news. [Specific detail about the extension -- e.g., "90-day retention in Monitoring Hub"] is something the community has been asking for since Fabric GA.
>
> What this means in practice:
> - Teams finally get [specific benefit]
> - The 100-activity display limit [is/is not] changed (confirm this)
> - Keyword search [does/does not] now query the full retention window
>
> What's still needed beyond retention:
> - Cross-item correlation (pipeline to notebook to dataflow to semantic model refresh)
> - SLO framework (success rate, freshness, duration targets)
> - Workspace-level alerting without per-item Data Activator configuration
> - Cost attribution per pipeline/team
>
> Extended retention is the foundation. The observability layer on top of it -- correlation, SLOs, proactive alerting -- is where the real operational value lives.
>
> We're building that layer: https://github.com/tenfingerseddy/FabricWorkloads
>
> #FabCon2026 #MicrosoftFabric

**Internal action:** Update our positioning to emphasize correlation, SLOs, and alerting over raw retention. Retention becomes "complementary" not "replacement."

---

#### Scenario B: Microsoft Announces Native Cross-Item Correlation

**Likelihood:** Very low
**Impact on us:** High (challenges a core value proposition)

**LinkedIn response template:**

> This changes the game. Native cross-item correlation in Fabric is what every data engineering team has been waiting for.
>
> What I want to understand:
> - What item types are covered? (Pipelines + notebooks + dataflows + semantic models + copy jobs?)
> - Does it work across workspaces?
> - What is the retention window for correlation data?
> - Is it available in the Monitoring Hub UI, or only via API?
>
> The devil is in the details, but the direction is exactly right. If this covers the full execution chain and persists beyond 30 days, it eliminates one of the biggest operational pain points in Fabric.
>
> We'll be testing it against our correlation engine to see how they compare. More analysis coming this week.
>
> #FabCon2026 #MicrosoftFabric

**Internal action:** Deep-dive into the announced capability. Identify what our correlation engine does that the native solution does not (likely: cross-workspace, longer retention, SLO integration, custom correlation rules). Pivot messaging accordingly.

---

#### Scenario C: Microsoft Announces New Workloads in Workload Hub (Not Observability)

**Likelihood:** High
**Impact on us:** Positive (validates the workload model without adding competition)

**LinkedIn response template:**

> The Workload Hub is growing. [Specific new workload names] joining 2TEST, Informatica Cloud DQ, and SQL2Fabric-Mirroring.
>
> This matters because it validates the Fabric Extensibility Toolkit as a real delivery channel for ISVs and community builders. More workloads = more ecosystem maturity = more reason for teams to invest in Fabric.
>
> Notably: there's still no dedicated observability workload in the Hub. The gap between Fabric's powerful compute model and its operational tooling remains the biggest opportunity for the community.
>
> That's exactly what we're building: https://github.com/tenfingerseddy/FabricWorkloads
>
> #FabCon2026 #MicrosoftFabric #Extensibility

---

#### Scenario D: FET Session Announces Scheduler Support

**Likelihood:** Medium (explicitly listed as "under development" in current FET docs)
**Impact on us:** Very high (unblocks our Fabric-native workload migration)

**LinkedIn response template:**

> Scheduler support for the Fabric Extensibility Toolkit. This is the announcement I've been waiting for.
>
> For anyone building custom Fabric workloads, the scheduler was the one missing piece that forced workarounds. Without it, your workload items couldn't run on a schedule natively within Fabric -- you needed external orchestration.
>
> With scheduler support, a custom workload item can:
> - Run on a user-defined schedule inside Fabric
> - Show execution history in the Monitoring Hub
> - Integrate with Fabric's capacity management
>
> This has massive implications for the ISV ecosystem. Workloads that collect, analyze, and act on data on a schedule -- like observability tools -- can now run entirely within Fabric.
>
> We're building the Observability Workbench as a Fabric-native workload. Scheduler support means we can run our collection, correlation, and alerting jobs on a native Fabric schedule. No external dependencies.
>
> Accelerating our migration timeline starting this week.
>
> #FabCon2026 #MicrosoftFabric #ExtensibilityToolkit

**Internal action:** Immediately begin FET migration planning. Update the development roadmap. Target Workload Hub submission in Q2 2026.

---

#### Scenario E: No Significant Monitoring/Observability Announcements

**Likelihood:** Medium-high
**Impact on us:** Positive (validates that the gap persists)

**LinkedIn response template:**

> FabCon 2026 delivered [impressive announcements in X, Y, Z areas]. The investment in [specific areas] shows Microsoft is listening to what production teams need.
>
> On the observability front, the landscape is largely unchanged:
> - Monitoring Hub: 30-day retention, 100-activity limit
> - Workspace Monitoring: 30-day retention, no pipeline/notebook/dataflow coverage
> - Cross-item correlation: still manual
> - SLO framework: still nonexistent natively
> - Alerting: still per-item via Data Activator
>
> This is not a criticism. Microsoft is tackling an enormous platform with finite engineering resources. The fact that observability was the focus of [X] sessions shows they know it matters.
>
> The opportunity for the community is clear: build the operational tooling that production teams need today, using the Extensibility Toolkit and APIs that Microsoft provides.
>
> That's what we're doing: https://github.com/tenfingerseddy/FabricWorkloads
>
> #FabCon2026 #MicrosoftFabric #Observability

---

#### Scenario F: Microsoft Announces Native SLO/Error Budget Framework

**Likelihood:** Very low
**Impact on us:** Very high (directly competes with core feature)

**LinkedIn response template:**

> A native SLO framework for Fabric. This would be transformational for data reliability engineering.
>
> Questions I want answered:
> - Can you define SLOs across item types (pipeline success rate + semantic model freshness + report availability)?
> - What time windows are supported (7-day, 30-day rolling)?
> - Does it integrate with alerting? Can you alert on "error budget 50% consumed"?
> - Does it persist historical SLO performance beyond 30 days?
>
> If Microsoft delivers on all of these, it fundamentally changes the observability story in Fabric. We'll be testing it against our SLO engine and sharing a detailed comparison.
>
> #FabCon2026 #MicrosoftFabric

**Internal action:** Urgently evaluate the native SLO feature scope. Identify differentiation angles (cross-workspace SLOs, historical trends, composite SLOs, integration with cost data). Pivot to emphasize the gaps the native solution does not cover.

---

### 2.4 Real-Time LinkedIn Post Templates (Fill-in-the-Blank)

These are for quick reactions to announcements during sessions. Publish within 2 hours.

**Quick reaction (positive announcement):**

> Just saw the [feature name] announcement at FabCon. [One sentence on what it does]. This directly addresses [specific pain point]. The teams running [X] in production will feel this immediately.
>
> What I'm curious about: [one follow-up question]. Details at [link if available].
>
> #FabCon2026 #MicrosoftFabric

**Quick reaction (surprising announcement):**

> Did not expect to see [feature/announcement] at FabCon this year. [One sentence on what it means]. This changes the calculus for teams that were [doing X workaround].
>
> Need to dig deeper on [specific detail]. Will share analysis once the session recording is available.
>
> #FabCon2026 #MicrosoftFabric

**Session recap (after watching a key session):**

> Key takeaways from "[Session Name]" at FabCon 2026:
>
> 1. [Takeaway 1 -- specific, not generic]
> 2. [Takeaway 2]
> 3. [Takeaway 3]
>
> What this means for teams running Fabric in production: [one-sentence implication].
>
> What's still missing: [one gap that our product addresses].
>
> #FabCon2026 #MicrosoftFabric

**Data point reaction (stat or number shared in session):**

> [Speaker name] just shared that [specific statistic -- e.g., "30,000+ organizations are now running Fabric in production"]. That's [context on why this matters].
>
> For context, when we started building observability tooling for Fabric [X months ago], the number was [lower number or qualitative comparison]. The growth rate validates that operational tooling is not a nice-to-have -- it's a scaling prerequisite.
>
> #FabCon2026 #MicrosoftFabric

### 2.5 Community Engagement Targets

**LinkedIn:**
- Minimum 1 original post per day (Mon-Fri)
- Comment on at least 5 FabCon-related posts per day
- React to (like/celebrate) at least 15 posts per day
- Reply to every comment on our posts within 4 hours during waking hours

**Reddit:**
- Post to r/MicrosoftFabric on Tuesday (monitoring question) and Friday (wrap-up)
- Comment on every FabCon-related thread in r/MicrosoftFabric (aim for 3-5 comments/day)
- Upvote quality FabCon content from other community members

**X/Twitter:**
- Monitor #FabCon2026 and #MicrosoftFabric hashtags
- Quote-tweet interesting session insights with our analysis
- Minimum 3-5 engagement actions per day (replies, quote tweets)

**Fabric Community Forums:**
- Check community.fabric.microsoft.com daily during FabCon week
- Answer any monitoring/observability questions that arise from session discussions

### 2.6 Content Capture Log

Maintain a running log throughout FabCon week. This feeds directly into the post-FabCon recap blog.

```
## FabCon 2026 Content Capture Log

### Announcements (note each with source, time, exact wording)
- [ ] Keynote announcements
- [ ] Monitoring-related announcements
- [ ] FET-related announcements
- [ ] Workload Hub announcements
- [ ] Capacity/FinOps announcements

### Quotes (from speakers, attendees on social media)
- [ ] Pain point quotes (support our positioning)
- [ ] Feature request quotes (validate our roadmap)
- [ ] Competitive mentions (any references to observability tools)

### Numbers/Statistics
- [ ] Fabric adoption numbers
- [ ] Session attendance numbers
- [ ] Any monitoring/observability-related stats

### Community Reactions
- [ ] Top-performing FabCon LinkedIn posts (engagement metrics)
- [ ] Top Reddit threads from the week
- [ ] Any viral moments or controversies

### Product Impact
- [ ] Features confirmed coming (with timelines)
- [ ] Features confirmed NOT coming
- [ ] New APIs or data sources we should ingest
- [ ] Competitive intelligence
```

---

## 3. Post-FabCon: March 21-23

### 3.1 Recap Blog Post: "What FabCon 2026 Means for Fabric Observability"

**Target publish date:** Tuesday March 24 (within 4 days of conference close)
**Target length:** 2,000-3,000 words
**Target SEO keywords:** "FabCon 2026 recap", "Fabric observability 2026", "FabCon announcements", "Microsoft Fabric monitoring"

**Structure:**

```
Title: What FabCon 2026 Revealed About the State of Fabric Observability

1. Introduction
   - FabCon 2026 by the numbers (attendance, sessions, keynote highlights)
   - Why observability was a recurring theme

2. What Microsoft Shipped/Announced
   - [List every monitoring/observability-relevant announcement]
   - Credit where due -- specific improvements and their impact
   - Link to specific sessions for readers who want the details

3. What Did Not Change
   - Monitoring Hub retention (30 days -- unchanged?)
   - Cross-item correlation (still not native?)
   - SLO framework (still absent?)
   - Workspace-level alerting (still per-item?)
   - Walk through each gap with specific production impact

4. The Extensibility Toolkit Update
   - What was announced at the Gerd Saurer session
   - Scheduler support status
   - What this means for ISVs building on Fabric

5. The March 23 Tenant Setting Change
   - What it is (workspace admins can enable monitoring)
   - What it means (more users will discover the 30-day retention limit)
   - What to do about it (link to our tooling)

6. Our Interpretation: What This Means for Fabric Teams
   - The monitoring investment is real but the structural gaps remain
   - Teams need a dedicated observability layer today
   - The Extensibility Toolkit is the path to native solutions

7. What We're Building Next
   - Brief roadmap update informed by FabCon announcements
   - Link to GitHub repo
   - Call for community input

8. Conclusion
   - FabCon validated the market need
   - The window for community-built observability is open
```

**Writing guidelines:**
- Reference specific sessions by name and speaker
- Include direct quotes from sessions where available
- Acknowledge Microsoft's progress before discussing gaps
- Position our tool as one part of the solution, not THE solution
- End with a forward-looking, optimistic tone

### 3.2 "What FabCon Means for Fabric Observability" Analysis Template

Use this template to structure the analysis immediately after the conference closes. Fill in during Friday evening / Saturday morning while details are fresh.

```
## FabCon 2026 Observability Impact Analysis

### Category 1: Monitoring Hub Changes
- What was announced: ___
- Current state after announcements: ___
- Impact on our value proposition: ___
- Action required: ___

### Category 2: Workspace Monitoring Changes
- What was announced: ___
- Current state after announcements: ___
- Impact on our value proposition: ___
- Action required: ___

### Category 3: Alerting/Notification Changes
- What was announced: ___
- Current state after announcements: ___
- Impact on our value proposition: ___
- Action required: ___

### Category 4: Extensibility Toolkit Updates
- What was announced: ___
- Scheduler support status: ___
- CI/CD support status: ___
- CRUD notification API status: ___
- Impact on our development roadmap: ___
- Action required: ___

### Category 5: Workload Hub Updates
- New workloads announced: ___
- Observability workloads: ___
- Publishing process changes: ___
- Impact on our launch timeline: ___
- Action required: ___

### Category 6: Competitive Intelligence
- Tools/products mentioned in sessions: ___
- Partner announcements relevant to observability: ___
- Community sentiment on monitoring gaps: ___

### Category 7: New APIs/Data Sources
- New APIs announced: ___
- New system views: ___
- New diagnostic capabilities: ___
- Items to add to our collector: ___

### Overall Assessment
- Did the observability gap widen, narrow, or stay the same? ___
- What is the single biggest change to our positioning? ___
- What is the single biggest change to our roadmap? ___
- Updated competitive positioning statement: ___
```

### 3.3 March 23 Marketing Push: Tenant Default Change

**Background:** On March 23, the tenant setting "Workspace admins can turn on monitoring for their workspaces" flips to enabled by default. This does not auto-enable monitoring -- it gives workspace admins the ability to opt in without needing tenant admin permission.

**Why this matters for us:** A wave of workspace admins will enable monitoring for the first time. Within days, they will discover the 30-day retention limit, the coverage gaps, and the absence of cross-item correlation. This is the moment our content is most relevant.

**Marketing push timeline:**

| Date | Action | Details |
|------|--------|---------|
| Mon Mar 23 | LinkedIn Post #1 | Post-FabCon recap + CU Waste Score announcement (from `week-04-post-fabcon-social-posts.md`) |
| Mon Mar 23 | Monitor r/MicrosoftFabric | Watch for threads about the tenant setting change. Be ready with helpful context. |
| Tue Mar 24 | Reddit Post | "How to calculate CU waste" step-by-step guide (from week-04 content) |
| Tue Mar 24 | Blog 5 publish | Publish Blog 5: "CU Waste Score" on dev.to (from `blog-05-devto.md`). The timing amplifies the cost conversation from FabCon. |
| Wed Mar 25 | LinkedIn Post #2 | Technical deep-dive on retry waste (from week-04 content) |
| Wed Mar 25 | X/Twitter thread | 7-tweet thread on CU waste (from week-04 content) |
| Thu Mar 26 | Reddit Post | Post-FabCon observability improvements discussion (from week-04 content) |
| Fri Mar 27 | LinkedIn Post #3 | Community engagement: biggest pain point poll (from week-04 content) |

**Tenant setting change content angles:**

1. **Explainer angle:** "The Fabric tenant setting that just changed -- what it means and what to do about it"
   - Explain the change in plain language
   - Walk through how to enable workspace monitoring
   - Immediately surface the limitations (30-day retention, no pipeline coverage)
   - Link to our tool for extended retention and correlation

2. **Timing angle:** "FabCon week + March 23 tenant change = the biggest week for Fabric monitoring awareness"
   - Position the confluence of events as a wake-up call
   - Link to our FabCon recap blog for context

3. **Reddit response template (for threads about the tenant change):**
   > The March 23 change gives workspace admins the ability to enable monitoring without tenant admin approval. Good step forward.
   >
   > A few things to know when you enable it:
   > - It creates Eventstream and Eventhouse resources in your workspace (these consume CUs)
   > - Retention is 30 days, not configurable
   > - It covers Spark sessions and SQL analytics but NOT pipelines, notebooks, or dataflows
   > - The data goes into KQL tables you can query directly
   >
   > For teams that need longer retention or cross-item correlation, there are open-source options. Happy to share what we've been using if helpful.

### 3.4 Week 4 Social Post Execution Schedule

Full schedule from `week-04-post-fabcon-social-posts.md`:

| Day | Platform | Content | Time | Status |
|-----|----------|---------|------|--------|
| Mon Mar 23 | LinkedIn | Post-FabCon recap + CU Waste Score | 8:30 AM AEST | Ready |
| Tue Mar 24 | Reddit | CU waste step-by-step guide | 10:00 AM EST | Ready |
| Tue Mar 24 | dev.to | Blog 5: CU Waste Score | 10:00 AM EST | Ready |
| Wed Mar 25 | LinkedIn | Technical deep-dive: retry waste | 8:30 AM AEST | Ready |
| Wed Mar 25 | X/Twitter | 7-tweet CU waste thread | 12:00 PM EST | Ready |
| Thu Mar 26 | Reddit | Post-FabCon observability discussion | 10:00 AM EST | Ready |
| Fri Mar 27 | LinkedIn | Community pain point poll | 8:30 AM AEST | Ready |

**Post-FabCon content additions (write March 21-23):**
- [ ] FabCon recap blog (publish March 24-25, structure in section 3.1 above)
- [ ] Update all Week 4 social post templates with actual FabCon announcements (currently templated)
- [ ] If FET scheduler announced: write a separate LinkedIn post about our migration plans

---

## 4. Success Metrics

### 4.1 GitHub Metrics (FabCon window: March 14-28)

| Metric | Pre-FabCon baseline (measure Mar 13) | FabCon target (by Mar 28) | Stretch target |
|--------|--------------------------------------|---------------------------|----------------|
| Stars | Current count | +25 new stars | +50 new stars |
| Forks | Current count | +5 new forks | +10 new forks |
| Repo visitors (unique) | Measure via Insights | 200 unique visitors | 500 unique visitors |
| Issues opened (external) | 0 | 3 new issues | 10 new issues |
| Clone count | Measure via Insights | 50 clones | 100 clones |

### 4.2 LinkedIn Metrics (March 10-28)

| Metric | Target | Stretch |
|--------|--------|---------|
| Total impressions (all posts) | 5,000 | 15,000 |
| Total engagement actions (likes, comments, shares) | 200 | 500 |
| New followers | 50 | 150 |
| Posts with 1,000+ impressions | 3 | 6 |
| Comments received (total across all posts) | 30 | 75 |

### 4.3 Reddit Metrics (March 10-28)

| Metric | Target | Stretch |
|--------|--------|---------|
| Post karma (total across all FabCon posts) | 50 | 150 |
| Comments received on our posts | 15 | 40 |
| Comments we made on others' posts | 30 | 60 |
| Threads where we were cited/linked by others | 1 | 5 |

### 4.4 Content Metrics

| Metric | Target | Stretch |
|--------|--------|---------|
| Blog 4 views (dev.to, first 14 days) | 500 | 2,000 |
| Blog 5 views (dev.to, first 14 days) | 300 | 1,000 |
| Total blog views across all 5 blogs (March) | 1,500 | 5,000 |
| dev.to reactions (total across Blog 4+5) | 20 | 75 |

### 4.5 Community Engagement

| Metric | Target | Stretch |
|--------|--------|---------|
| Inbound DMs/emails asking about the product | 3 | 10 |
| External contributors to GitHub repo | 1 | 3 |
| Mentions by others (LinkedIn, Reddit, Twitter) | 5 | 15 |
| Community forum answers we provided | 5 | 15 |

### 4.6 Measurement Protocol

- **Daily during FabCon week:** Screenshot GitHub Insights, LinkedIn post analytics, Reddit post metrics
- **March 13 (pre-FabCon baseline):** Record all baseline numbers across all platforms
- **March 28 (post-FabCon measurement):** Record final numbers, calculate deltas
- **Store metrics in:** `business/analytics/fabcon-2026-metrics.md` (create after March 28)

---

## 5. Asset Inventory

All assets referenced in this playbook, with their locations and readiness status.

### Blog Posts

| Asset | Location | Status |
|-------|----------|--------|
| Blog 1: State of Fabric Observability | `business/market-research/blog-01-state-of-fabric-observability.md` | Published |
| Blog 1 (dev.to) | `business/market-research/blog-01-devto.md` | Published |
| Blog 2: Cross-Item Correlation | `business/market-research/blog-02-cross-item-correlation.md` | Published |
| Blog 2 (dev.to) | `business/market-research/blog-02-devto.md` | Published |
| Blog 3: Hidden Cost of Bad Data | `business/market-research/blog-03-hidden-cost-bad-data-fabric.md` | Published |
| Blog 3 (dev.to) | `business/market-research/blog-03-devto.md` | Published |
| Blog 4: FabCon Observability Gap | `business/market-research/blog-04-fabcon-observability-gap.md` | Ready -- publish Mar 14 |
| Blog 4 (dev.to) | `business/market-research/blog-04-devto.md` | Ready -- publish Mar 14 |
| Blog 5: CU Waste Score | `business/market-research/blog-05-cu-waste-score.md` | Ready -- publish Mar 24 |
| Blog 5 (dev.to) | `business/market-research/blog-05-devto.md` | Ready -- publish Mar 24 |
| Blog 6: FabCon Recap | TBD | Write Mar 21-23, publish Mar 24-25 |

### Social Media Content

| Asset | Location | Status |
|-------|----------|--------|
| Week 1 social posts | `business/content/week-01-social-posts.md` | Published |
| Week 2 social posts | `business/content/week-02-social-posts.md` | Active this week |
| Week 2 LinkedIn thought leadership | `business/content/week-02-linkedin-thought-leadership.md` | Active this week |
| Week 3 FabCon social posts | `business/content/week-03-fabcon-social-posts.md` | Ready for FabCon week |
| Week 4 post-FabCon social posts | `business/content/week-04-post-fabcon-social-posts.md` | Ready for post-FabCon |

### Strategic Documents

| Asset | Location | Status |
|-------|----------|--------|
| FabCon engagement plan (original) | `business/content/fabcon-2026-engagement-plan.md` | Superseded by this playbook |
| March 2026 Fabric intel report | `business/market-research/march-2026-fabric-intel.md` | Current |
| Content calendar (12-week) | `business/strategy/content-calendar.md` | Current |
| Business plan | `business/strategy/business-plan.md` | Current |
| Competitive analysis | `business/market-research/competitive-analysis.md` | Current |

### Product Assets

| Asset | Location | Status |
|-------|----------|--------|
| GitHub repo | https://github.com/tenfingerseddy/FabricWorkloads | Live |
| Landing page | `products/observability-workbench/landing-page/index.html` | Live |
| Health check script | `products/observability-workbench/scripts/fabric-health-check.sh` | Live |
| CI/CD workflow | `.github/workflows/ci.yml` | Live |

### URLs to Share

Keep these ready for copy-paste during FabCon week:

```
GitHub repo:     https://github.com/tenfingerseddy/FabricWorkloads
Blog 1 (dev.to): [insert dev.to URL after publishing]
Blog 2 (dev.to): [insert dev.to URL after publishing]
Blog 3 (dev.to): [insert dev.to URL after publishing]
Blog 4 (dev.to): [insert dev.to URL after publishing]
Blog 5 (dev.to): [insert dev.to URL after publishing]
```

---

## 6. Risk Scenarios and Contingencies

### Risk 1: Microsoft Announces a Comprehensive Observability Solution

**Probability:** Very low (would require shipping retention extension + cross-item correlation + SLOs + alerting)
**Response:** Pivot to "complement, don't compete." Emphasize open source, community-driven, fills the gaps until the native solution matures. Focus on speed of iteration vs. Microsoft's release cadence.

### Risk 2: A Competitor Announces a Fabric-Native Observability Workload

**Probability:** Low (no signals in current competitive landscape)
**Response:** First-mover advantage is already ours. Emphasize our open-source approach, MIT license, community involvement. Compare on price and Fabric-nativeness. Our tool is already collecting real data from production environments.

### Risk 3: FabCon Sessions Reveal Our Technical Approach Is Wrong

**Probability:** Low-medium (new APIs or architecture changes could affect our approach)
**Response:** This is actually good news -- it means we learn something. Document the change, update the roadmap, and write a blog post about how we are adapting. Transparency builds trust.

### Risk 4: Community Backlash (perceived as too promotional)

**Probability:** Medium (Reddit is allergic to marketing)
**Response:** Immediately pull back on any content that feels promotional. Double down on helpful, technical content. If a specific post gets negative feedback, respond graciously and adjust. The rule: every post must provide standalone value even if our product did not exist.

### Risk 5: Low Engagement Despite Efforts

**Probability:** Medium (FabCon generates a lot of noise; we may get drowned out)
**Response:** This is a long game. Even if FabCon week engagement is modest, the content is evergreen. Blog posts continue to generate search traffic. GitHub repo continues to accumulate stars. Stay consistent with the 12-week calendar regardless of FabCon week performance.

### Risk 6: GitHub Repo Has a Bug During Peak Visibility

**Probability:** Medium (Murphy's law)
**Response:** Fix immediately. Treat any bug report during FabCon week as P0. Fast, transparent fixes during peak visibility actually build more trust than a bug-free experience that nobody notices. Respond to GitHub issues within 2 hours during FabCon week.

---

## Appendix: FabCon 2026 Quick Reference

**Conference dates:** March 16-20, 2026
**Location:** Georgia World Congress Center, Atlanta, GA
**Expected attendance:** 7,500+
**Total sessions:** 200+
**Co-located event:** SQLCon (first time)
**Keynote speakers:** Arun Ulag, Amir Netz, Wangui McKelvey, Nellie Gustafsson, Patrick LeBlanc, Adam Saxton

**Our critical sessions (Thursday March 19):**
1. 8:00 AM EST -- Capacity monitoring (Yarveisi, Arora)
2. 10:10 AM EST -- Purview data quality (Mannan, Strasser)
3. 11:30 AM EST -- Monitor and troubleshoot (Muziki, Liu)
4. 2:00 PM EST -- Extensibility Toolkit (Saurer, Bercovitz)

**March 23 tenant change:** Workspace admins can enable monitoring by default

**Our key URLs:**
- GitHub: https://github.com/tenfingerseddy/FabricWorkloads
- Hashtags to monitor: #FabCon2026 #MicrosoftFabric
- Subreddits: r/MicrosoftFabric, r/PowerBI

---

*Last updated: March 9, 2026*
*Owner: GTM Strategy*
*This playbook supersedes: `fabcon-2026-engagement-plan.md`*
