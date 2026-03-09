/**
 * Tests for the AlertEngine — SLO breach, duration regression,
 * and consecutive failure detection.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AlertEngine } from "../alerts.ts";
import type { Alert } from "../alerts.ts";
import type { CollectionResult, SLOMetricSet, CorrelationChain } from "../collector.ts";
import type { AppConfig } from "../config.ts";
import type { EnrichedJob } from "../fabric-client.ts";
import {
  resetJobCounter,
  makeJob,
  makeMixedStatusJobs,
  makeConsecutiveFailures,
} from "./fixtures/mock-jobs.ts";

// ── Config with specific SLO thresholds ─────────────────────────────

function makeConfig(overrides: Partial<AppConfig["slo"]> = {}): AppConfig {
  return {
    fabric: {
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      apiBaseUrl: "https://api.test",
      tokenEndpoint: "https://login.test/token",
      scope: "https://api.test/.default",
      grantType: "client_credentials",
      kqlEndpoint: "https://kql.test",
    },
    kql: {
      queryEndpoint: "https://kql.test",
      ingestionEndpoint: "https://ingest.test",
      database: "TestDB",
      tokenScope: "https://kql.test/.default",
      tokenEndpoint: "https://login.test/token",
      enabled: false,
    },
    knownWorkspaces: [],
    dataDir: "/tmp/test-data",
    pollIntervalMs: 60_000,
    slo: {
      minSuccessRate: 0.95,
      durationRegressionMultiplier: 2.0,
      maxFreshnessHours: 24,
      ...overrides,
    },
  };
}

// ── Helpers to build CollectionResult ────────────────────────────────

function makeCollectionResult(
  sloMetrics: SLOMetricSet[],
  jobs: EnrichedJob[] = []
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

// ── Tests ───────────────────────────────────────────────────────────

describe("AlertEngine", () => {
  beforeEach(() => {
    resetJobCounter();
  });

  // ── Success rate violation ─────────────────────────────────────

  describe("success rate violation", () => {
    it("triggers warning when success rate is below SLO threshold", () => {
      const engine = new AlertEngine(makeConfig({ minSuccessRate: 0.95 }));
      const metric = makeMetric({ successRate: 0.8, totalRuns: 10 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const sloAlerts = alerts.filter((a) => a.kind === "success_rate_violation");
      expect(sloAlerts).toHaveLength(1);
      expect(sloAlerts[0].severity).toBe("warning");
      expect(sloAlerts[0].value).toBe(0.8);
      expect(sloAlerts[0].threshold).toBe(0.95);
    });

    it("triggers critical when success rate is below 80% of threshold", () => {
      const engine = new AlertEngine(makeConfig({ minSuccessRate: 0.95 }));
      // 80% of 0.95 = 0.76 => below that is critical
      const metric = makeMetric({ successRate: 0.5, totalRuns: 10 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const sloAlerts = alerts.filter((a) => a.kind === "success_rate_violation");
      expect(sloAlerts).toHaveLength(1);
      expect(sloAlerts[0].severity).toBe("critical");
    });

    it("does NOT trigger when success rate meets threshold", () => {
      const engine = new AlertEngine(makeConfig({ minSuccessRate: 0.95 }));
      const metric = makeMetric({ successRate: 0.96, totalRuns: 10 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const sloAlerts = alerts.filter((a) => a.kind === "success_rate_violation");
      expect(sloAlerts).toHaveLength(0);
    });

    it("does NOT trigger when totalRuns < 3 (insufficient data)", () => {
      const engine = new AlertEngine(makeConfig({ minSuccessRate: 0.95 }));
      const metric = makeMetric({ successRate: 0.0, totalRuns: 2 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const sloAlerts = alerts.filter((a) => a.kind === "success_rate_violation");
      expect(sloAlerts).toHaveLength(0);
    });
  });

  // ── Duration regression ────────────────────────────────────────

  describe("duration regression", () => {
    it("triggers warning when P95 exceeds 2x baseline", () => {
      const engine = new AlertEngine(makeConfig({ durationRegressionMultiplier: 2.0 }));
      // Current P95: 600s, Baseline P95: 200s => 3x
      const metric = makeMetric({ p95DurationMs: 600_000 });
      const baseline = makeMetric({ p95DurationMs: 200_000 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result, [baseline]);

      const durationAlerts = alerts.filter((a) => a.kind === "duration_regression");
      expect(durationAlerts).toHaveLength(1);
      expect(durationAlerts[0].severity).toBe("warning"); // 3x is not > 3 (strict), so warning
      expect(durationAlerts[0].value).toBe(600_000);
    });

    it("triggers warning (not critical) when regression is between 2x and 3x", () => {
      const engine = new AlertEngine(makeConfig({ durationRegressionMultiplier: 2.0 }));
      // Current P95: 500s, Baseline P95: 200s => 2.5x
      const metric = makeMetric({ p95DurationMs: 500_000 });
      const baseline = makeMetric({ p95DurationMs: 200_000 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result, [baseline]);

      const durationAlerts = alerts.filter((a) => a.kind === "duration_regression");
      expect(durationAlerts).toHaveLength(1);
      expect(durationAlerts[0].severity).toBe("warning");
    });

    it("does NOT trigger when P95 is within multiplier of baseline", () => {
      const engine = new AlertEngine(makeConfig({ durationRegressionMultiplier: 2.0 }));
      // Current P95: 350s, Baseline P95: 200s => 1.75x (below 2x)
      const metric = makeMetric({ p95DurationMs: 350_000 });
      const baseline = makeMetric({ p95DurationMs: 200_000 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result, [baseline]);

      const durationAlerts = alerts.filter((a) => a.kind === "duration_regression");
      expect(durationAlerts).toHaveLength(0);
    });

    it("does NOT trigger when no baseline is provided", () => {
      const engine = new AlertEngine(makeConfig({ durationRegressionMultiplier: 2.0 }));
      const metric = makeMetric({ p95DurationMs: 600_000 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result); // no baseline

      const durationAlerts = alerts.filter((a) => a.kind === "duration_regression");
      expect(durationAlerts).toHaveLength(0);
    });

    it("does NOT trigger when baseline P95 is zero", () => {
      const engine = new AlertEngine(makeConfig({ durationRegressionMultiplier: 2.0 }));
      const metric = makeMetric({ p95DurationMs: 600_000 });
      const baseline = makeMetric({ p95DurationMs: 0 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result, [baseline]);

      const durationAlerts = alerts.filter((a) => a.kind === "duration_regression");
      expect(durationAlerts).toHaveLength(0);
    });
  });

  // ── Consecutive failures ───────────────────────────────────────

  describe("consecutive failure detection", () => {
    it("triggers warning alert for 3 consecutive failures", () => {
      const engine = new AlertEngine(makeConfig());
      const jobs = makeConsecutiveFailures(3);
      const metric = makeMetric({
        totalRuns: 3,
        successCount: 0,
        failedCount: 3,
        successRate: 0,
      });
      const result = makeCollectionResult([metric], jobs);

      const alerts = engine.evaluate(result);

      const failAlerts = alerts.filter((a) => a.kind === "consecutive_failures");
      expect(failAlerts).toHaveLength(1);
      expect(failAlerts[0].severity).toBe("warning");
      expect(failAlerts[0].value).toBe(3);
    });

    it("triggers critical alert for 5+ consecutive failures", () => {
      const engine = new AlertEngine(makeConfig());
      const jobs = makeConsecutiveFailures(6);
      const metric = makeMetric({
        totalRuns: 6,
        successCount: 0,
        failedCount: 6,
        successRate: 0,
      });
      const result = makeCollectionResult([metric], jobs);

      const alerts = engine.evaluate(result);

      const failAlerts = alerts.filter((a) => a.kind === "consecutive_failures");
      expect(failAlerts).toHaveLength(1);
      expect(failAlerts[0].severity).toBe("critical");
      expect(failAlerts[0].value).toBe(6);
    });

    it("does NOT trigger when failures are interrupted by a success", () => {
      const engine = new AlertEngine(makeConfig());
      // 2 failures, then 1 success, then 2 more failures
      // Sorted by startTimeUtc desc, the most recent should be 2 failures then success
      const jobs = [
        makeJob({ status: "Failed", startTimeUtc: "2026-03-09T05:00:00Z", endTimeUtc: "2026-03-09T05:05:00Z" }),
        makeJob({ status: "Failed", startTimeUtc: "2026-03-09T04:00:00Z", endTimeUtc: "2026-03-09T04:05:00Z" }),
        makeJob({ status: "Completed", startTimeUtc: "2026-03-09T03:00:00Z", endTimeUtc: "2026-03-09T03:05:00Z" }),
        makeJob({ status: "Failed", startTimeUtc: "2026-03-09T02:00:00Z", endTimeUtc: "2026-03-09T02:05:00Z" }),
        makeJob({ status: "Failed", startTimeUtc: "2026-03-09T01:00:00Z", endTimeUtc: "2026-03-09T01:05:00Z" }),
      ];
      const metric = makeMetric({
        totalRuns: 5,
        successCount: 1,
        failedCount: 4,
        successRate: 0.2,
      });
      const result = makeCollectionResult([metric], jobs);

      const alerts = engine.evaluate(result);

      const failAlerts = alerts.filter((a) => a.kind === "consecutive_failures");
      // Only 2 consecutive from the top => below threshold of 3
      expect(failAlerts).toHaveLength(0);
    });
  });

  // ── Freshness violation ────────────────────────────────────────

  describe("freshness violation", () => {
    it("triggers warning when freshness exceeds maxFreshnessHours", () => {
      const engine = new AlertEngine(makeConfig({ maxFreshnessHours: 24 }));
      const metric = makeMetric({ freshnessHours: 30 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const freshAlerts = alerts.filter((a) => a.kind === "freshness_violation");
      expect(freshAlerts).toHaveLength(1);
      expect(freshAlerts[0].severity).toBe("warning");
    });

    it("triggers critical when freshness exceeds 2x maxFreshnessHours", () => {
      const engine = new AlertEngine(makeConfig({ maxFreshnessHours: 24 }));
      const metric = makeMetric({ freshnessHours: 50 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const freshAlerts = alerts.filter((a) => a.kind === "freshness_violation");
      expect(freshAlerts).toHaveLength(1);
      expect(freshAlerts[0].severity).toBe("critical");
    });

    it("does NOT trigger when freshness is within limit", () => {
      const engine = new AlertEngine(makeConfig({ maxFreshnessHours: 24 }));
      const metric = makeMetric({ freshnessHours: 12 });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const freshAlerts = alerts.filter((a) => a.kind === "freshness_violation");
      expect(freshAlerts).toHaveLength(0);
    });
  });

  // ── No recent runs ─────────────────────────────────────────────

  describe("no recent runs", () => {
    it("triggers info alert for runnable items with no runs", () => {
      const engine = new AlertEngine(makeConfig());
      const metric = makeMetric({
        totalRuns: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        lastRunUtc: null,
        itemType: "Notebook",
      });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const noRunAlerts = alerts.filter((a) => a.kind === "no_recent_runs");
      expect(noRunAlerts).toHaveLength(1);
      expect(noRunAlerts[0].severity).toBe("info");
    });

    it("does NOT trigger for non-runnable item types", () => {
      const engine = new AlertEngine(makeConfig());
      const metric = makeMetric({
        totalRuns: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        lastRunUtc: null,
        itemType: "SemanticModel", // not in the runnable list
      });
      const result = makeCollectionResult([metric]);

      const alerts = engine.evaluate(result);

      const noRunAlerts = alerts.filter((a) => a.kind === "no_recent_runs");
      expect(noRunAlerts).toHaveLength(0);
    });
  });

  // ── Alert ordering ─────────────────────────────────────────────

  describe("alert ordering", () => {
    it("sorts alerts by severity: critical first, then warning, then info", () => {
      const engine = new AlertEngine(makeConfig({ minSuccessRate: 0.95, maxFreshnessHours: 24 }));
      const metrics = [
        // Will produce a "no_recent_runs" info alert
        makeMetric({
          itemId: "item-1",
          itemName: "Item-A",
          totalRuns: 0,
          successCount: 0,
          failedCount: 0,
          successRate: 0,
          lastRunUtc: null,
          itemType: "Pipeline",
          freshnessHours: null,
        }),
        // Will produce a success_rate_violation warning
        makeMetric({
          itemId: "item-2",
          itemName: "Item-B",
          totalRuns: 10,
          successRate: 0.85,
          freshnessHours: 2,
        }),
        // Will produce a freshness critical (50h > 2 * 24h)
        makeMetric({
          itemId: "item-3",
          itemName: "Item-C",
          totalRuns: 10,
          successRate: 0.99,
          freshnessHours: 50,
        }),
      ];
      const result = makeCollectionResult(metrics);

      const alerts = engine.evaluate(result);

      // Verify that critical comes before warning, and warning before info
      const severities = alerts.map((a) => a.severity);
      const criticalIdx = severities.indexOf("critical");
      const warningIdx = severities.indexOf("warning");
      const infoIdx = severities.indexOf("info");

      if (criticalIdx !== -1 && warningIdx !== -1) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
      if (warningIdx !== -1 && infoIdx !== -1) {
        expect(warningIdx).toBeLessThan(infoIdx);
      }
    });
  });
});
