/**
 * Observability Workbench - CLI Dashboard
 *
 * Renders collection results as a rich, color-coded CLI dashboard.
 * Sections: Inventory, Job History, Correlations, SLOs, Failures, Trends.
 */

import chalk from "chalk";
import Table from "cli-table3";
import type { CollectionResult, CorrelationChain, SLOMetricSet, WorkspaceSnapshot } from "./collector.ts";
import type { EnrichedJob } from "./fabric-client.ts";
import type { Alert } from "./alerts.ts";
import type { AppConfig } from "./config.ts";

// ── Formatting helpers ─────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(2)}h`;
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function statusColor(status: string): string {
  switch (status) {
    case "Completed":
      return chalk.green(status);
    case "Failed":
      return chalk.red(status);
    case "Cancelled":
      return chalk.yellow(status);
    case "InProgress":
      return chalk.cyan(status);
    case "Deduped":
      return chalk.gray(status);
    default:
      return chalk.white(status);
  }
}

function sloColor(rate: number, threshold: number): string {
  if (rate >= threshold) return chalk.green(fmtPct(rate));
  if (rate >= threshold * 0.9) return chalk.yellow(fmtPct(rate));
  return chalk.red(fmtPct(rate));
}

function freshnessColor(hours: number | null, maxHours: number): string {
  if (hours === null) return chalk.gray("N/A");
  if (hours <= maxHours * 0.5) return chalk.green(`${hours.toFixed(1)}h`);
  if (hours <= maxHours) return chalk.yellow(`${hours.toFixed(1)}h`);
  return chalk.red(`${hours.toFixed(1)}h`);
}

function sectionHeader(title: string): void {
  const line = "═".repeat(76);
  console.log();
  console.log(chalk.bold.blueBright(line));
  console.log(chalk.bold.blueBright(`  ${title}`));
  console.log(chalk.bold.blueBright(line));
}

// ── Dashboard Renderer ─────────────────────────────────────────────

export class Dashboard {
  constructor(private readonly config: AppConfig) {}

  render(result: CollectionResult, alerts: Alert[]): void {
    console.log();
    console.log(
      chalk.bold.white(
        `  Observability Workbench  |  ${new Date(result.timestamp).toLocaleString()}`
      )
    );

    this.renderInventory(result.workspaces);
    this.renderJobHistory(result.jobs);
    this.renderCorrelations(result.correlations);
    this.renderSLOStatus(result.sloMetrics);
    this.renderFailures(result.jobs);
    this.renderAlerts(alerts);
  }

  // ── Workspace Inventory ──────────────────────────────────────

