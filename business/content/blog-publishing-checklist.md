# Blog Publishing Readiness Checklist

> Audit of all existing blog content as of 2026-03-10.
> Reviews dev.to versions for frontmatter, structure, technical accuracy, CTAs, and publishing readiness.

---

## Blog Inventory Summary

| Blog | Title | dev.to File | Canonical File | Status |
|------|-------|-------------|----------------|--------|
| 01 | The State of Fabric Observability in 2026 | Embedded in `blog-01-publication-ready.md` | Embedded in same file | NEEDS EDITS |
| 02 | Cross-Item Correlation in Microsoft Fabric | **DOES NOT EXIST** | **DOES NOT EXIST** | NOT WRITTEN |
| 03 | Building Your First Fabric SLO | `blog-03-devto.md` | `blog-03-fabric-slo-guide.md` | NEEDS EDITS |
| 04 | Why Your Fabric Pipeline Succeeded But Your Data Is Wrong | `blog-04-devto.md` | `blog-04-silent-failures.md` | NEEDS EDITS |
| 05 | CU Waste Score | **DOES NOT EXIST** | **DOES NOT EXIST** | NOT WRITTEN |
| 06 | Building Native Fabric Workloads With the Extensibility Toolkit | `blog-06-devto.md` | `blog-06-extensibility-toolkit.md` | NEEDS EDITS |
| 07 | Pipeline Alerts | **DOES NOT EXIST** | **DOES NOT EXIST** | NOT WRITTEN |
| 08 | CU Optimization | **DOES NOT EXIST** | **DOES NOT EXIST** | NOT WRITTEN |

**Written**: 4 blogs (01, 03, 04, 06)
**Missing**: 4 blogs (02, 05, 07, 08) -- referenced in SEO keywords and tag strategy but never created

---

## Detailed Review: Blog 01

**File**: `business/content/blog-01-publication-ready.md`
**Title**: "The State of Fabric Observability in 2026: What's Missing and Why It Matters"
**Word count**: ~2,400 (dev.to version)

### Frontmatter Assessment

| Field | Present | Value | Issue |
|-------|---------|-------|-------|
| title | Yes | "The State of Fabric Observability in 2026: What's Missing and Why It Matters" | 76 characters, slightly over 70-char SEO ideal. Acceptable tradeoff. |
| published | Yes | false | Correct for pre-publish state. |
| description | Yes | 199 characters | OVER LIMIT. Should be 150-160 characters. Needs trimming. |
| tags | Yes | microsoft-fabric, observability, data-engineering, monitoring | Correct. 4 tags, matches tag strategy. |
| series | Yes | "Fabric Observability Deep Dives" | Correct. |
| cover_image | MISSING | -- | Must add a `cover_image:` field (even if placeholder). |
| canonical_url | MISSING | -- | Should add empty `canonical_url:` field per publishing guide. |

### Structure and Formatting

- [x] Proper markdown heading hierarchy (H2 for sections, H3 for subsections)
- [x] Strong narrative opening (2 AM incident story)
- [x] Clear section progression: problem statement, gap analysis, solution vision, CTA
- [x] Code examples present: 1 KQL query, 2 HTTP API calls
- [x] Code blocks have correct language tags (`kql`, `http`)
- [x] Well-formatted tables and lists

### Technical Accuracy

- [x] Monitoring hub 100-activity limit: CORRECT
- [x] 30-day retention limit: CORRECT
- [x] Search only queries loaded data: CORRECT
- [x] No cross-item correlation: CORRECT
- [x] Status ambiguity ("Stopped" notebooks): CORRECT
- [x] No SLO/SLI framework: CORRECT
- [ ] ISSUE: Claims "110+ job events ingested, 36 SLO snapshots, 7 correlations, 27 alerts" -- actual data per project memory is 137 events, 88 SLO snapshots, 52 alerts, 8 correlations. Numbers should be updated to current figures.

### CTA Assessment

