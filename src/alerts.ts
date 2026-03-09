/**
 * Observability Workbench - Alerting Engine
 *
 * Evaluates SLO metrics and job data against configurable thresholds.
 * Produces typed alerts that can be rendered to console or written to file.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CollectionResult, SLOMetricSet } from "./collector.ts";
import type { AppConfig, SLOConfig } from "./config.ts";

// ── Alert types ────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertKind =
  | "success_rate_violation"
  | "duration_regression"
  | "freshness_violation"
  | "consecutive_failures"
  | "no_recent_runs";

export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  workspace: string;
  workspaceId: string;
  item: string;
  itemId: string;
  itemType: string;
  message: string;
  value: number | null;
  threshold: number | null;
  timestamp: string;
}

// ── Engine ─────────────────────────────────────────────────────────

export class AlertEngine {
  private readonly slo: SLOConfig;

  constructor(private readonly config: AppConfig) {
    this.slo = config.slo;
  }

  /**
   * Evaluate a collection result and return all triggered alerts.
   * Optionally pass historical metrics for baseline comparison.
   */
  evaluate(
    result: CollectionResult,
    baselineMetrics?: SLOMetricSet[]
  ): Alert[] {
    const alerts: Alert[] = [];
    const now = new Date().toISOString();

    for (const m of result.sloMetrics) {
      // 1. Success rate violation
      if (m.totalRuns >= 3 && m.successRate < this.slo.minSuccessRate) {
        alerts.push({
          kind: "success_rate_violation",
          severity: m.successRate < this.slo.minSuccessRate * 0.8 ? "critical" : "warning",
          workspace: m.workspaceName,
          workspaceId: m.workspaceId,
          item: m.itemName,
          itemId: m.itemId,
          itemType: m.itemType,
          message: `Success rate ${(m.successRate * 100).toFixed(1)}% is below SLO threshold ${(this.slo.minSuccessRate * 100).toFixed(1)}%`,
          value: m.successRate,
          threshold: this.slo.minSuccessRate,
          timestamp: now,
        });
      }

      // 2. Freshness violation
      if (
        m.freshnessHours !== null &&
        m.freshnessHours > this.slo.maxFreshnessHours
      ) {
        alerts.push({
          kind: "freshness_violation",
          severity:
            m.freshnessHours > this.slo.maxFreshnessHours * 2
              ? "critical"
              : "warning",
          workspace: m.workspaceName,
          workspaceId: m.workspaceId,
          item: m.itemName,
          itemId: m.itemId,
          itemType: m.itemType,
          message: `Last success was ${m.freshnessHours.toFixed(1)}h ago (limit: ${this.slo.maxFreshnessHours}h)`,
          value: m.freshnessHours,
          threshold: this.slo.maxFreshnessHours,
          timestamp: now,
        });
      }

      // 3. Duration regression (P95 compared to baseline)
      if (baselineMetrics) {
        const baseline = baselineMetrics.find(
          (b) =>
            b.workspaceId === m.workspaceId && b.itemId === m.itemId
        );
        if (
          baseline &&
          baseline.p95DurationMs > 0 &&
          m.p95DurationMs >
            baseline.p95DurationMs * this.slo.durationRegressionMultiplier
        ) {
          const ratio = m.p95DurationMs / baseline.p95DurationMs;
          alerts.push({
            kind: "duration_regression",
            severity: ratio > 3 ? "critical" : "warning",
            workspace: m.workspaceName,
            workspaceId: m.workspaceId,
            item: m.itemName,
            itemId: m.itemId,
            itemType: m.itemType,
            message: `P95 duration regression: ${formatMs(baseline.p95DurationMs)} -> ${formatMs(m.p95DurationMs)} (${ratio.toFixed(1)}x)`,
            value: m.p95DurationMs,
            threshold:
              baseline.p95DurationMs *
              this.slo.durationRegressionMultiplier,
            timestamp: now,
          });
        }
      }

      // 4. Consecutive failures detection
      const itemJobs = result.jobs
        .filter(
          (j) =>
            j.workspaceId === m.workspaceId &&
            j.itemId === m.itemId &&
            j.startTimeUtc
        )
        .sort(
          (a, b) =>
            new Date(b.startTimeUtc).getTime() -
            new Date(a.startTimeUtc).getTime()
        );

      let consecutiveFails = 0;
      for (const j of itemJobs) {
        if (j.status === "Failed") consecutiveFails++;
        else break;
      }

      if (consecutiveFails >= 3) {
        alerts.push({
          kind: "consecutive_failures",
          severity: consecutiveFails >= 5 ? "critical" : "warning",
          workspace: m.workspaceName,
          workspaceId: m.workspaceId,
          item: m.itemName,
          itemId: m.itemId,
          itemType: m.itemType,
          message: `${consecutiveFails} consecutive failures detected`,
          value: consecutiveFails,
          threshold: 3,
          timestamp: now,
        });
      }

      // 5. No recent runs
      if (m.totalRuns === 0 || m.lastRunUtc === null) {
        // Only alert for runnable item types
        const runnableTypes = ["Pipeline", "Notebook", "SparkJobDefinition"];
        if (runnableTypes.includes(m.itemType)) {
          alerts.push({
            kind: "no_recent_runs",
            severity: "info",
            workspace: m.workspaceName,
            workspaceId: m.workspaceId,
            item: m.itemName,
            itemId: m.itemId,
            itemType: m.itemType,
            message: `No job runs found for this ${m.itemType}`,
            value: null,
            threshold: null,
            timestamp: now,
          });
        }
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    alerts.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    return alerts;
  }

  /**
   * Write alerts to a JSON file for external consumption.
   */
  async writeAlerts(alerts: Alert[], dataDir: string): Promise<string> {
    const filepath = join(dataDir, "alerts.json");
    await writeFile(filepath, JSON.stringify(alerts, null, 2), "utf-8");
    console.log(`[alerts] Wrote ${alerts.length} alert(s) to ${filepath}`);
    return filepath;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
