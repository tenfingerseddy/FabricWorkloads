# KQL Query Sharing

**Category: KQL Queries (pin this discussion)**

---

This is the community thread for sharing, discovering, and discussing KQL queries for Fabric observability. Whether you have written a query that saved your team hours of debugging or you are looking for a query to solve a specific problem, this is the place.

## How to share a query

Post a reply to this discussion with your query using this format:

### Query template

```
**Query name**: [descriptive name]
**Purpose**: [what does this query help you find or monitor?]
**Tables used**: [which Eventhouse tables -- FabricEvents, SloSnapshots, AlertLog, etc.]
**Tested on**: [your Fabric capacity SKU and Eventhouse version]
```

Then include the KQL code in a code block:

```kql
// Your KQL query here
FabricEvents
| where TimeGenerated > ago(7d)
| summarize FailureCount = countif(Status == "Failed") by ItemName, ItemType
| order by FailureCount desc
| take 20
```

And optionally:
- Sample output or a screenshot of the results
- Notes on how to customize it for different environments
- Known limitations

## Community query pack

We maintain an official [KQL Community Query Pack](https://github.com/tenfingerseddy/FabricWorkloads/tree/main/kql) with 20 curated queries covering:

- Pipeline failure analysis
- Capacity and CU monitoring
- Data freshness tracking
- Cross-item correlation
- SLO compliance reporting
- Anomaly detection

If you write a query that others find useful, we may invite you to submit a PR to include it in the official pack (with full attribution).

## Query ideas we would love to see

If you are looking for a challenge, here are queries the community has asked about:

- **Refresh cascade tracker**: When a lakehouse ingestion triggers a semantic model refresh, trace the full chain with timing
- **CU spike correlator**: Identify which Fabric items are consuming the most capacity units during peak windows
- **Weekend vs. weekday failure patterns**: Compare pipeline reliability across business days vs. off-hours
- **Slow query detection**: Find KQL queries against the Eventhouse that are taking longer than expected
- **SLO burndown**: Project whether an SLO will breach based on current trend, before it actually breaches
- **Stale dataset finder**: Identify semantic models that have not refreshed within their expected window
- **Cross-workspace dependency map**: Show which items in workspace A depend on items in workspace B

## Tips for writing good Fabric KQL queries

1. **Use `ago()` with reasonable time windows.** Scanning 365 days of data when you only need 7 wastes capacity units.
2. **Filter early.** Put `where` clauses before `summarize` to reduce the data processed.
3. **Use `materialize()` for reused subqueries.** Avoid scanning the same data twice.
4. **Include comments.** Other users need to understand your intent, not just your syntax.
5. **Test against real data.** Queries that work on 100 rows may behave differently on 100,000.

## Contributing queries to the official pack

If your query gets positive reactions from the community:

1. Fork the repo
2. Add your query to `kql/community-query-pack.kql` following the existing format
3. Include: query name, description, author attribution, and the KQL code
4. Submit a PR with the label `kql-contribution`

We review all KQL PRs within 48 hours.

Share your queries below.