- [x] GitHub repo link present in body: `https://github.com/tenfingerseddy/FabricWorkloads`
- [x] GitHub embed tag present: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
- [x] Design partner ask in closing section
- [x] Comment prompt ("Tell us which of these gaps hurts the most")
- [x] Footer with GitHub link and project description

### Structural Issue

The dev.to version is embedded inside a markdown code block within `blog-01-publication-ready.md` (lines 115-305). This means it cannot be directly pasted into dev.to without extraction. The publication-ready file is a wrapper containing the SEO audit, checklist, comment templates, and the actual post content. This is functional but should be noted as an extra step.

### Required Edits Before Publishing

1. Extract the dev.to version from the code block into a standalone `blog-01-devto.md` file for easier publishing workflow
2. Trim the `description` from 199 to 150-160 characters. Suggested: "Microsoft Fabric's monitoring tools have hard limits: 30-day retention, no cross-item correlation, no SLO framework. Here's what's missing." (141 chars -- add a few more words)
3. Add `cover_image:` field to frontmatter (placeholder URL or empty)
4. Add `canonical_url:` field to frontmatter (empty)
5. Update live data numbers from "110+ events, 36 snapshots, 7 correlations, 27 alerts" to current figures (137 events, 88 snapshots, 8 correlations, 52 alerts)

---

## Detailed Review: Blog 03

**File**: `business/content/blog-03-devto.md`
**Title**: "Building Your First Fabric SLO: A Practical Guide to Success Rate, Duration, and Freshness Tracking"
**Word count**: ~3,200

### Frontmatter Assessment

| Field | Present | Value | Issue |
|-------|---------|-------|-------|
| title | Yes | "Building Your First Fabric SLO: A Practical Guide to Success Rate, Duration, and Freshness Tracking" | 100 characters. OVER the 70-char SEO limit. Needs shortening. |
| published | Yes | false | Correct. |
| description | Yes | 196 characters | OVER LIMIT. Must trim to 150-160 characters. |
| tags | Yes | microsoft-fabric, observability, data-engineering, kql | Correct. Matches tag strategy for Blog 03. |
| series | Yes | "Fabric Observability Deep Dives" | Correct. |
| cover_image | MISSING | -- | Must add field. |
| canonical_url | Yes | (empty) | Correct. |

### Structure and Formatting

- [x] Proper heading hierarchy
- [x] Logical progression: What is an SLO -> Prerequisites -> Success Rate -> Duration -> Freshness -> Combined -> Automation -> Mistakes
- [x] Extensive code examples: 7 KQL queries, 1 bash command, 1 KQL schema definition
- [x] All code blocks have correct language tags (`kql`, `bash`)
- [x] Well-formatted tables throughout
- [x] Practical, tutorial-style writing appropriate for the topic

### Technical Accuracy

- [x] SLO/SLI/error budget definitions: CORRECT per SRE practices
- [x] Fabric status values (Completed, Failed, Cancelled): CORRECT per Fabric API
- [x] KQL syntax across all 7 queries: CORRECT (valid KQL, uses proper functions)
- [x] FabricEvents schema: Matches the actual Eventhouse schema (verified column names and types)
- [ ] ISSUE: Claims "30+ queries" in KQL query pack. Actual count per project memory is "45+ KQL queries" (in `kql/community-query-pack.kql`). Should update to say "45+" for consistency.
- [x] npm install command references correct package name `@kane-ai/observability-workbench`

### CTA Assessment

- [x] GitHub repo linked in opening paragraph
- [x] GitHub repo linked in README reference
- [x] GitHub embed tag present: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
- [x] Closing CTA: "The project is open source, and we would love your feedback"
- [x] Series navigation footer with next post teaser

### Required Edits Before Publishing

