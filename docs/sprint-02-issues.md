# Sprint 2: GitHub Issues

> These issues should be created on https://github.com/tenfingerseddy/FabricWorkloads
> Priority-ordered by impact on user adoption and content marketing alignment.
> Sprint duration: 2 weeks

---

## Issue 1: CU Waste Score Calculator

**Title:** Add CU waste score calculation to collection and dashboard

**Labels:** `enhancement`, `high-priority`, `good first issue`

**Description:**

Calculate a "Waste Score" metric for each workspace based on the collection data we already have. This metric quantifies how much CU capacity is wasted on failed runs, retries, and duplicate executions.

**Formula:**
```
Waste Score = (Failed Runs * Avg Duration + Duplicate Runs * Avg Duration) / (Total Runs * Avg Duration) * 100
```

**Implementation:**

1. In `collector.ts`, add retry detection logic:
   - For each item, identify job instances that start within 5 minutes of a failed instance for the same item
   - Count these as "retry runs"

2. In `collector.ts`, add duplicate schedule detection:
   - For each item, identify job instances that start within 10 minutes of another successful instance
   - Flag these as potential duplicates

3. Add new interface to `collector.ts`:
   ```typescript
   export interface WasteMetrics {
     workspaceId: string;
     workspaceName: string;
     totalRuns: number;
     failedRuns: number;
     retryRuns: number;
     duplicateRuns: number;
     wasteScore: number; // percentage
     estimatedWastedMinutes: number;
   }
   ```

4. Add `wasteMetrics` to `CollectionResult`

5. In `dashboard.ts`, add a "CU Waste Analysis" section that renders:
   - Workspace-level waste score with color coding (green < 5%, yellow 5-10%, red > 10%)
   - Top 5 items by retry count
   - Detected duplicate schedules
   - Estimated wasted minutes

**Why this matters:**
Our Week 2 blog post ("Hidden Cost of Bad Data in Fabric") introduces the Waste Score concept. Having it implemented in the tool makes the blog post's CTA ("try it yourself") immediately actionable. This is our highest-impact content-to-product conversion opportunity right now.

**Acceptance criteria:**
- [ ] `--mode full` includes waste metrics in output
- [ ] Dashboard renders waste score section with color coding
- [ ] Retry detection correctly identifies back-to-back failed+retry patterns
- [ ] Duplicate detection flags items with overlapping schedules
- [ ] Unit tests for waste calculation logic

---

## Issue 2: Duration Regression Alerts

**Title:** Add P95 duration regression detection and alerting

**Labels:** `enhancement`, `high-priority`

**Description:**

Detect when an item's P95 execution duration increases significantly compared to its historical baseline. This catches the "creeping timeout" scenario described in our blog content -- where a notebook slowly gets slower over weeks until it hits the 2-hour timeout.

**Implementation:**

1. In `alerts.ts`, add new alert kind `duration_regression`:
   - Compare current P95 to baseline P95 (from previous collection)
   - Trigger `warning` when P95 increases > 25%
   - Trigger `critical` when P95 increases > 50% OR when P95 > 80% of known timeout thresholds

2. Add timeout threshold awareness:
   ```typescript
   const TIMEOUT_THRESHOLDS_MS = {
     'SemanticModel': 2 * 60 * 60 * 1000,  // 2 hours standard
     'Notebook': 24 * 60 * 60 * 1000,       // 24 hours
     'DataPipeline': 24 * 60 * 60 * 1000,   // 24 hours
   };
   ```

3. When P95 > 75% of the item type's timeout threshold, generate a proactive "approaching timeout" alert

4. In `dashboard.ts`, add a "Duration Trends" section showing items with P95 regression

**Why this matters:**
Duration regression is the most common precursor to timeout-induced full reprocessing (Category 4 in our blog). Detecting it early prevents the most expensive type of CU waste. It also demonstrates predictive capability, which differentiates us from monitoring-only tools.

**Acceptance criteria:**
- [ ] Duration regression alerts fire when P95 increases > 25% (warning) or > 50% (critical)
- [ ] "Approaching timeout" alerts fire when P95 > 75% of item type timeout
- [ ] Dashboard shows duration trend indicators (arrow up/down) per item
- [ ] Alert messages include specific P95 values (current vs baseline)
- [ ] Unit tests for regression detection

---

## Issue 3: Teams Webhook Notification Channel

**Title:** Add Microsoft Teams webhook as alert notification channel

**Labels:** `enhancement`, `medium-priority`

**Description:**

Currently alerts are written to local files and rendered to the CLI dashboard. Add Microsoft Teams incoming webhook as a notification channel so teams get real-time alerts without running the CLI.

**Implementation:**

1. Add configuration:
   ```
   TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
   TEAMS_ALERT_MIN_SEVERITY=warning  # Only send warning+critical
   ```

2. Create `src/notifications.ts`:
   - `TeamsNotifier` class
   - Format alerts as Adaptive Cards with:
     - Alert severity (color-coded)
     - Item name and workspace
     - Current value vs threshold
     - Link to item in Fabric portal
   - Respect `TEAMS_ALERT_MIN_SEVERITY` filter
   - Rate limit: max 1 message per item per hour (cooldown)

