/**
 * Tests for the WasteScoreCalculator — CU waste quantification.
 *
 * Covers:
 *   - Retry waste (failed job CU consumption)
 *   - Duration regression waste (excess beyond baseline)
 *   - Duplicate run waste (overlapping concurrent runs)
 *   - Score computation (0-100 scale)
 *   - Monthly cost projection
 *   - Edge cases (empty data, single runs, all failures)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { WasteScoreCalculator, CU_COST } from "../waste-score.ts";
import type { WasteReport } from "../waste-score.ts";
import type { CollectionResult, SLOMetricSet } from "../collector.ts";
import type { EnrichedJob } from "../fabric-client.ts";
import { resetJobCounter, makeJob } from "./fixtures/mock-jobs.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function makeCollectionResult(
  jobs: EnrichedJob[],
  sloMetrics: SLOMetricSet[] = []
): CollectionResult {
  return {
    timestamp: "2026-03-09T12:00:00.000Z",
    workspaces: [],
    jobs,
    correlations: [],
    sloMetrics,
  };
}

function makeMetric(overrides: Partial<SLOMetricSet> = {}): SLOMetricSet {
  return {
    workspaceId: "ws-001",
    workspaceName: "Analytics-Production",
    itemId: "item-pipeline-001",
    itemName: "ETL-Daily-Load",
    itemType: "DataPipeline",
    totalRuns: 10,
    successCount: 7,
    failedCount: 2,
    cancelledCount: 1,
    successRate: 0.7,
    avgDurationMs: 243_000,
    p50DurationMs: 240_000,
    p95DurationMs: 600_000,
    maxDurationMs: 600_000,
    lastRunUtc: "2026-03-09T10:00:00.000Z",
    lastSuccessUtc: "2026-03-09T10:05:00.000Z",
    freshnessHours: 2.0,
    ...overrides,
  };
}

const JOB_BASE = {
  workspaceId: "ws-001",
  itemId: "item-pipeline-001",
  itemDisplayName: "ETL-Daily-Load",
  itemType: "DataPipeline",
  jobType: "Pipeline",
};

// ── Tests ───────────────────────────────────────────────────────────

describe("WasteScoreCalculator", () => {
  let calculator: WasteScoreCalculator;

  beforeEach(() => {
    resetJobCounter();
    calculator = new WasteScoreCalculator();
  });

  // ── Retry Waste ─────────────────────────────────────────────────

  describe("retry waste", () => {
    it("counts CU-ms for failed jobs", () => {
      const jobs = [
        // Failed: ran for 5 minutes before failing
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          failureReason: "Timeout",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        // Completed successfully: 3 minutes
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        // Another completed: 4 minutes
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:04:00.000Z",
        }),
      ];
      const slo = makeMetric();
      const result = makeCollectionResult(jobs, [slo]);

      const report = calculator.calculate(result);
      const item = report.items.find((i) => i.itemId === "item-pipeline-001");

      expect(item).toBeDefined();
      // Failed job ran 5 minutes = 300_000ms
      expect(item!.retryWasteCUMs).toBe(300_000);
      expect(item!.failedRuns).toBe(1);
    });

    it("sums waste across multiple failed jobs", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z", // 5min = 300_000ms
        }),
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:10:00.000Z", // 10min = 600_000ms
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T04:00:00.000Z",
          endTimeUtc: "2026-03-09T04:03:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      const item = report.items[0];

      expect(item.retryWasteCUMs).toBe(900_000); // 300k + 600k
      expect(item.failedRuns).toBe(2);
    });

    it("reports zero retry waste when no jobs failed", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].retryWasteCUMs).toBe(0);
    });

    it("ignores failed jobs with no endTime", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: null, // still running or no endTime
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].retryWasteCUMs).toBe(0);
    });
  });

  // ── Duration Waste ──────────────────────────────────────────────

  describe("duration waste", () => {
    it("calculates excess beyond P50 baseline for completed jobs", () => {
      // 4 completed jobs with durations: 3min, 3min, 5min, 10min
      // P50 of sorted [180k, 180k, 300k, 600k] = idx ceil(0.5*4)-1 = 1 => 180k
      // Duration waste = (300k - 180k) + (600k - 180k) = 120k + 420k = 540k
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:03:00.000Z", // 3min
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z", // 3min
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:05:00.000Z", // 5min
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T04:00:00.000Z",
          endTimeUtc: "2026-03-09T04:10:00.000Z", // 10min
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      const item = report.items[0];

      expect(item.baselineDurationMs).toBe(180_000);
      // excess: 0 + 0 + (300k-180k) + (600k-180k) = 120k + 420k = 540k
      expect(item.durationWasteCUMs).toBe(540_000);
    });

    it("reports zero duration waste when all jobs run at or below baseline", () => {
      // All 3 completed jobs: 3 minutes each => P50 = 180k, no excess
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].durationWasteCUMs).toBe(0);
    });

    it("requires at least 2 completed runs for baseline (returns 0 otherwise)", () => {
      // Only 1 completed job -- not enough for baseline
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:10:00.000Z", // 10 min
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].durationWasteCUMs).toBe(0);
    });

    it("excludes failed and cancelled jobs from duration baseline", () => {
      // 2 completed at 3min, 1 failed at 10min
      // Baseline from completed only: P50 of [180k, 180k] = 180k
      // Duration waste from completed: 0 (both at baseline)
      // Failed jobs are NOT counted in duration waste (they go to retry waste)
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:10:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].durationWasteCUMs).toBe(0);
      expect(report.items[0].baselineDurationMs).toBe(180_000);
    });
  });

  // ── Duplicate Waste ─────────────────────────────────────────────

  describe("duplicate waste", () => {
    it("detects overlapping runs of the same item", () => {
      // Run A: 01:00 to 01:10 (10min)
      // Run B: 01:05 to 01:15 (10min)
      // Overlap: 01:05 to 01:10 = 5min = 300_000ms
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:10:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:05:00.000Z",
          endTimeUtc: "2026-03-09T01:15:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].duplicateWasteCUMs).toBe(300_000);
    });

    it("reports zero for non-overlapping runs", () => {
      // Run A: 01:00 to 01:05
      // Run B: 01:10 to 01:15 (starts after A ends)
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:10:00.000Z",
          endTimeUtc: "2026-03-09T01:15:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].duplicateWasteCUMs).toBe(0);
    });

    it("handles three overlapping runs", () => {
      // Run A: 01:00 to 01:20 (20min)
      // Run B: 01:05 to 01:15 (10min, fully inside A)
      // Run C: 01:10 to 01:25 (15min, overlaps A and B)
      //
      // A vs B: overlap 01:05 to 01:15 = 10min
      // A vs C: overlap 01:10 to 01:20 = 10min
      // B vs C: overlap 01:10 to 01:15 = 5min
      // Total: 10 + 10 + 5 = 25min = 1_500_000ms
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:20:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:05:00.000Z",
          endTimeUtc: "2026-03-09T01:15:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:10:00.000Z",
          endTimeUtc: "2026-03-09T01:25:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].duplicateWasteCUMs).toBe(1_500_000);
    });

    it("ignores jobs without endTimeUtc", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:10:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "InProgress",
          startTimeUtc: "2026-03-09T01:05:00.000Z",
          endTimeUtc: null,
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      // The InProgress job has no endTime, so it can't overlap
      expect(report.items[0].duplicateWasteCUMs).toBe(0);
    });
  });

  // ── Waste Score ─────────────────────────────────────────────────

  describe("waste score", () => {
    it("returns 100 when there is no waste", () => {
      // Two clean, non-overlapping, equal-duration completed runs
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].wasteScore).toBe(100);
      expect(report.items[0].totalWasteCUMs).toBe(0);
    });

    it("returns 0 when all compute is wasted (all failed)", () => {
      // All failed jobs with duration -- 100% of CUs wasted
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].wasteScore).toBe(0);
    });

    it("computes a middle score for mixed waste", () => {
      // 1 failed (5min), 3 completed (3min each, no overlap)
      // Retry waste: 300_000ms
      // Duration waste: all completed at same duration (3min baseline, 0 excess)
      // Total actual: 300k + 180k + 180k + 180k = 840k
      // Score: 100 * (1 - 300k/840k) = 100 * (1 - 0.357) = 64
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T04:00:00.000Z",
          endTimeUtc: "2026-03-09T04:03:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      const item = report.items[0];

      expect(item.retryWasteCUMs).toBe(300_000);
      expect(item.durationWasteCUMs).toBe(0);
      expect(item.duplicateWasteCUMs).toBe(0);
      expect(item.totalWasteCUMs).toBe(300_000);

      // Score: round(100 * (1 - 300000/840000)) = round(100 * 0.6428...) = 64
      expect(item.wasteScore).toBe(64);
    });

    it("returns 100 for empty job list", () => {
      const result = makeCollectionResult([], []);
      const report = calculator.calculate(result);

      expect(report.items).toHaveLength(0);
      expect(report.aggregateScore).toBe(100);
    });
  });

  // ── Aggregate Metrics ───────────────────────────────────────────

  describe("aggregate metrics", () => {
    it("sums waste across multiple items", () => {
      const pipelineJobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z", // 300k waste
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
      ];
      const notebookJobs = [
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Transform-Data",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:10:00.000Z", // 600k waste
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Transform-Data",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Transform-Data",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
      ];

      const sloMetrics = [
        makeMetric(),
        makeMetric({
          itemId: "item-notebook-001",
          itemName: "Transform-Data",
          itemType: "Notebook",
        }),
      ];

      const result = makeCollectionResult(
        [...pipelineJobs, ...notebookJobs],
        sloMetrics
      );
      const report = calculator.calculate(result);

      expect(report.items).toHaveLength(2);
      // Pipeline: 300k, Notebook: 600k
      expect(report.aggregateWasteCUMs).toBe(900_000);
    });

    it("sorts items by waste descending (worst first)", () => {
      const jobs = [
        // Pipeline: 1 failed 5min
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
        // Notebook: 1 failed 10min (more waste)
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Heavy-Notebook",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:10:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Heavy-Notebook",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-notebook-001",
          itemDisplayName: "Heavy-Notebook",
          itemType: "Notebook",
          jobType: "SparkJob",
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, []);

      const report = calculator.calculate(result);

      // Notebook has more waste (600k) than pipeline (300k), so it comes first
      expect(report.items[0].itemName).toBe("Heavy-Notebook");
      expect(report.items[1].itemName).toBe("ETL-Daily-Load");
    });
  });

  // ── Monthly Cost Projection ─────────────────────────────────────

  describe("monthly cost projection", () => {
    it("projects monthly cost based on evaluation window", () => {
      // Jobs span 9 hours (01:00 to 10:05)
      // Waste: 300k ms = 300 seconds
      // Cost per ms = 11.52 / 3_600_000
      // Waste cost = 300_000 * (11.52 / 3_600_000) = $0.96
      // Window = 9h5min = 32700s = 32_700_000ms
      // Monthly hours = 730h => monthly ms = 730 * 3_600_000 = 2_628_000_000ms
      // Scale factor = 2_628_000_000 / (9*3600000 + 5*60000) = 2_628_000_000 / 32_700_000 ~= 80.36697...
      // Monthly cost = 0.96 * 80.36697 ~= $77.15
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T05:00:00.000Z",
          endTimeUtc: "2026-03-09T05:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T10:00:00.000Z",
          endTimeUtc: "2026-03-09T10:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);

      // Verify the cost is positive and reasonable
      expect(report.items[0].monthlyEstimatedCost).toBeGreaterThan(0);
      expect(report.estimatedMonthlyCost).toBeGreaterThan(0);
    });

    it("returns zero monthly cost when there is no waste", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      expect(report.items[0].monthlyEstimatedCost).toBe(0);
    });
  });

  // ── Evaluation Window ───────────────────────────────────────────

  describe("evaluation window", () => {
    it("computes human-readable evaluation window", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T10:00:00.000Z",
          endTimeUtc: "2026-03-09T10:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);

      expect(report.evaluationWindow).toContain("2026-03-09T01:00");
      expect(report.evaluationWindow).toContain("2026-03-09T10:05");
    });

    it("returns 'insufficient data' for empty jobs", () => {
      const result = makeCollectionResult([], []);
      const report = calculator.calculate(result);
      expect(report.evaluationWindow).toBe("insufficient data");
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles single job (no waste detectable)", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);

      expect(report.items).toHaveLength(1);
      expect(report.items[0].wasteScore).toBe(100);
      expect(report.items[0].durationWasteCUMs).toBe(0); // not enough for baseline
      expect(report.items[0].duplicateWasteCUMs).toBe(0);
      expect(report.items[0].retryWasteCUMs).toBe(0);
    });

    it("handles all cancelled jobs (no waste, no useful runs)", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Cancelled",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:00:30.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Cancelled",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:00:15.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);

      // Cancelled jobs have no retry waste (they are not "Failed")
      // No completed runs, so no duration baseline
      expect(report.items[0].retryWasteCUMs).toBe(0);
      expect(report.items[0].durationWasteCUMs).toBe(0);
    });

    it("handles jobs across multiple workspaces", () => {
      const ws1Jobs = [
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-1",
          itemDisplayName: "Pipeline-A",
          itemType: "DataPipeline",
          jobType: "Pipeline",
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-1",
          itemDisplayName: "Pipeline-A",
          itemType: "DataPipeline",
          jobType: "Pipeline",
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-001",
          itemId: "item-1",
          itemDisplayName: "Pipeline-A",
          itemType: "DataPipeline",
          jobType: "Pipeline",
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
      ];
      const ws2Jobs = [
        makeJob({
          workspaceId: "ws-002",
          itemId: "item-2",
          itemDisplayName: "Pipeline-B",
          itemType: "DataPipeline",
          jobType: "Pipeline",
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          workspaceId: "ws-002",
          itemId: "item-2",
          itemDisplayName: "Pipeline-B",
          itemType: "DataPipeline",
          jobType: "Pipeline",
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult([...ws1Jobs, ...ws2Jobs], []);

      const report = calculator.calculate(result);

      expect(report.items).toHaveLength(2);
      // Pipeline-A has waste (failed run), Pipeline-B has none
      const pipelineA = report.items.find((i) => i.itemName === "Pipeline-A");
      const pipelineB = report.items.find((i) => i.itemName === "Pipeline-B");

      expect(pipelineA!.retryWasteCUMs).toBe(300_000);
      expect(pipelineB!.retryWasteCUMs).toBe(0);
      expect(pipelineB!.wasteScore).toBe(100);
    });

    it("resolves workspace name from SLO metrics", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const slo = makeMetric({ workspaceName: "My-Workspace" });
      const result = makeCollectionResult(jobs, [slo]);

      const report = calculator.calculate(result);

      expect(report.items[0].workspaceName).toBe("My-Workspace");
    });

    it("falls back to workspaceId when no SLO metric exists", () => {
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:05:00.000Z",
        }),
      ];
      const result = makeCollectionResult(jobs, []); // no SLO metrics

      const report = calculator.calculate(result);

      expect(report.items[0].workspaceName).toBe("ws-001");
    });
  });

  // ── CU Cost Constants ───────────────────────────────────────────

  describe("CU cost model", () => {
    it("has consistent per-ms, per-second, per-minute, per-hour rates", () => {
      expect(CU_COST.perSecond).toBeCloseTo(CU_COST.perMs * 1000, 10);
      expect(CU_COST.perMinute).toBeCloseTo(CU_COST.perMs * 60_000, 10);
      expect(CU_COST.perHour).toBeCloseTo(11.52, 2);
    });
  });

  // ── Combined Waste Scenarios ────────────────────────────────────

  describe("combined waste scenarios", () => {
    it("accumulates all three waste types simultaneously", () => {
      // 5 jobs for the same item:
      //  1. Failed, 5min (retry waste: 300k)
      //  2. Completed, 3min (at baseline)
      //  3. Completed, 3min (at baseline)
      //  4. Completed, 8min (duration waste: 8min - 3min = 5min = 300k)
      //  5. Completed, 3min, overlaps with #4 by 2min (duplicate waste: 120k)
      const jobs = [
        makeJob({
          ...JOB_BASE,
          status: "Failed",
          startTimeUtc: "2026-03-09T01:00:00.000Z",
          endTimeUtc: "2026-03-09T01:05:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T02:00:00.000Z",
          endTimeUtc: "2026-03-09T02:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T03:00:00.000Z",
          endTimeUtc: "2026-03-09T03:03:00.000Z",
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T04:00:00.000Z",
          endTimeUtc: "2026-03-09T04:08:00.000Z", // 8 min
        }),
        makeJob({
          ...JOB_BASE,
          status: "Completed",
          startTimeUtc: "2026-03-09T04:06:00.000Z", // overlaps #4 by 2min
          endTimeUtc: "2026-03-09T04:09:00.000Z",   // 3 min total
        }),
      ];
      const result = makeCollectionResult(jobs, [makeMetric()]);

      const report = calculator.calculate(result);
      const item = report.items[0];

      // Retry: 300k (failed 5min run)
      expect(item.retryWasteCUMs).toBe(300_000);

      // Duration baseline (P50 of completed): sort durations:
      // [180k, 180k, 180k, 480k] => P50 = idx ceil(0.5*4)-1 = 1 => 180k
      expect(item.baselineDurationMs).toBe(180_000);

      // Duration waste: only the 8min run exceeds baseline (480k - 180k = 300k)
      expect(item.durationWasteCUMs).toBe(300_000);

      // Duplicate: overlap between #4 (04:00-04:08) and #5 (04:06-04:09) = 2min = 120k
      expect(item.duplicateWasteCUMs).toBe(120_000);

      // Total: 300k + 300k + 120k = 720k
      expect(item.totalWasteCUMs).toBe(720_000);
    });
  });
});
