# Blog Publishing Checklist and Process

> Standard operating procedure for publishing Observability Workbench blog content.
> Last updated: March 2026

---

## Overview

This checklist covers every step from final draft through post-publish monitoring for each blog post. Follow it sequentially. Each blog post should have two versions: the canonical version (in `business/market-research/`) and the dev.to version (same directory, `-devto.md` suffix).

**Publishing cadence**: One blog post per week, published Tuesday morning (US Eastern) for peak dev.to and LinkedIn engagement.

**Author attribution**: "Kane Snyder" for byline, "Observability Workbench Team" for the bio/footer.

---

## Phase 1: Pre-Publish Content Review

### Content Quality

- [ ] Title is under 70 characters (SEO best practice for full display in search results)
- [ ] Title includes the primary target keyword for the post
- [ ] Opening paragraph hooks the reader within the first two sentences (no generic intros)
- [ ] Post includes at least one concrete code example, KQL query, or API call
- [ ] All code blocks have correct language tags (`typescript`, `kql`, `json`, `http`, `sql`)
- [ ] Post ends with a clear call-to-action (GitHub link, comment prompt, or design partner ask)
- [ ] Reading time is appropriate for the content type:
  - Thought leadership / problem statement: 8-12 minutes (1,800-2,800 words)
  - Technical deep-dive: 10-15 minutes (2,200-3,500 words)
  - How-to / tutorial: 6-10 minutes (1,400-2,200 words)
- [ ] Post has been proofread for grammar, spelling, and technical accuracy
- [ ] All Fabric API endpoints referenced are correct and current
- [ ] Any pricing or metric claims have sources or are based on documented calculations

### SEO Optimization