1. Shorten title to under 70 characters. Suggested: "Building Your First Fabric SLO: Success Rate, Duration, and Freshness" (71 chars -- close enough) or "Your First Fabric SLO: A Practical Guide to Reliability Tracking" (65 chars)
2. Trim description to 150-160 characters. Suggested: "SLOs are the foundation of reliable data ops. Here's how to define and track success rate, duration, and freshness SLOs for Microsoft Fabric with KQL." (151 chars)
3. Add `cover_image:` field to frontmatter
4. Update "30+ queries" reference to "45+ queries" to match actual query pack count
5. Add internal link to Blog 01 (series convention: each post links to predecessors)

---

## Detailed Review: Blog 04

**File**: `business/content/blog-04-devto.md`
**Title**: "Why Your Fabric Pipeline Succeeded But Your Data Is Wrong"
**Word count**: ~2,800

### Frontmatter Assessment

| Field | Present | Value | Issue |
|-------|---------|-------|-------|
| title | Yes | "Why Your Fabric Pipeline Succeeded But Your Data Is Wrong" | 58 characters. GOOD -- under 70-char limit. Strong, curiosity-driven title. |
| published | Yes | false | Correct. |
| description | Yes | 195 characters | OVER LIMIT. Must trim to 150-160 characters. |
| tags | Yes | microsoft-fabric, data-engineering, observability, data-quality | Correct. Matches tag strategy for Blog 04. |
| series | Yes | "Fabric Observability Deep Dives" | Correct. |
| cover_image | MISSING | -- | Must add field. |
| canonical_url | Yes | (empty) | Correct. |

### Structure and Formatting

- [x] Strong narrative opening ("The Pipeline That Lied" -- Tuesday incident story)
- [x] Proper heading hierarchy
- [x] Clear taxonomy of silent failure modes (5 numbered scenarios)
- [x] Code examples: 3 KQL queries + 2 text-format correlation diagrams
- [x] All code blocks have correct language tags (`kql`)
- [x] Well-structured sections with logical flow from problem to detection to solution

### Technical Accuracy

- [x] Silent failure scenarios (partial data, schema drift, stale upstream, stopped ambiguity, empty results): All technically accurate and well-documented
- [x] Monitoring hub job-instance-level limitation: CORRECT
- [x] 24.5% alert rate finding from live environment: CONSISTENT with Blog 01 and project data
- [x] KQL queries are syntactically correct and use proper FabricEvents schema
- [x] Cross-item correlation chain diagrams: Realistic and accurate

### CTA Assessment

- [x] GitHub repo linked in "What We Are Building" section
- [x] GitHub embed tag present: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
- [x] Comment prompt: "If you have experienced the 'successful pipeline, wrong data' problem... we want to hear about it"
- [x] Series navigation footer with previous post reference
- [ ] ISSUE: Series footer links to Blog 03 with a relative URL (`/blog/building-your-first-fabric-slo`) that will not resolve on dev.to. Must use the actual dev.to post URL or series link once Blog 03 is published.

### Required Edits Before Publishing

1. Trim description to 150-160 characters. Suggested: "Your monitoring hub shows green. Every pipeline 'Completed.' But the revenue report has yesterday's numbers. Here's how silent failures work in Fabric." (153 chars)
2. Add `cover_image:` field to frontmatter
3. Fix series footer link: Replace `/blog/building-your-first-fabric-slo` with actual dev.to URL (update after Blog 03 is published) or use the series link format: `https://dev.to/series/fabric-observability-deep-dives`
4. Add internal link to Blog 01 in the body text (currently only references Blog 03 in footer)

---

## Detailed Review: Blog 06

**File**: `business/content/blog-06-devto.md`
**Title**: "Building Native Fabric Workloads With the Extensibility Toolkit"
**Word count**: ~2,100

### Frontmatter Assessment

