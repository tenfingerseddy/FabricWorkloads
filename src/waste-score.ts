/**
 * Observability Workbench - CU Waste Score Calculator
 *
 * Quantifies compute waste in Microsoft Fabric by analyzing:
 *   1. Retry waste:     Failed jobs that consumed CUs before failing
 *   2. Duration waste:  Jobs running longer than their baseline (P50) duration
 *   3. Duplicate waste: Multiple overlapping runs of the same item
 *
 * The waste score (0-100) represents efficiency — 100 means no waste detected.
 *
 * Cost model based on F64 SKU:
 *   $11.52/hour = $0.192/min = $0.0032/CU-second
 */

import type { EnrichedJob } from "./fabric-client.ts";
import type { SLOMetricSet, CollectionResult } from "./collector.ts";

// ── Constants ─────────────────────────────────────────────────────────

/** F64 SKU cost: $11.52/hour expressed as $/ms */
const CU_COST_PER_MS = 11.52 / (3_600 * 1000);

/** Minimum number of completed runs to calculate a meaningful baseline */
const MIN_BASELINE_RUNS = 2;

/** Hours in a month for cost projection (730 = average month) */
const HOURS_PER_MONTH = 730;

// ── Types ─────────────────────────────────────────────────────────────

export interface WasteMetrics {
  itemId: string;
  itemName: string;
  itemType: string;
  workspaceId: string;
  workspaceName: string;
  retryWasteCUMs: number;          // CU-milliseconds wasted on failed runs
  durationWasteCUMs: number;       // CU-milliseconds from duration regression
  duplicateWasteCUMs: number;      // CU-milliseconds from overlapping runs
  totalWasteCUMs: number;          // Sum of all waste
  wasteScore: number;              // 0-100 (100 = no waste)
  totalRuns: number;
  failedRuns: number;
  baselineDurationMs: number;      // P50 of completed runs (baseline)
  monthlyEstimatedCost: number;    // USD projected monthly cost of waste
}

export interface WasteReport {
  items: WasteMetrics[];
  aggregateWasteCUMs: number;
  aggregateScore: number;          // 0-100 weighted average
  estimatedMonthlyCost: number;    // USD
  evaluationWindow: string;        // Human-readable time range
  generatedAt: string;
}

// ── Calculator ────────────────────────────────────────────────────────