3. Integrate into `index.ts` collection cycle:
   - After alert evaluation, send new alerts to Teams
   - Track sent alerts to avoid duplicates

**Why this matters:**
"Fabric does not alert you when a pipeline fails" is one of the most resonant pain points in our content. Adding Teams notifications makes us the simplest path from "no alerting" to "real-time alerts" for Fabric teams. This is also content calendar Week 7's blog topic (Power Automate alternative).

**Acceptance criteria:**
- [ ] Teams webhook sends Adaptive Card for warning/critical alerts
- [ ] Cooldown prevents duplicate notifications
- [ ] Configuration via environment variables
- [ ] Graceful degradation when webhook URL not configured
- [ ] Manual test with real Teams webhook documented

---

## Issue 4: HTML Dashboard Export

**Title:** Add HTML dashboard export alongside CLI output

**Labels:** `enhancement`, `medium-priority`

**Description:**

Generate a self-contained HTML file with the dashboard data that can be shared via email, Teams, or hosted on a web server. This makes the tool useful for teams where not everyone runs the CLI.

**Implementation:**

1. Create `src/html-dashboard.ts`:
   - Generate a single HTML file with embedded CSS and JS
   - Sections mirror CLI dashboard: Inventory, Jobs, Correlations, SLOs, Alerts, Waste Score
   - Use simple charts (CSS-based bar charts or lightweight inline SVG)
   - Include timestamp and data freshness indicator
   - Self-contained (no external dependencies)

2. Add `--output html` flag to CLI:
   ```
   node --import tsx src/index.ts --output html
   ```
   Writes `data/dashboard-{timestamp}.html`

3. In monitor mode, regenerate HTML after each collection cycle

**Why this matters:**
An HTML dashboard is shareable, bookmarkable, and demonstrates visual value that a CLI cannot. It also serves as a preview of what the full Fabric workload frontend will look like. For GitHub README screenshots, this is essential.

**Acceptance criteria:**
- [ ] HTML file renders correctly in Chrome/Edge
- [ ] All dashboard sections present with data
- [ ] File is self-contained (no external resources)
- [ ] Responsive layout works on desktop and tablet
- [ ] Auto-refresh option for monitor mode

---

## Issue 5: Workspace Monitoring Log Ingestion

**Title:** Ingest workspace monitoring data for enriched event context

**Labels:** `enhancement`, `low-priority`, `research-needed`

**Description:**

Currently we collect data via the Fabric Jobs API. Workspace monitoring provides additional context including Spark logs, SQL query logs, and more granular error details. Ingesting this data would enrich our event store and improve correlation accuracy.

**Research needed:**
- Workspace monitoring retention is 30 days -- our ingestion needs to run at least daily to capture everything
- Workspace monitoring does not support log type filtering -- we will need to filter client-side
- Some log tables (user data operations) are noted as unavailable even when the table exists
- Need to validate access permissions required (workspace admin? contributor?)

**Implementation approach:**
1. Use the Fabric workspace monitoring endpoint to query available log tables
2. Incremental ingestion: track last-ingested timestamp per log table
3. Store in Eventhouse alongside Jobs API data
4. Enrich correlation chains with Spark/SQL log context

**Why this matters:**
Workspace monitoring data provides error details and execution context that the Jobs API does not expose. This enrichment makes our incident timeline feature significantly more useful for root cause analysis.

**Acceptance criteria:**
- [ ] Research spike documented with findings on available log tables and access requirements
- [ ] Incremental ingestion of at least one log table type
- [ ] Enrichment of existing job data with log context
- [ ] 30-day ingestion lag handled (daily collection minimum)

---

## Issue 6: Lakehouse Data Quality Notebook Template

**Title:** Create free Lakehouse data quality checking notebook template

**Labels:** `enhancement`, `content`, `community`

**Description:**

Create a Fabric Notebook template (PySpark) that scans all tables in a Lakehouse and produces a data quality report. This aligns with content calendar Week 3 (practical how-to blog post) and serves as a lead generation tool.

**Quality checks to implement:**
1. **Row count** -- Current count and 7-day trend
2. **Freshness** -- Last modified timestamp per table
3. **Null rates** -- Percentage of nulls per column
4. **Completeness** -- Percentage of non-null values
5. **Schema drift** -- Compare current schema to a stored baseline

**Output:**
- Results written to a Delta table in the same Lakehouse
- Summary printed to notebook output
- Optional: HTML widget with summary dashboard

**Deliverables:**
- `notebooks/NB_DataQualityCheck.py` -- The notebook template
- `notebooks/NB_DataQualityCheck.ipynb` -- Jupyter format for Fabric upload
- Blog post template referencing the notebook

**Why this matters:**
Week 3 content calendar calls for "Building a Fabric Lakehouse Data Quality Dashboard with Python and Spark (Free Template)". Having the actual notebook in our GitHub repo makes the blog post credible and drives GitHub stars. Free tools are our primary community building strategy.

**Acceptance criteria:**
- [ ] Notebook runs successfully in Fabric environment
- [ ] All 5 quality check types implemented
- [ ] Results stored in Delta table format
- [ ] README with usage instructions
- [ ] Upload script updated to include this notebook