| Field | Present | Value | Issue |
|-------|---------|-------|-------|
| title | Yes | "Building Native Fabric Workloads With the Extensibility Toolkit" | 64 characters. GOOD -- under 70-char limit. |
| published | Yes | false | Correct. |
| description | Yes | 198 characters | OVER LIMIT. Must trim to 150-160 characters. |
| tags | Yes | microsoft-fabric, data-engineering, typescript, devops | ISSUE: Does not match tag strategy. Strategy says tags should be `microsoft-fabric, typescript, opensource, tutorial`. The `devops` tag is lower value for this content. |
| series | Yes | "Fabric Observability Deep Dives" | Correct. |
| cover_image | Yes | (empty) | Good -- field present, needs URL. |
| canonical_url | Yes | (empty) | Correct. |

### Structure and Formatting

- [x] Proper heading hierarchy
- [x] Strong opening hook (September 2025 "quiet" launch)
- [x] Clear WDK vs Extensibility Toolkit comparison table
- [x] Practical "Getting Started" section with numbered steps
- [x] Forward-looking "What Comes Next" section with ecosystem thesis
- [ ] ISSUE: No code examples. This is the only blog post without a code block. For a post about a development toolkit, at least one code snippet (manifest example, SDK initialization, or basic item type scaffold) would strengthen the piece significantly.

### Technical Accuracy

- [x] Extensibility Toolkit description (iFrame, manifest-driven, Entra ID auth, OneLake storage): CORRECT per Microsoft documentation
- [x] WDK comparison (mandatory .NET backend vs optional): CORRECT
- [x] Workload Hub description: CORRECT
- [x] OBO token flow: CORRECT
- [x] Starter Kit and DevGateway references: CORRECT
- [x] "September 2025" launch timing: CORRECT per project research
- [ ] ISSUE: Links to previous posts in the series use placeholder URLs (`https://dev.to/observability-workbench/...`) that may not match actual published URLs. These need to be updated with real URLs as posts go live.
- [ ] ISSUE: References "CU waste scores" blog with a link, but Blog 05 (CU Waste Score) does not exist yet.

### CTA Assessment

- [x] GitHub repo linked: `https://github.com/tenfingerseddy/FabricWorkloads`
- [x] GitHub embed tag present: `{% embed https://github.com/tenfingerseddy/FabricWorkloads %}`
- [x] Microsoft Extensibility Toolkit repo linked
- [x] Microsoft docs linked
- [x] Comment prompt: "What are you building? What problems are you solving?"
- [x] Footer with GitHub link and project description

### Required Edits Before Publishing

1. Trim description to 150-160 characters. Suggested: "The Extensibility Toolkit replaces the WDK for building Fabric workloads. No mandatory .NET backend, TypeScript-first, minutes to first render." (145 chars)
2. Update tags from `microsoft-fabric, data-engineering, typescript, devops` to `microsoft-fabric, typescript, opensource, tutorial` per tag strategy
3. Add at least one code example (manifest snippet, SDK initialization, or basic item type definition)
4. Remove or generalize the link to Blog 05 (CU Waste Score) since that post does not exist. Replace with a generic reference to "cost analysis" or remove the link.
5. Update internal series links to use actual published URLs (or series link) as posts go live
6. Populate `cover_image` field with hosted image URL before publishing

---

## Cross-Cutting Issues (All Posts)

### Frontmatter

Every dev.to post has a `description` field that exceeds the 150-160 character target. All four need trimming.

| Blog | Current Description Length | Target | Action |
|------|--------------------------|--------|--------|
| 01 | 199 chars | 150-160 | Trim |
| 03 | 196 chars | 150-160 | Trim |
| 04 | 195 chars | 150-160 | Trim |
| 06 | 198 chars | 150-160 | Trim |

### Cover Images

No blog post has a cover image created or hosted. All four have either a missing or empty `cover_image` field. Cover images are required for optimal dev.to feed display and social sharing cards.

Action: Create cover images (1000x420 pixels) for all four posts before publishing.

### Internal Links

The series posts should cross-reference each other with actual dev.to URLs. Since no posts are published yet, all internal links use placeholder or relative URLs that will break on dev.to. Strategy: publish in order and update each post's internal links to point to the actual published URLs of prior posts.