export class WasteScoreCalculator {
  /**
   * Calculate waste metrics for all items found in a collection result.
   *
   * The calculator groups jobs by workspace + item, computes per-item
   * waste across three dimensions, and produces a weighted aggregate score.
   */
  calculate(result: CollectionResult): WasteReport {
    const { jobs, sloMetrics } = result;

    // Build a lookup for SLO metrics (provides workspace name, etc.)
    const sloMap = new Map<string, SLOMetricSet>();
    for (const m of sloMetrics) {
      sloMap.set(`${m.workspaceId}::${m.itemId}`, m);
    }

    // Group jobs by workspace + item
    const grouped = this.groupJobsByItem(jobs);

    const items: WasteMetrics[] = [];

    for (const [key, itemJobs] of grouped) {
      const [workspaceId, itemId] = key.split("::");
      const slo = sloMap.get(key);
      const sample = itemJobs[0];

      const workspaceName = slo?.workspaceName ?? workspaceId;
      const itemName = sample.itemDisplayName;
      const itemType = sample.itemType;

      // Compute durations for completed jobs (baseline)
      const completedJobs = itemJobs.filter((j) => j.status === "Completed");
      const completedDurations = completedJobs
        .map((j) => this.jobDurationMs(j))
        .filter((d): d is number => d !== null)
        .sort((a, b) => a - b);

      const baselineDurationMs = percentile(completedDurations, 0.5);

      // 1. Retry waste: CU-ms burned on failed runs
      const retryWasteCUMs = this.calculateRetryWaste(itemJobs);

      // 2. Duration regression waste: excess CU-ms beyond baseline
      const durationWasteCUMs = this.calculateDurationWaste(
        completedJobs,
        baselineDurationMs
      );

      // 3. Duplicate run waste: overlapping concurrent runs
      const duplicateWasteCUMs = this.calculateDuplicateWaste(itemJobs);

      const totalWasteCUMs =
        retryWasteCUMs + durationWasteCUMs + duplicateWasteCUMs;

      // Compute total actual CU-ms consumed by all runs
      const totalActualCUMs = this.totalCUMs(itemJobs);

      // Waste score: 100 = perfect efficiency, 0 = all waste
      const wasteScore = this.computeScore(totalWasteCUMs, totalActualCUMs);

      // Project monthly cost based on the waste rate in the evaluation window
      const monthlyEstimatedCost = this.projectMonthlyCost(
        totalWasteCUMs,
        itemJobs
      );

      items.push({
        itemId,
        itemName,
        itemType,
        workspaceId,
        workspaceName,
        retryWasteCUMs,
        durationWasteCUMs,
        duplicateWasteCUMs,
        totalWasteCUMs,
        wasteScore,
        totalRuns: itemJobs.length,
        failedRuns: itemJobs.filter((j) => j.status === "Failed").length,
        baselineDurationMs,
        monthlyEstimatedCost,
      });
    }

    // Sort by total waste descending (worst offenders first)
    items.sort((a, b) => b.totalWasteCUMs - a.totalWasteCUMs);

    // Aggregate metrics
    const aggregateWasteCUMs = items.reduce(
      (sum, i) => sum + i.totalWasteCUMs,
      0
    );
    const totalActualCUMsAll = items.reduce(
      (sum, i) => {
        // Reconstruct total actual CUs from waste + efficient portion
        // wasteScore = 100 * (1 - waste/total) => total = waste / (1 - score/100)
        // But simpler: just sum from jobs directly
        return sum + i.totalWasteCUMs + this.efficientCUMs(i);
      },
      0
    );
    const aggregateScore = this.computeScore(
      aggregateWasteCUMs,
      totalActualCUMsAll
    );
    const estimatedMonthlyCost = items.reduce(
      (sum, i) => sum + i.monthlyEstimatedCost,
      0
    );

    // Evaluation window
    const evaluationWindow = this.computeEvaluationWindow(jobs);

    return {
      items,
      aggregateWasteCUMs,
      aggregateScore,
      estimatedMonthlyCost,
      evaluationWindow,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Retry Waste ─────────────────────────────────────────────────

  /**
   * Failed jobs consumed CUs for their entire runtime before failing.
   * This is "pure waste" since the work product is discarded.
   */
  private calculateRetryWaste(jobs: EnrichedJob[]): number {
    let waste = 0;
    for (const job of jobs) {
      if (job.status === "Failed") {
        const durationMs = this.jobDurationMs(job);
        if (durationMs !== null && durationMs > 0) {
          waste += durationMs;
        }
      }
    }
    return waste;
  }

  // ── Duration Waste ──────────────────────────────────────────────

  /**
   * For completed jobs, any runtime exceeding the baseline (P50) duration
   * represents potential regression waste. We only count the excess
   * beyond baseline for each run.
   *
   * Requires at least MIN_BASELINE_RUNS completed runs to establish baseline.
   */
  private calculateDurationWaste(
    completedJobs: EnrichedJob[],
    baselineDurationMs: number
  ): number {
    if (completedJobs.length < MIN_BASELINE_RUNS || baselineDurationMs <= 0) {
      return 0;
    }

    let waste = 0;
    for (const job of completedJobs) {
      const durationMs = this.jobDurationMs(job);
      if (durationMs !== null && durationMs > baselineDurationMs) {
        waste += durationMs - baselineDurationMs;
      }
    }
    return waste;
  }

  // ── Duplicate Waste ─────────────────────────────────────────────

  /**
   * Detects overlapping runs of the same item. When two runs of the
   * same job overlap in time, the overlapping portion of the shorter
   * run is counted as waste (the assumption is one of them is redundant).
   */
  private calculateDuplicateWaste(jobs: EnrichedJob[]): number {
    // Sort by start time
    const timed = jobs
      .filter((j) => j.startTimeUtc && j.endTimeUtc)
      .map((j) => ({
        start: new Date(j.startTimeUtc).getTime(),
        end: new Date(j.endTimeUtc!).getTime(),
        id: j.id,
      }))
      .sort((a, b) => a.start - b.start);

    if (timed.length < 2) return 0;

    let waste = 0;

    for (let i = 0; i < timed.length; i++) {
      for (let k = i + 1; k < timed.length; k++) {
        // Once the next job starts after the current one ends, no more overlaps
        if (timed[k].start >= timed[i].end) break;

        // Calculate overlap
        const overlapStart = timed[k].start;
        const overlapEnd = Math.min(timed[i].end, timed[k].end);
        const overlapMs = overlapEnd - overlapStart;

        if (overlapMs > 0) {
          waste += overlapMs;
        }
      }
    }

    return waste;
  }

  // ── Score Computation ───────────────────────────────────────────

  /**
   * Compute a 0-100 efficiency score.
   *   100 = no waste detected
   *   0   = all compute was wasted
   *
   * Score = 100 * (1 - waste / total)
   * If total is 0, return 100 (no compute used = no waste).
   */
  private computeScore(wasteCUMs: number, totalCUMs: number): number {
    if (totalCUMs <= 0) return 100;
    const ratio = Math.min(1, wasteCUMs / totalCUMs);
    return Math.round((1 - ratio) * 100);
  }

  // ── Monthly Cost Projection ─────────────────────────────────────

  /**
   * Project the monthly cost of waste based on the waste rate observed
   * in the evaluation window.
   *
   * If the evaluation window is shorter than a month, we extrapolate
   * linearly. The cost is based on F64 SKU pricing.
   */
  private projectMonthlyCost(
    wasteCUMs: number,
    jobs: EnrichedJob[]
  ): number {
    if (wasteCUMs <= 0 || jobs.length === 0) return 0;

    const windowMs = this.evaluationWindowMs(jobs);
    if (windowMs <= 0) return 0;

    const monthMs = HOURS_PER_MONTH * 3_600_000;
    const scaleFactor = monthMs / windowMs;

    // Convert CU-ms to dollars
    const wasteDollars = wasteCUMs * CU_COST_PER_MS;

    // Extrapolate to monthly
    const monthlyCost = wasteDollars * scaleFactor;

    // Round to 2 decimal places
    return Math.round(monthlyCost * 100) / 100;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private groupJobsByItem(jobs: EnrichedJob[]): Map<string, EnrichedJob[]> {
    const grouped = new Map<string, EnrichedJob[]>();
    for (const j of jobs) {
      const key = `${j.workspaceId}::${j.itemId}`;
      const arr = grouped.get(key) ?? [];
      arr.push(j);
      grouped.set(key, arr);
    }
    return grouped;
  }

  private jobDurationMs(job: EnrichedJob): number | null {
    if (!job.startTimeUtc || !job.endTimeUtc) return null;
    const ms =
      new Date(job.endTimeUtc).getTime() -
      new Date(job.startTimeUtc).getTime();
    return ms >= 0 ? ms : null;
  }

  /**
   * Sum of all job durations in CU-ms (used to compute waste ratio).
   */
  private totalCUMs(jobs: EnrichedJob[]): number {
    let total = 0;
    for (const job of jobs) {
      const durationMs = this.jobDurationMs(job);
      if (durationMs !== null && durationMs > 0) {
        total += durationMs;
      }
    }
    return total;
  }

  /**
   * Calculate efficient (non-waste) CU-ms for a WasteMetrics entry.
   * This reconstructs the total actual compute from the score.
   */
  private efficientCUMs(metrics: WasteMetrics): number {
    if (metrics.wasteScore >= 100) return 0;
    if (metrics.wasteScore <= 0) return 0;
    // score = 100 * (1 - waste/total) => total = waste / (1 - score/100)
    const ratio = 1 - metrics.wasteScore / 100;
    if (ratio <= 0) return 0;
    return metrics.totalWasteCUMs / ratio - metrics.totalWasteCUMs;
  }

  /**
   * Compute the time span of the evaluation window (oldest job to newest job).
   */
  private evaluationWindowMs(jobs: EnrichedJob[]): number {
    const timestamps: number[] = [];
    for (const j of jobs) {
      if (j.startTimeUtc) timestamps.push(new Date(j.startTimeUtc).getTime());
      if (j.endTimeUtc) timestamps.push(new Date(j.endTimeUtc).getTime());
    }
    if (timestamps.length < 2) return 0;
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Compute a human-readable evaluation window string.
   */
  private computeEvaluationWindow(jobs: EnrichedJob[]): string {
    const timestamps: number[] = [];
    for (const j of jobs) {
      if (j.startTimeUtc) timestamps.push(new Date(j.startTimeUtc).getTime());
      if (j.endTimeUtc) timestamps.push(new Date(j.endTimeUtc).getTime());
    }
    if (timestamps.length < 2) return "insufficient data";

    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    const spanMs = latest.getTime() - earliest.getTime();

    const hours = spanMs / 3_600_000;
    let spanLabel: string;
    if (hours < 1) {
      spanLabel = `${Math.round(spanMs / 60_000)}m`;
    } else if (hours < 48) {
      spanLabel = `${hours.toFixed(1)}h`;
    } else {
      spanLabel = `${(hours / 24).toFixed(1)}d`;
    }

    return `${spanLabel} (${earliest.toISOString().slice(0, 16)} to ${latest.toISOString().slice(0, 16)})`;
  }
}

// ── Utility ─────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Exported constants for testing ──────────────────────────────────

export const CU_COST = {
  perMs: CU_COST_PER_MS,
  perSecond: CU_COST_PER_MS * 1000,
  perMinute: CU_COST_PER_MS * 60_000,
  perHour: CU_COST_PER_MS * 3_600_000,
};
