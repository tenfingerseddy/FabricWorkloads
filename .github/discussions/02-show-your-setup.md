# Show Your Setup

**Category: Show and Tell (pin this discussion)**

---

We would love to see how you are using Observability Workbench in your environment. Share your setup, dashboards, custom configurations, and lessons learned.

## What to share

Here are some ideas for what makes a great "show your setup" post:

### Your environment
- How many Fabric workspaces are you monitoring?
- What capacity SKU are you running on?
- What Fabric item types are most critical to your workflow (pipelines, notebooks, dataflows, semantic models)?

### Your configuration
- Which SLOs have you defined and what thresholds work for your team?
- How did you configure alert routing (Teams, Slack, email, PagerDuty)?
- Are you using the Lakehouse archive for long-term retention?
- Have you customized any of the ingestion, correlation, or alerting notebooks?

### Your dashboards and queries
- Screenshots of your SLO dashboards (redact any sensitive workspace names if needed)
- Custom KQL queries you have written on top of the Eventhouse data
- Power BI reports built against the Eventhouse tables

### Your workflow
- How does Observability Workbench fit into your team's on-call or incident response process?
- Before vs. after: how has your mean-time-to-detect or mean-time-to-resolve changed?
- What gaps remain that you would like to see addressed?

## Template for your post

Feel free to use this structure (or ignore it entirely -- share however you like):

```
**Environment**: [capacity SKU, region, number of workspaces]
**Monitored items**: [pipelines, notebooks, dataflows, semantic models, etc.]
**SLOs defined**: [brief list of your SLO definitions and thresholds]
**Retention**: [how many days of event retention you are keeping]
**Alerting**: [where alerts go -- Teams, Slack, email, etc.]
**Favorite feature**: [what has been most valuable]
**Wish list**: [what you would like to see added next]
**Screenshot**: [optional -- a dashboard view, KQL output, or alert example]
```

## Why share?

- Help others learn from your configuration decisions
- Discover approaches you had not considered from other community members
- Influence the roadmap by showing real-world usage patterns
- Build your reputation as a Fabric observability practitioner

Every setup is interesting, whether you are monitoring 1 workspace or 50. We look forward to seeing yours.