  private renderInventory(workspaces: WorkspaceSnapshot[]): void {
    sectionHeader("WORKSPACE INVENTORY");

    const table = new Table({
      head: [
        chalk.white("Workspace"),
        chalk.white("ID"),
        chalk.white("Items"),
        chalk.white("Breakdown"),
      ],
      colWidths: [25, 40, 8, 40],
      wordWrap: true,
    });

    for (const ws of workspaces) {
      // Count items by type
      const typeCounts = new Map<string, number>();
      for (const item of ws.items) {
        typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
      }
      const breakdown = [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");

      table.push([
        chalk.cyan(ws.workspace.displayName),
        chalk.gray(ws.workspace.id.substring(0, 36)),
        String(ws.items.length),
        breakdown || chalk.gray("(empty)"),
      ]);
    }

    console.log(table.toString());

    const totalItems = workspaces.reduce(
      (sum, ws) => sum + ws.items.length,
      0
    );
    console.log(
      chalk.gray(
        `  Total: ${workspaces.length} workspace(s), ${totalItems} item(s)`
      )
    );
  }

  // ── Job Execution History ──────────────────────────────────────

  private renderJobHistory(jobs: EnrichedJob[]): void {
    sectionHeader("JOB EXECUTION HISTORY (Recent 25)");

    if (jobs.length === 0) {
      console.log(chalk.gray("  No job instances found."));
      return;
    }

    // Sort by start time descending
    const sorted = [...jobs]
      .filter((j) => j.startTimeUtc)
      .sort(
        (a, b) =>
          new Date(b.startTimeUtc).getTime() -
          new Date(a.startTimeUtc).getTime()
      )
      .slice(0, 25);

    const table = new Table({
      head: [
        chalk.white("Item"),
        chalk.white("Type"),
        chalk.white("Status"),
        chalk.white("Started"),
        chalk.white("Duration"),
        chalk.white("Invoke"),
      ],
      colWidths: [24, 12, 14, 22, 12, 12],
    });

    for (const job of sorted) {
      const durationMs =
        job.startTimeUtc && job.endTimeUtc
          ? new Date(job.endTimeUtc).getTime() -
            new Date(job.startTimeUtc).getTime()
          : null;

      table.push([
        chalk.white(truncate(job.itemDisplayName, 22)),
        chalk.gray(job.jobType),
        statusColor(job.status),
        formatTimestamp(job.startTimeUtc),
        durationMs !== null ? fmtMs(durationMs) : chalk.gray("running"),
        chalk.gray(job.invokeType),
      ]);
    }

    console.log(table.toString());
    console.log(chalk.gray(`  Showing ${sorted.length} of ${jobs.length} total jobs`));
  }

  // ── Correlation Chains ─────────────────────────────────────────

  private renderCorrelations(chains: CorrelationChain[]): void {
    sectionHeader("CORRELATION CHAINS (Pipeline -> Activities/Notebooks)");

    if (chains.length === 0) {
      console.log(chalk.gray("  No correlation chains detected."));
      return;
    }

    for (const chain of chains.slice(0, 10)) {
      const pj = chain.pipelineJob;
      const status = statusColor(pj.status);
      const activityCount = chain.activityRuns?.length ?? 0;
      const activityLabel = activityCount > 0
        ? chalk.gray(` [${activityCount} activities]`)
        : "";
      console.log(
        `  ${chalk.bold.cyan("Pipeline:")} ${pj.itemDisplayName}  ${status}  ${chalk.gray(fmtMs(chain.totalDurationMs))}${activityLabel}`
      );

      // Render activity runs from the Activity Runs API
      if (chain.activityRuns && chain.activityRuns.length > 0) {
        for (const activity of chain.activityRuns) {
          const dur = activity.durationMs != null
            ? fmtMs(activity.durationMs)
            : "?";
          console.log(
            `    ${chalk.gray("├──")} ${chalk.magenta(activity.activityName)} (${activity.activityType}) ${statusColor(activity.status)} ${chalk.gray(dur)}`
          );
        }
      }

      // Render correlated child jobs
      for (const child of chain.childJobs) {
        const childDuration =
          child.startTimeUtc && child.endTimeUtc
            ? fmtMs(
                new Date(child.endTimeUtc).getTime() -
                  new Date(child.startTimeUtc).getTime()
              )
            : "?";
        console.log(
          `    ${chalk.gray("└──")} ${child.itemDisplayName} (${child.jobType}) ${statusColor(child.status)} ${chalk.gray(childDuration)}`
        );
      }
    }

    if (chains.length > 10) {
      console.log(chalk.gray(`  ... and ${chains.length - 10} more chains`));
    }
  }

  // ── SLO Status ─────────────────────────────────────────────────

  private renderSLOStatus(metrics: SLOMetricSet[]): void {
    sectionHeader("SLO STATUS");

    if (metrics.length === 0) {
      console.log(chalk.gray("  No SLO metrics computed."));
      return;
    }

    const table = new Table({
      head: [
        chalk.white("Item"),
        chalk.white("Type"),
        chalk.white("Runs"),
        chalk.white("Success"),
        chalk.white("Avg"),
        chalk.white("P95"),
        chalk.white("Fresh"),
      ],
      colWidths: [24, 12, 7, 10, 10, 10, 10],
    });

    for (const m of metrics) {
      table.push([
        chalk.white(truncate(m.itemName, 22)),
        chalk.gray(m.itemType),
        String(m.totalRuns),
        sloColor(m.successRate, this.config.slo.minSuccessRate),
        fmtMs(m.avgDurationMs),
        fmtMs(m.p95DurationMs),
        freshnessColor(m.freshnessHours, this.config.slo.maxFreshnessHours),
      ]);
    }

    console.log(table.toString());
  }

  // ── Failed Jobs ────────────────────────────────────────────────

  private renderFailures(jobs: EnrichedJob[]): void {
    const failed = jobs
      .filter((j) => j.status === "Failed")
      .sort(
        (a, b) =>
          new Date(b.startTimeUtc).getTime() -
          new Date(a.startTimeUtc).getTime()
      )
      .slice(0, 10);

    sectionHeader("FAILED JOBS");

    if (failed.length === 0) {
      console.log(chalk.green("  No failed jobs. All clear!"));
      return;
    }

    for (const job of failed) {
      console.log(
        `  ${chalk.red("FAIL")} ${chalk.white(job.itemDisplayName)} (${job.jobType})` +
          `  ${chalk.gray(formatTimestamp(job.startTimeUtc))}`
      );
      if (job.failureReason) {
        console.log(`    ${chalk.red("Reason:")} ${job.failureReason}`);
      }
      console.log(
        `    ${chalk.gray("Job ID:")} ${job.id}  ${chalk.gray("Root:")} ${job.rootActivityId}`
      );
    }

    const totalFailed = jobs.filter((j) => j.status === "Failed").length;
    if (totalFailed > 10) {
      console.log(chalk.gray(`  ... and ${totalFailed - 10} more failures`));
    }
  }

  // ── Alerts ─────────────────────────────────────────────────────

  private renderAlerts(alerts: Alert[]): void {
    sectionHeader("ALERTS");

    if (alerts.length === 0) {
      console.log(chalk.green("  No active alerts."));
      return;
    }

    for (const alert of alerts) {
      const icon =
        alert.severity === "critical"
          ? chalk.bgRed.white(" CRIT ")
          : alert.severity === "warning"
            ? chalk.bgYellow.black(" WARN ")
            : chalk.bgBlue.white(" INFO ");
      console.log(`  ${icon} ${chalk.white(alert.message)}`);
      console.log(
        `         ${chalk.gray(alert.item)} in ${chalk.gray(alert.workspace)}`
      );
    }
  }
}

// ── Trend Analysis (standalone function) ────────────────────────────

export function renderTrendAnalysis(
  snapshots: CollectionResult[]
): void {
  sectionHeader("TREND ANALYSIS (Duration Regression Detection)");

  if (snapshots.length < 2) {
    console.log(chalk.gray("  Need at least 2 snapshots for trend analysis."));
    return;
  }

  // Compare latest vs previous for each item
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const prevMap = new Map<string, SLOMetricSet>();
  for (const m of previous.sloMetrics) {
    prevMap.set(`${m.workspaceId}::${m.itemId}`, m);
  }

  let regressions = 0;
  let improvements = 0;

  for (const m of latest.sloMetrics) {
    const key = `${m.workspaceId}::${m.itemId}`;
    const prev = prevMap.get(key);
    if (!prev || prev.avgDurationMs === 0) continue;

    const ratio = m.avgDurationMs / prev.avgDurationMs;
    if (ratio > 1.5) {
      console.log(
        `  ${chalk.red("REGRESSION")} ${m.itemName}: avg ${fmtMs(prev.avgDurationMs)} -> ${fmtMs(m.avgDurationMs)} (${chalk.red(`${ratio.toFixed(1)}x`)})`
      );
      regressions++;
    } else if (ratio < 0.7) {
      console.log(
        `  ${chalk.green("IMPROVED")} ${m.itemName}: avg ${fmtMs(prev.avgDurationMs)} -> ${fmtMs(m.avgDurationMs)} (${chalk.green(`${ratio.toFixed(1)}x`)})`
      );
      improvements++;
    }
  }

  if (regressions === 0 && improvements === 0) {
    console.log(chalk.gray("  No significant duration changes detected."));
  } else {
    console.log(
      chalk.gray(
        `\n  Summary: ${regressions} regression(s), ${improvements} improvement(s)`
      )
    );
  }
}

// ── Utility ────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max - 1) + "\u2026" : s;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return chalk.gray("N/A");
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