### Technical Claims Verification

| Claim | Used In | Verified Value | Matches? |
|-------|---------|----------------|----------|
| 187 tests | -- | 187 (per project memory) | Not referenced in any blog. No action needed. |
| 45+ KQL queries | Blog 03 says "30+" | 45+ (per repo) | MISMATCH. Blog 03 says "30+", should say "45+" |
| 6 dashboard panels | -- | 6 (per project memory) | Not referenced in blogs. No action needed. |
| 3 custom agents | -- | 3 (per project memory) | Not referenced in blogs. No action needed. |
| 137 events | Blog 01 says "110+" | 137 | OUTDATED. Update to current numbers. |
| 88 SLO snapshots | Blog 01 says "36" | 88 | OUTDATED. Update to current numbers. |
| 52 alerts | Blog 01 says "27" | 52 | OUTDATED. Update to current numbers. |
| 8 correlations | Blog 01 says "7" | 8 | OUTDATED. Update to current numbers. |

---

## Suggested Publishing Order and Cadence

### Recommended Order

Publish in this order to build a logical narrative arc, where each post builds on the previous:

| Week | Day | Blog | Rationale |
|------|-----|------|-----------|
| Week 1 | Tuesday | Blog 01: State of Observability | Foundation post. Defines the problem space. Must come first. |
| Week 1 | Thursday | -- | Cross-promote Blog 01 on Hashnode/Medium per publishing guide |
| Week 2 | Tuesday | Blog 03: Building Your First Fabric SLO | Natural follow-up. Moves from "here's the problem" to "here's how to measure it." Links back to Blog 01. |
| Week 2 | Thursday | -- | Cross-promote Blog 03 |
| Week 3 | Tuesday | Blog 04: Silent Failures | Deepens the narrative. "Even when things look good, they can be wrong." Links back to Blog 01 and Blog 03. |
| Week 3 | Thursday | -- | Cross-promote Blog 04 |
| Week 4 | Tuesday | Blog 06: Extensibility Toolkit | Platform/architecture post. Explains how the solution is built. Links to all previous posts. |
| Week 4 | Thursday | -- | Cross-promote Blog 06 |

### Why Not 2 Per Week

The original request asks about a 2-per-week cadence. With only 4 existing posts, publishing 2 per week would exhaust all content in 2 weeks with no buffer for cross-promotion, engagement monitoring, or content gap creation (Blogs 02, 05, 07, 08 do not exist yet). The publishing guide's own recommendation is 1 post per week on Tuesdays.

However, if a 2-per-week cadence is required, here is the compressed schedule:

| Week | Tuesday | Thursday |
|------|---------|----------|
| Week 1 | Blog 01: State of Observability | Blog 03: Building Your First Fabric SLO |
| Week 2 | Blog 04: Silent Failures | Blog 06: Extensibility Toolkit |

This sacrifices cross-posting windows (Hashnode/Medium need 48-hour delays) and reduces per-post engagement time. Not recommended unless there is a time-sensitive launch event driving urgency.

### Note on Missing Posts

Blog 02 (Cross-Item Correlation) and Blog 05 (CU Waste Score) are referenced in the tag strategy, SEO keywords, and internal linking plan but have never been written. Blog 06's body text links to Blog 05 by name. These gaps should be addressed:

- **Blog 02** should be written and inserted between Blog 01 and Blog 03 in the series (it is the "correlation" bridge between "the problem" and "the SLO solution")
- **Blog 05** should be written and inserted between Blog 04 and Blog 06 (it is the "cost impact" bridge before the "how we built it" post)
- **Blogs 07 and 08** are lower priority and can be created after the initial 4 are published

---

## Tag Strategy

All posts use `microsoft-fabric` as the primary tag. The rotation follows the tag priority matrix from the publishing guide.

