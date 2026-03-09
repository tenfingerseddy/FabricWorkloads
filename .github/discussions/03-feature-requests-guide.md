# How to Request Features

**Category: Announcements (pin this discussion)**

---

Your feature requests directly shape the Observability Workbench roadmap. Here is how to make sure your idea gets seen, discussed, and prioritized.

## The feature request process

### Step 1: Check if it already exists

Before opening a new request, search these places:

- **[GitHub Issues](https://github.com/tenfingerseddy/FabricWorkloads/issues?q=label%3Aenhancement)** -- look at issues labeled `enhancement`
- **[Ideas Discussions](https://github.com/tenfingerseddy/FabricWorkloads/discussions/categories/ideas)** -- search the Ideas category
- **[Product Roadmap](https://github.com/tenfingerseddy/FabricWorkloads)** -- check the roadmap in the README

If a similar request exists, **add a thumbs-up reaction** instead of opening a duplicate. Reaction count is the primary signal we use for prioritization.

### Step 2: Start a discussion (for early ideas)

If your idea is still forming and you want community input:

1. Go to **Discussions > Ideas**
2. Describe the problem you are facing (not just the solution you want)
3. Include context about your Fabric environment and workflow
4. Invite discussion: "How are others handling this?"

Community discussion often improves the original idea significantly.

### Step 3: Open a formal feature request (for well-defined features)

When you have a clear feature in mind:

1. Go to **Issues > New Issue > Feature Request**
2. Fill out the structured form
3. Be specific about:
   - **The problem**: What pain point does this solve?
   - **Your proposed solution**: How should it work?
   - **Fabric context**: Which item types, APIs, or workflows are involved?
   - **Priority**: How important is this to your daily work?

### Step 4: Track progress

Once a feature request is accepted:
- It gets labeled with a milestone (e.g., `v0.2`, `v0.3`, `backlog`)
- Progress updates are posted as comments on the issue
- When shipped, the issue is closed and referenced in release notes

## How we prioritize

Features are prioritized based on:

1. **Community demand** -- thumbs-up reactions on issues and discussions
2. **Pain point severity** -- features addressing the top Fabric monitoring pain points get priority
3. **Alignment with roadmap** -- features that fit the product vision
4. **Implementation complexity** -- quick wins get shipped between major features
5. **Design partner feedback** -- input from teams actively using the tool in production

## Known pain points we are targeting

These are the core Fabric monitoring limitations that drive our roadmap:

| Pain Point | Status |
|-----------|--------|
| Monitoring hub 100-activity / 30-day retention limit | Addressed in v0.1 |
| No cross-item correlation | Addressed in v0.1 |
| No SLO / SLA tracking framework | Addressed in v0.1 |
| No proactive alerting | Addressed in v0.1 |
| Workspace monitoring 30-day retention limit | Addressed in v0.1 |
| Status inconsistencies in monitoring hub | Planned |
| Keyword search limitations | Planned |
| Capacity / CU cost visibility | Planned (FinOps Guardrails product) |
| Schema drift detection | Planned (Schema Drift Gate product) |
| Deployment orchestration | Planned (Release Orchestrator product) |

## Feature request tips

- **Describe the problem, not just the solution.** Understanding the "why" helps us design the right approach.
- **Include real examples.** "When pipeline X fails at 3 AM, I need to..." is much more actionable than "add better alerting."
- **Mention your scale.** Monitoring 3 workspaces has different needs than monitoring 30.
- **Reference other tools.** If you have seen this done well elsewhere (Datadog, Monte Carlo, Great Expectations), mention it. We are not proud -- we learn from everyone.

Thank you for helping us build the observability tool that Fabric deserves.
