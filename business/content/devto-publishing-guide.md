# dev.to Publishing Guide: Observability Workbench Blog Series

> Step-by-step guide for publishing, cross-posting, and maximizing reach for every blog post.

---

## Table of Contents

1. [dev.to Publishing Workflow](#devto-publishing-workflow)
2. [Optimal Posting Times](#optimal-posting-times)
3. [Tag Strategy](#tag-strategy)
4. [Cross-Posting to Hashnode and Medium](#cross-posting-to-hashnode-and-medium)
5. [Canonical URL Strategy](#canonical-url-strategy)
6. [Post-Publish Checklist](#post-publish-checklist)
7. [Engagement Best Practices](#engagement-best-practices)

---

## dev.to Publishing Workflow

### Step 1: Prepare the Post

Each blog has two files in `business/content/`:
- `blog-XX-[topic].md` -- the canonical version (longer, with diagrams described in markdown)
- `blog-XX-devto.md` -- the dev.to version (with front matter, dev.to-specific formatting)

The dev.to version already includes the front matter block. Before publishing, update these fields:

```yaml
---
title: "Your Title Here"
published: false          # Change to true when ready
description: "150-160 characters, includes primary keyword"
tags: microsoft-fabric, observability, data-engineering, monitoring   # max 4 tags
series: "Fabric Observability Deep Dives"
canonical_url:            # Set this ONLY if publishing elsewhere first (see below)
cover_image:              # Optional: URL to cover image (1000x420 recommended)
---
```

### Step 2: Create or Upload Cover Image

- Recommended size: 1000x420 pixels for dev.to (displays well in feeds)
- Alternative: 1200x630 pixels (works across dev.to, LinkedIn, Twitter cards)
- Store locally at `business/content/images/blog-XX-cover.png`
- Upload to a permanent URL (GitHub raw, Imgur, or dev.to's own upload via the editor)
- Add the URL to the `cover_image` field in front matter

### Step 3: Paste into dev.to Editor

1. Go to https://dev.to/new
2. Paste the entire contents of the `blog-XX-devto.md` file (including the front matter)
3. dev.to's editor will parse the front matter automatically
4. Switch to "Preview" mode and verify:
   - Code blocks render correctly (check language tags: `kql`, `http`, `json`, `bash`)
   - The GitHub embed renders: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
   - The series link appears at the top of the post
   - Images and diagrams display properly
   - Heading hierarchy is correct (H2 for sections, H3 for subsections)

### Step 4: Review SEO Elements

Before publishing, verify:
- [ ] Title is under 70 characters (Google truncates at ~60, dev.to shows full)
- [ ] Description is 150-160 characters and includes the primary keyword
- [ ] Primary keyword appears in the first 100 words
- [ ] At least one H2 heading contains the primary keyword
- [ ] GitHub repo link is present (either inline or via embed tag)
- [ ] Internal links to previous posts in the series are included

### Step 5: Publish

1. Change `published: false` to `published: true` in the front matter
2. Click "Publish" (or "Save changes" if editing after initial save)
3. Copy the published URL immediately -- you need it for cross-promotion
4. Verify the post appears in the "Fabric Observability Deep Dives" series

### Step 6: Post First Comment

Within 5 minutes of publishing, post a first comment that:
- Provides personal context ("here's why I wrote this")
- Includes a specific question to encourage discussion
- Does NOT repeat the CTA from the post body
- Feels conversational, not promotional

This boosts the post in dev.to's algorithm (posts with early engagement get higher visibility in the feed).

---

## Optimal Posting Times

### dev.to

Best times (all times US Eastern / ET):

| Day | Time | Why |
|-----|------|-----|
| **Tuesday** | **8:00-9:00 AM ET** | Peak dev.to readership; catches US morning + EU afternoon |
| Wednesday | 8:00-9:00 AM ET | Second-best weekday |
| Thursday | 8:00-9:00 AM ET | Good engagement, slightly lower than Tue/Wed |
| Monday | 10:00 AM ET | Avoid early Monday (people clearing inboxes) |

**Avoid**: Friday afternoon, Saturday, Sunday (significant traffic drop on dev.to)

**Our standard**: Publish Tuesday at 8:00 AM ET. This gives the post the full Tuesday-Wednesday engagement window, which is when dev.to's feed algorithm gives the most visibility.

### LinkedIn

| Day | Time | Why |
|-----|------|-----|
| **Tuesday** | **8:00-9:00 AM ET** | Highest B2B engagement window |
| **Thursday** | **8:00-9:00 AM ET** | Second peak for professional content |
| Wednesday | 10:00-11:00 AM ET | Solid mid-week engagement |

**Our standard**: Post 2x per week on Tuesday and Thursday mornings.

### Reddit

| Subreddit | Best Time | Notes |
|-----------|-----------|-------|
| r/MicrosoftFabric | Tue/Wed 9:00-10:00 AM ET | Moderate traffic subreddit; timing matters less than quality |
| r/dataengineering | Mon/Tue 8:00-9:00 AM ET | Large subreddit; early-week posts get more visibility |
| r/PowerBI | Tue/Wed 8:00-10:00 AM ET | Active during US business hours |
| r/BusinessIntelligence | Tue/Wed 9:00-11:00 AM ET | Smaller sub, less time-sensitive |

**Important**: Do not post to dev.to and Reddit at the same time. Stagger by at least 2 hours. Reddit posts should feel like standalone contributions, not cross-promotion of a blog post.

---

## Tag Strategy

dev.to allows a maximum of 4 tags per post. Tags determine which feeds your post appears in and significantly impact discoverability.

### Tag Priority Matrix

| Blog Post | Tag 1 (Primary) | Tag 2 | Tag 3 | Tag 4 |
|-----------|-----------------|-------|-------|-------|
| Blog 01: State of Observability | microsoft-fabric | observability | data-engineering | monitoring |
| Blog 02: Cross-Item Correlation | microsoft-fabric | observability | data-engineering | monitoring |
| Blog 03: Fabric SLO Guide | microsoft-fabric | observability | data-engineering | kql |
| Blog 04: Silent Failures | microsoft-fabric | data-engineering | observability | data-quality |
| Blog 05: CU Waste Score | microsoft-fabric | data-engineering | finops | performance |
| Blog 06: Extensibility Toolkit | microsoft-fabric | typescript | opensource | tutorial |
| Blog 07: Pipeline Alerts | microsoft-fabric | automation | data-engineering | monitoring |
| Blog 08: CU Optimization | microsoft-fabric | performance | data-engineering | optimization |
| Blog 09: Product Launch | microsoft-fabric | observability | opensource | announcement |

### Tag Selection Rules

1. **Always include `microsoft-fabric`** -- this is our primary audience filter
2. **Always include one of**: `observability`, `data-engineering`, `monitoring` -- these are high-traffic tags in our niche
3. **Third tag should match the post's specific angle**: `kql` for query-heavy posts, `data-quality` for correctness posts, `finops` for cost posts, `typescript` for code-heavy posts
4. **Fourth tag is situational**: `opensource` for launch announcements, `tutorial` for how-to guides, `performance` for optimization content

### Tag Follower Counts (Approximate, March 2026)

| Tag | Followers | Notes |
|-----|-----------|-------|
| data-engineering | ~15,000 | High-value audience, moderate competition |
| observability | ~8,000 | Growing tag, lower competition |
| monitoring | ~12,000 | Broad; our content is niche within this |
| microsoft-fabric | ~2,000 | Small but extremely targeted |
| kql | ~500 | Very small, very specific |
| data-quality | ~4,000 | Growing interest area |
| finops | ~3,000 | Emerging topic |
| typescript | ~100,000+ | Huge but not our primary audience |
| opensource | ~50,000+ | Large; useful for launch posts |
| tutorial | ~30,000+ | Good for how-to posts |

The strategy is: `microsoft-fabric` for targeting + 2-3 higher-traffic tags for reach.

---

## Cross-Posting to Hashnode and Medium

### The Order of Operations

**Always publish on dev.to first.** dev.to is our primary platform because:
1. Built-in developer audience that matches our target persona
2. Series feature links posts together
3. Strong SEO (dev.to pages rank well in Google)
4. Free, no paywall friction for readers
5. GitHub embed support

After publishing on dev.to, cross-post to Hashnode and Medium with a 48-hour delay. This gives dev.to the initial engagement window and avoids splitting traffic.

### Hashnode Cross-Post

1. Go to https://hashnode.com and create a post
2. Copy the blog content (use the canonical version from `blog-XX-[topic].md`, not the dev.to version)
3. Adjust formatting:
   - Hashnode uses standard markdown; remove any dev.to-specific liquid tags (`{% embed %}`, `{% github %}`)
   - Replace `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}` with a standard markdown link
   - Cover images work the same way (upload or URL)
4. **Set the canonical URL** to your dev.to post URL (critical -- see Canonical URL section below)
5. Add tags: Hashnode has a different tag ecosystem. Use: `Microsoft Fabric`, `Data Engineering`, `Observability`, `Open Source`
6. Publish

### Medium Cross-Post

1. Go to https://medium.com and create a new story
2. Copy the content from the canonical version
3. Adjust formatting:
   - Medium does not support code syntax highlighting as well as dev.to. Consider using GitHub Gists for long code blocks.
   - Replace KQL code blocks with Gist embeds for better readability
   - Medium does not support `{% embed %}` tags. Use inline links instead.
   - Medium has limited heading levels. Keep to H2 and H3.
4. **Set the canonical URL** using Medium's import tool:
   - Go to https://medium.com/p/import
   - Paste the dev.to URL
   - Medium will import the post and automatically set the canonical URL
   - Review and edit the imported version for formatting issues
5. Submit to relevant publications:
   - **Towards Data Science** (if data-focused)
   - **Better Programming** (if code-heavy)
   - **Level Up Coding** (general developer audience)
   - Submitting to a publication gets significantly more reach than publishing on your own profile
6. Add tags: Medium allows up to 5. Use: `Microsoft Fabric`, `Data Engineering`, `Data Observability`, `Data Quality`, `Open Source`

### Cross-Post Timeline

| Time | Action |
|------|--------|
| Day 0, 8:00 AM ET | Publish on dev.to |
| Day 0, 8:05 AM | Post first comment on dev.to |
| Day 0, 8:15 AM | Publish supporting LinkedIn post |
| Day 0, 10:00 AM | Post to Reddit (genuine discussion, link to dev.to only if natural) |
| Day 2, 8:00 AM | Cross-post to Hashnode (with canonical URL pointing to dev.to) |
| Day 3-5 | Cross-post to Medium (with canonical URL pointing to dev.to) |
| Day 5-7 | Submit Medium version to a relevant publication |

---

## Canonical URL Strategy

### What Is a Canonical URL?

A canonical URL tells search engines "this is the original version of this content." When the same content appears on dev.to, Hashnode, and Medium, you want Google to know which version is the "real" one and give it the SEO credit.

### Our Rule

**dev.to is always the canonical source.** Every cross-posted version on Hashnode and Medium must set its canonical URL to the dev.to post.

### How to Set It

**dev.to**: Leave the `canonical_url` field empty in the front matter. dev.to will use its own URL as canonical by default. Only set `canonical_url` if you published elsewhere first (we do not do this).

```yaml
# dev.to front matter -- canonical_url left empty (dev.to is the source)
canonical_url:
```

**Hashnode**: When creating a post, there is a "Canonical URL" field in the post settings. Enter the full dev.to URL:

```
https://dev.to/yourusername/building-your-first-fabric-slo-xxxxx
```

**Medium**: If using the import tool (recommended), it sets the canonical URL automatically from the source. If creating manually, go to Story Settings and enter the canonical URL.

### Why This Matters

Without canonical URLs, Google may:
- Index the Medium or Hashnode version instead of the dev.to version
- Split link equity across multiple URLs (diluting SEO value)
- Potentially flag the content as duplicate (reducing ranking for all versions)

With canonical URLs properly set, all SEO value consolidates on the dev.to version, which is the one we want ranking.

### Exception: LinkedIn Articles

LinkedIn articles cannot set canonical URLs. This is fine -- LinkedIn articles are not typically indexed by Google in a way that competes with blog platforms. Publish the full article on LinkedIn without worrying about canonical conflicts. Include a link to the dev.to version at the bottom: "Read the full technical version with code examples: [dev.to link]"

---

## Post-Publish Checklist

Run through this checklist for every blog publication.

### Day 0 (Publication Day)

- [ ] dev.to post published with `published: true`
- [ ] Code blocks render correctly (verify kql, http, json, bash highlighting)
- [ ] GitHub embed renders (`{% embed %}` tag)
- [ ] Series link appears ("Fabric Observability Deep Dives")
- [ ] Cover image displays
- [ ] First comment posted within 5 minutes
- [ ] LinkedIn post published (reference the blog, link to dev.to)
- [ ] LinkedIn first comment posted within 2 minutes
- [ ] Reddit posts scheduled/published (stagger 2+ hours after dev.to)
- [ ] GitHub Discussion created in tenfingerseddy/FabricWorkloads (for major posts)
- [ ] All links tested and working

### Day 1

- [ ] Respond to every dev.to comment within 4 hours
- [ ] Respond to every LinkedIn comment within 4 hours
- [ ] Engage with every Reddit reply substantively
- [ ] Share any interesting comments or discussions on LinkedIn stories

### Day 2-3

- [ ] Cross-post to Hashnode (with canonical URL)
- [ ] Cross-post to Medium (with canonical URL, via import tool)
- [ ] Submit Medium version to a relevant publication

### Day 5-7

- [ ] Record engagement metrics in `business/content/metrics/blog-XX-metrics.md`
  - dev.to: views, reactions, comments, bookmarks
  - LinkedIn: impressions, reactions, comments, shares
  - Reddit: upvotes, comment count
  - GitHub: any new stars or issues that reference the post
- [ ] Extract 2-3 standalone quotes for future LinkedIn text posts
- [ ] Update the landing page to link to the new blog post
- [ ] Add blog post to the GitHub README's Resources section
- [ ] Identify any follow-up content ideas from comments/questions

---

## Engagement Best Practices

### dev.to

- **Reply to every comment**, even if it is just "thanks for reading." dev.to's algorithm favors posts with active discussion.
- **Follow commenters** who ask thoughtful questions -- they are potential design partners.
- **React to other posts** in the `microsoft-fabric` and `observability` tags. Being an active community member increases your posts' visibility.
- **Use the series feature** consistently. Readers who find one post in the series will explore others.
- **Pin a comment** with a discussion question to encourage engagement (dev.to does not have native pinning, but posting the first comment accomplishes the same effect).

### Hashnode

- **Join the data engineering newsletter community** on Hashnode. Posts published through communities get additional distribution.
- **Add a personal blog domain** if possible -- Hashnode supports custom domains, which can build your personal brand alongside the product.

### Medium

- **Getting into publications is critical.** A post published on your personal Medium profile gets minimal reach. The same post in "Towards Data Science" (500K+ followers) gets orders of magnitude more exposure.
- **Follow Medium's formatting conventions**: shorter paragraphs, pull quotes, section breaks. Medium readers expect a different cadence than dev.to readers.
- **Do not include too many links.** Medium's algorithm deprioritizes posts with excessive external links. Keep it to 2-3 outbound links maximum.

### General

- Never ask for upvotes, claps, or reactions. Produce content that earns them.
- When responding to comments, add value. Answer questions with depth. If someone points out an error, acknowledge it gracefully and fix the post.
- Track which posts and platforms generate the most engagement. Double down on what works. This data goes into the weekly metrics review.

---

## Version History

| Date | Change |
|------|--------|
| 2026-03-09 | Initial publishing guide created |