| Blog | Tag 1 | Tag 2 | Tag 3 | Tag 4 | Status |
|------|-------|-------|-------|-------|--------|
| 01 | microsoft-fabric | observability | data-engineering | monitoring | CORRECT |
| 03 | microsoft-fabric | observability | data-engineering | kql | CORRECT |
| 04 | microsoft-fabric | data-engineering | observability | data-quality | CORRECT |
| 06 | microsoft-fabric | data-engineering | typescript | devops | NEEDS CHANGE: `devops` should be `opensource` or `tutorial` per strategy |

---

## Pre-Publishing Task List

### Blockers (Must Complete Before Any Post Goes Live)

- [ ] Create cover images for all 4 posts (1000x420 pixels)
- [ ] Host cover images at a public URL (GitHub raw, Imgur, or dev.to upload)
- [ ] Create a standalone `blog-01-devto.md` file by extracting the dev.to content from `blog-01-publication-ready.md`

### Per-Post Edits

#### Blog 01

- [ ] Extract dev.to version into standalone `blog-01-devto.md`
- [ ] Trim description to 150-160 characters
- [ ] Add `cover_image:` and `canonical_url:` fields to frontmatter
- [ ] Update milestone numbers to current values (137 events, 88 snapshots, 8 correlations, 52 alerts)
- [ ] Update first-comment templates in `blog-01-publication-ready.md` with current numbers

#### Blog 03

- [ ] Shorten title to under 70 characters
- [ ] Trim description to 150-160 characters
- [ ] Add `cover_image:` field to frontmatter
- [ ] Change "30+ queries" to "45+ queries" in query pack reference
- [ ] Add internal link to Blog 01 in the body text

#### Blog 04

- [ ] Trim description to 150-160 characters
- [ ] Add `cover_image:` field to frontmatter
- [ ] Fix series footer: replace relative URL with actual dev.to URL or series link
- [ ] Add internal link to Blog 01 in the body text

#### Blog 06

- [ ] Trim description to 150-160 characters
- [ ] Change tags from `microsoft-fabric, data-engineering, typescript, devops` to `microsoft-fabric, typescript, opensource, tutorial`
- [ ] Add at least one code example (manifest snippet or SDK initialization)
- [ ] Remove or generalize link to Blog 05 (CU Waste Score) since post does not exist
- [ ] Update internal series links with actual published URLs as posts go live
- [ ] Populate `cover_image` field with hosted URL

### Post-Publishing (After Each Post)

- [ ] Post first comment on dev.to within 5 minutes (templates in `blog-01-publication-ready.md` for Blog 01; create templates for Blogs 03, 04, 06)
- [ ] Publish LinkedIn article within 15 minutes
- [ ] Create GitHub Discussion within 1 hour
- [ ] Cross-promote on Reddit at 10:00 AM ET (stagger 2+ hours after dev.to)
- [ ] Cross-post to Hashnode at 48 hours (with canonical URL)
- [ ] Cross-post to Medium at 72-120 hours (with canonical URL)
- [ ] Record engagement metrics at 48 hours in `business/content/metrics/`

---

## Content Gap Priority

These posts need to be written to complete the series as planned in the growth playbook:

| Priority | Blog | Topic | Why It Matters |
|----------|------|-------|----------------|
| HIGH | 02 | Cross-Item Correlation | Bridge between Blog 01 (problem) and Blog 03 (SLO solution). Referenced in internal linking strategy. |
| HIGH | 05 | CU Waste Score | Blog 06 directly links to it. Referenced in tag strategy and SEO keywords. "fabric CU waste" has zero SERP competition. |
| MEDIUM | 07 | Pipeline Alert Configuration | Practical how-to content for the product. Good tutorial-format post. |
| MEDIUM | 08 | CU Optimization Patterns | FinOps angle broadens audience. Complements Blog 05. |

---

## Version History

| Date | Change |
|------|--------|
| 2026-03-10 | Complete publishing readiness audit of all 4 existing blog posts |