- [ ] Primary keyword appears in the title
- [ ] Primary keyword appears in the first 100 words of the body
- [ ] Primary keyword appears in at least one H2 heading
- [ ] Secondary keywords appear naturally in the body (2-3 instances each)
- [ ] Meta description is 150-160 characters and includes the primary keyword
- [ ] Meta description reads as a compelling summary, not keyword stuffing
- [ ] Internal links to previous blog posts in the series (minimum 1 per post after Blog 01)
- [ ] External link to GitHub repo (https://github.com/tenfingerseddy/FabricWorkloads)
- [ ] H2/H3 heading structure is logical and scannable

### Internal Linking Strategy

Blog posts should cross-reference each other to build topical authority:

| Post | Links TO |
|------|----------|
| Blog 01 (State of Observability) | GitHub repo |
| Blog 02 (Cross-Item Correlation) | Blog 01, GitHub repo |
| Blog 05 (CU Waste Score) | Blog 02, Blog 01, GitHub repo |
| Blog 06 (Extensibility Toolkit) | Blog 01, Blog 02, GitHub repo |
| Future posts | At least 2 previous posts + GitHub repo |

### Cover Image

- [ ] Cover image created (required for dev.to, LinkedIn, and social sharing)
- [ ] Dimensions: 1000x420 pixels (dev.to recommended ratio)
- [ ] Image includes the post title or a key visual concept
- [ ] No copyrighted imagery; use original graphics or licensed stock
- [ ] Image file size under 1 MB
- [ ] Alt text written for accessibility
- [ ] Image stored in `business/content/images/` with naming convention: `blog-NN-cover.png`

---

## Phase 2: Platform-Specific Preparation

### dev.to (Primary Platform)

dev.to is our primary distribution channel due to its data engineering community and SEO authority.

#### Front Matter Template

```yaml
---
title: "[Post Title - under 70 characters]"
published: false
description: "[150-160 character meta description]"
tags: microsoft-fabric, [tag2], [tag3], [tag4]
cover_image: [URL to hosted cover image]
canonical_url: [leave blank if dev.to is primary; set if cross-posting]
series: "Fabric Observability Deep Dives"
---
```

#### dev.to Specifics

- [ ] Front matter is complete and correct
- [ ] `published` is set to `false` (will be flipped to `true` at publish time)
- [ ] Tags: maximum 4 tags, all lowercase, hyphens for spaces
- [ ] Required tag: `microsoft-fabric` (present on every post)
- [ ] Common tags to rotate: `observability`, `data-engineering`, `monitoring`, `kql`, `typescript`, `finops`, `devops`, `sre`
- [ ] Series field set to `"Fabric Observability Deep Dives"` for all posts in the series
- [ ] Cover image URL is a publicly accessible link (not a local file path)
- [ ] GitHub repo embed uses dev.to liquid tag: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
- [ ] Code blocks use dev.to-supported language identifiers
- [ ] No HTML that dev.to's markdown parser will strip (test in preview)
- [ ] All relative links from the canonical version converted to absolute URLs
- [ ] Bio footer includes link to GitHub repo and series context

#### dev.to Tag Selection Guide

| Post Topic | Recommended Tags |
|------------|-----------------|
| Monitoring/observability gaps | `microsoft-fabric`, `observability`, `data-engineering`, `monitoring` |
| Technical deep-dive (code) | `microsoft-fabric`, `data-engineering`, `typescript`, `kql` |
| FinOps / cost optimization | `microsoft-fabric`, `finops`, `data-engineering`, `observability` |
| Platform / toolkit | `microsoft-fabric`, `data-engineering`, `devops`, `typescript` |
| SRE / SLO content | `microsoft-fabric`, `sre`, `observability`, `data-engineering` |

### LinkedIn Articles (Secondary Platform)

LinkedIn articles reach a different audience (managers, architects, decision-makers) than dev.to (individual contributors, engineers).

#### LinkedIn Article Preparation

- [ ] Title adapted for LinkedIn audience (more business-oriented if needed)
- [ ] Article body is the full post (LinkedIn supports long-form articles)
- [ ] Cover image uploaded (LinkedIn recommends 1200x644 pixels; the dev.to cover works)
- [ ] First paragraph is the strongest hook (LinkedIn truncates preview text)
- [ ] Hashtags prepared: 3-5 relevant hashtags at the bottom of the article
- [ ] Required hashtags: `#MicrosoftFabric` `#DataEngineering`
- [ ] Rotating hashtags: `#Observability` `#DataOps` `#FinOps` `#SRE` `#Analytics` `#DataQuality`
- [ ] All code blocks verified to render in LinkedIn's editor (LinkedIn code formatting is limited; consider screenshots for complex code)
- [ ] Author profile (Kane Snyder) has current headline and profile referencing Fabric/observability work

#### LinkedIn First-Comment Strategy

The first comment on a LinkedIn article gets significant visibility and can drive engagement. Prepare this comment before publishing the article.

Template for first comment:
```
Context for this post: We've been building [specific thing] for the past
[time period] and [specific finding/result]. Curious to hear from others
who have dealt with [the problem this post addresses].

If you're running Fabric in production and want to shape what
enterprise-grade observability looks like, DM me -- we're looking
for design partners.
```

- [ ] First comment drafted and saved (not generic; specific to the post's topic)
- [ ] First comment posted within 2 minutes of article publication

### GitHub Discussions / Blog

GitHub Discussions on the repo serve as a community hub for technical readers who find us through GitHub.

- [ ] Create a Discussion post in the `tenfingerseddy/FabricWorkloads` repo
- [ ] Category: "Announcements" for new posts, "General" for discussion-oriented posts
- [ ] Title: Same as blog post title
- [ ] Body: Brief summary (3-4 sentences) + link to the full post on dev.to
- [ ] Include 1-2 specific questions to prompt discussion
- [ ] Pin the Discussion if it is an announcement-tier post

---

## Phase 3: Publishing Sequence

Execute these steps in order. The timing matters for cross-platform distribution.

### Publication Day (Tuesday)

**08:00 AM ET: Publish on dev.to**
- [ ] Set `published: true` in the front matter
- [ ] Verify the post renders correctly (check code blocks, images, links)
- [ ] Verify the series link appears correctly
- [ ] Copy the published URL

**08:15 AM ET: Publish LinkedIn article**
- [ ] Publish the LinkedIn article
- [ ] Post the prepared first comment immediately
- [ ] Include the dev.to link at the bottom of the article as a "Read the full technical version" link

**09:00 AM ET: GitHub Discussion**
- [ ] Create the GitHub Discussion post with the summary and dev.to link
- [ ] If applicable, link to specific source files discussed in the post

**10:00 AM ET: Cross-promotion on social platforms**
- [ ] Reddit posts (see Phase 4)
- [ ] Twitter/X thread (see Phase 4)

---

## Phase 4: Cross-Promotion

### Reddit

Reddit is critical for reaching the Fabric community, but requires a community-first approach. Never post a bare link. Always provide value in the post body.

#### r/MicrosoftFabric

- [ ] Post title is a genuine question or observation, not a marketing headline
- [ ] Post body provides value independently (summary of key findings, a useful code snippet, or a genuine question)
- [ ] Link to the full post is at the bottom, framed as "I wrote more about this here: [link]"
- [ ] Post is from a personal account, not a brand account
- [ ] No self-promotional language ("we built," "check out our tool")
- [ ] Engage with every comment within 24 hours

#### r/dataengineering

- [ ] Post only when the content is broadly relevant (not Fabric-specific niche topics)
- [ ] Focus on the universal engineering problem (observability, SLOs, cost optimization) rather than the Fabric-specific implementation
- [ ] Same rules as r/MicrosoftFabric: value-first, link at the bottom

#### Reddit Post Template

```
Title: [Observation or question, not a blog title]

Body:
[2-3 paragraphs of genuine value: the problem, what you found,
a useful code snippet or insight]

[Optional: specific question to the community]

I wrote a longer piece about this with [specific detail]: [link]
```

### Twitter/X

- [ ] Thread of 4-6 tweets summarizing the key points
- [ ] First tweet is the hook (the most compelling finding or claim)
- [ ] Include 1 code screenshot or diagram image in the thread
- [ ] Last tweet links to the full post on dev.to
- [ ] Hashtags: #MicrosoftFabric #DataEngineering (only in the first or last tweet)
- [ ] Tag relevant accounts if the content references their work

### Twitter Thread Template

```
Tweet 1: [Hook - the most surprising finding or bold claim]

Tweet 2: [The problem in concrete terms]

Tweet 3: [What you did about it / the approach]

Tweet 4: [A specific result, code snippet, or metric]

Tweet 5: [Link to full post] + [GitHub link if relevant]
```

---

## Phase 5: Post-Publish Monitoring (First 48 Hours)

The first 48 hours after publication determine the post's long-term reach. Active engagement during this window is critical.

### Hour 0-4

- [ ] Monitor dev.to for comments; respond within 1 hour
- [ ] Monitor LinkedIn for comments; respond within 1 hour
- [ ] Check that all links in the published posts work correctly
- [ ] Fix any formatting issues found after publication

### Hour 4-24

- [ ] Check Reddit posts for comments and upvotes; engage substantively
- [ ] Respond to any GitHub Discussion replies
- [ ] If the post is gaining traction on dev.to, share it in relevant Discord/Slack communities:
  - Microsoft Fabric Community
  - Data Engineering Discord servers
  - dbt Community Slack (if content is relevant)
- [ ] Screenshot early engagement metrics for internal tracking

### Hour 24-48

- [ ] Second round of comment responses across all platforms
- [ ] If LinkedIn engagement is strong, create a follow-up post referencing the article
- [ ] If Reddit engagement is strong, respond to additional threads that reference similar problems

### Metric Tracking

Record these metrics 48 hours after publication in `business/content/metrics/`:

| Platform | Metric | Target |
|----------|--------|--------|
| dev.to | Views | 500+ per post |
| dev.to | Reactions | 20+ per post |
| dev.to | Comments | 5+ per post |
| dev.to | Reading time average | >3 minutes |
| LinkedIn | Impressions | 2,000+ per article |
| LinkedIn | Engagement rate | 5%+ |
| LinkedIn | Comments | 10+ per article |
| Reddit | Upvotes (combined) | 20+ per post |
| Reddit | Comments | 5+ per post |
| GitHub | Star increase | 5+ per week of content |
| GitHub | Discussion replies | 3+ per announcement |

---

## Phase 6: Repurposing

Each blog post should generate additional content assets within 1 week of publication.

- [ ] Extract 2-3 standalone social media posts from the blog content (key quotes, stats, code snippets)
- [ ] If the post contains a KQL query or code example, create a standalone gist or repo file
- [ ] Add the post to the "Resources" section of the GitHub README if it adds user value
- [ ] Update the landing page (products/observability-workbench/landing-page/) if the post introduces a new capability
- [ ] Consider whether the post warrants a short YouTube video walkthrough (technical deep-dives especially)

---

## Quick Reference: File Locations

| Asset | Path |
|-------|------|
| Blog posts (canonical) | `business/market-research/blog-NN-[slug].md` |
| Blog posts (dev.to) | `business/market-research/blog-NN-devto.md` |
| Social media posts | `business/content/week-NN-social-posts.md` |
| Cover images | `business/content/images/blog-NN-cover.png` |
| Publishing metrics | `business/content/metrics/blog-NN-metrics.md` |
| SEO keywords | `business/content/seo-keywords.md` |
| Content calendar | `business/strategy/content-calendar.md` |
| Competitive analysis | `business/market-research/competitive-analysis.md` |

---

## Version History

| Date | Change |
|------|--------|
| 2026-03-09 | Initial checklist created |
