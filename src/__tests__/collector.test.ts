/**
 * Tests for the ObservabilityCollector — correlation engine and SLO metrics.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ObservabilityCollector } from "../collector.ts";
import type { AppConfig } from "../config.ts";
import type { FabricClient, EnrichedJob, PipelineActivityRun } from "../fabric-client.ts";
import { mockWorkspaces, buildWorkspaceSnapshot } from "./fixtures/mock-workspaces.ts";
import { mockItems } from "./fixtures/mock-items.ts";
import {
  resetJobCounter,
  makeJob,
  makePipelineWithChildren,
  makePipelineWithTimeOverlapChild,
  makeUnrelatedJobs,
  makeMixedStatusJobs,
  makeConsecutiveFailures,
  makePipelineActivityRuns,
} from "./fixtures/mock-jobs.ts";

// ── Minimal config stub ─────────────────────────────────────────────

const stubConfig: AppConfig = {
  fabric: {
    tenantId: "test-tenant",
    clientId: "test-client",
    clientSecret: "test-secret",
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
  },
};

// ── Build a no-op FabricClient stub (methods not used directly in unit tests) ─

function makeStubClient(): FabricClient {
  return {} as unknown as FabricClient;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("ObservabilityCollector", () => {
  let collector: ObservabilityCollector;

  beforeEach(() => {
    resetJobCounter();
    collector = new ObservabilityCollector(makeStubClient(), stubConfig);
  });

  // ── buildCorrelationMap ────────────────────────────────────────

  describe("buildCorrelationMap", () => {
    it("correlates pipeline to child notebooks via shared rootActivityId", () => {
      const { pipelineJob, notebookJob1, notebookJob2 } = makePipelineWithChildren();
      const jobs = [pipelineJob, notebookJob1, notebookJob2];

      const chains = collector.buildCorrelationMap(jobs);

      expect(chains).toHaveLength(1);
      expect(chains[0].pipelineJob.id).toBe(pipelineJob.id);
      expect(chains[0].childJobs).toHaveLength(2);

      const childIds = chains[0].childJobs.map((c) => c.id);
      expect(childIds).toContain(notebookJob1.id);
      expect(childIds).toContain(notebookJob2.id);
    });

    it("computes totalDurationMs spanning pipeline and children", () => {
      const { pipelineJob, notebookJob1, notebookJob2 } = makePipelineWithChildren();
      const jobs = [pipelineJob, notebookJob1, notebookJob2];

      const chains = collector.buildCorrelationMap(jobs);

      // Pipeline starts at 08:00, last child ends at 08:10 (pipeline end)
      // Min time = 08:00:00, Max time = 08:10:00 => 600_000ms
      expect(chains[0].totalDurationMs).toBe(600_000);
    });

    it("correlates via time-window overlap when rootActivityId does not match", () => {
      const { pipelineJob, childJob } = makePipelineWithTimeOverlapChild();
      const jobs = [pipelineJob, childJob];

      // No activity run map, no shared rootActivityId => falls back to strategy 3
      const chains = collector.buildCorrelationMap(jobs);

      expect(chains).toHaveLength(1);
      expect(chains[0].pipelineJob.id).toBe(pipelineJob.id);
      expect(chains[0].childJobs).toHaveLength(1);
      expect(chains[0].childJobs[0].id).toBe(childJob.id);
    });

    it("does NOT correlate jobs in different workspaces (no false positives)", () => {
      const { pipelineJob, unrelatedJob } = makeUnrelatedJobs();
      const jobs = [pipelineJob, unrelatedJob];

      const chains = collector.buildCorrelationMap(jobs);

      // The pipeline has no children in its own workspace and no activity runs,
      // so no chain should be produced (or if one exists, it has 0 children).
      for (const chain of chains) {
        const childIds = chain.childJobs.map((c) => c.id);
        expect(childIds).not.toContain(unrelatedJob.id);
      }
    });

    it("uses activity run data (strategy 1) to match by name", () => {
      const { pipelineJob, notebookJob1, notebookJob2 } = makePipelineWithChildren();
      const activityRuns = makePipelineActivityRuns();

      // Give them distinct rootActivityIds so strategy 2 won't match
      const pj = { ...pipelineJob, rootActivityId: "pipeline-unique" };
      const nj1 = { ...notebookJob1, rootActivityId: "nb-unique-1" };
      const nj2 = { ...notebookJob2, rootActivityId: "nb-unique-2" };

      const activityRunMap = new Map<string, PipelineActivityRun[]>();
      activityRunMap.set(pj.id, activityRuns);

      const chains = collector.buildCorrelationMap([pj, nj1, nj2], activityRunMap);

      expect(chains).toHaveLength(1);
      // Activity names "Transform-Sales-Data" and "Validate-Inventory"
      // match the notebook display names
      expect(chains[0].childJobs).toHaveLength(2);
      expect(chains[0].activityRuns).toHaveLength(2);
    });

    it("does not create a chain for a pipeline with no children and no activity runs", () => {
      const pipelineJob = makeJob({
        workspaceId: "ws-001",
        itemId: "item-pipeline-001",
        itemDisplayName: "Lonely-Pipeline",
        itemType: "DataPipeline",
        jobType: "Pipeline",
        startTimeUtc: "2026-03-09T20:00:00.000Z",
        endTimeUtc: "2026-03-09T20:05:00.000Z",
      });

      const chains = collector.buildCorrelationMap([pipelineJob]);

      expect(chains).toHaveLength(0);
    });

    it("respects the 30s tolerance window boundary", () => {
      // Pipeline: 10:00:00 to 10:05:00
      const pipelineJob = makeJob({
        workspaceId: "ws-001",
        itemId: "item-pipeline-001",
        itemDisplayName: "ETL-Pipeline",
        itemType: "DataPipeline",
        jobType: "Pipeline",
        rootActivityId: "root-only-pipeline",
        startTimeUtc: "2026-03-09T10:00:00.000Z",
        endTimeUtc: "2026-03-09T10:05:00.000Z",
      });

      // Notebook starts 29 seconds before pipeline start => within 30s tolerance
      const insideJob = makeJob({
        workspaceId: "ws-001",
        itemId: "item-notebook-001",
        itemDisplayName: "Inside-Tolerance",
        itemType: "Notebook",
        jobType: "SparkJob",
        rootActivityId: "different-root-1",
        startTimeUtc: "2026-03-09T09:59:31.000Z",
        endTimeUtc: "2026-03-09T10:03:00.000Z",
      });

      // Notebook starts 31 seconds before pipeline start => outside 30s tolerance
      const outsideJob = makeJob({
        workspaceId: "ws-001",
        itemId: "item-notebook-002",
        itemDisplayName: "Outside-Tolerance",
        itemType: "Notebook",
        jobType: "SparkJob",
        rootActivityId: "different-root-2",
        startTimeUtc: "2026-03-09T09:59:29.000Z",
        endTimeUtc: "2026-03-09T10:02:00.000Z",
      });

      const chains = collector.buildCorrelationMap([pipelineJob, insideJob, outsideJob]);

      expect(chains).toHaveLength(1);
      expect(chains[0].childJobs).toHaveLength(1);
      expect(chains[0].childJobs[0].itemDisplayName).toBe("Inside-Tolerance");
    });
  });

  // ── computeSLOMetrics ──────────────────────────────────────────

  describe("computeSLOMetrics", () => {
    it("computes correct success/fail/cancelled counts", () => {
      const jobs = makeMixedStatusJobs();
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics).toHaveLength(1);
      const m = metrics[0];
      expect(m.totalRuns).toBe(10);
      expect(m.successCount).toBe(7);
      expect(m.failedCount).toBe(2);
      expect(m.cancelledCount).toBe(1);
    });

    it("computes correct success rate", () => {
      const jobs = makeMixedStatusJobs();
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      // 7 out of 10 => 0.7
      expect(metrics[0].successRate).toBe(0.7);
    });

    it("computes duration percentiles correctly", () => {
      const jobs = makeMixedStatusJobs();
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);
      const m = metrics[0];

      // All jobs have durations, sorted ascending:
      // 30s, 120s, 180s, 240s, 240s, 300s, 300s, 360s, 60s, 600s
      // Let's compute expected values. Durations in ms (endTime - startTime):
      //   01:00->01:05 = 300_000
      //   02:00->02:03 = 180_000
      //   03:00->03:04 = 240_000
      //   04:00->04:10 = 600_000
      //   05:00->05:02 = 120_000
      //   06:00->06:06 = 360_000
      //   07:00->07:01 = 60_000
      //   08:00->08:04 = 240_000
      //   09:00->09:00:30 = 30_000
      //   10:00->10:05 = 300_000
      // Sorted: [30000, 60000, 120000, 180000, 240000, 240000, 300000, 300000, 360000, 600000]
      // p50: ceil(0.5 * 10) - 1 = 4 => 240000
      // p95: ceil(0.95 * 10) - 1 = 9 => 600000
      expect(m.p50DurationMs).toBe(240_000);
      expect(m.p95DurationMs).toBe(600_000);
      expect(m.maxDurationMs).toBe(600_000);
    });

    it("computes average duration", () => {
      const jobs = makeMixedStatusJobs();
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);
      const m = metrics[0];

      // Sum: 300k + 180k + 240k + 600k + 120k + 360k + 60k + 240k + 30k + 300k = 2_430_000
      // Average: 2_430_000 / 10 = 243_000
      expect(m.avgDurationMs).toBe(243_000);
    });

    it("returns zero metrics for empty job list", () => {
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics([], [ws]);

      expect(metrics).toHaveLength(0);
    });

    it("handles all-success jobs (success rate = 1.0)", () => {
      const jobs = [
        makeJob({ status: "Completed", startTimeUtc: "2026-03-09T01:00:00Z", endTimeUtc: "2026-03-09T01:05:00Z" }),
        makeJob({ status: "Completed", startTimeUtc: "2026-03-09T02:00:00Z", endTimeUtc: "2026-03-09T02:05:00Z" }),
      ];
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics[0].successRate).toBe(1.0);
      expect(metrics[0].failedCount).toBe(0);
    });

    it("handles all-failure jobs (success rate = 0.0)", () => {
      const jobs = makeConsecutiveFailures(5);
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics[0].successRate).toBe(0);
      expect(metrics[0].successCount).toBe(0);
      expect(metrics[0].failedCount).toBe(5);
    });

    it("resolves workspace name from snapshot", () => {
      const jobs = [makeJob({ workspaceId: "ws-001" })];
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics[0].workspaceName).toBe("Analytics-Production");
    });

    it("falls back to workspaceId when workspace name is not found", () => {
      const jobs = [makeJob({ workspaceId: "ws-unknown" })];
      // No matching workspace snapshot
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics[0].workspaceName).toBe("ws-unknown");
    });

    it("tracks lastRunUtc and lastSuccessUtc correctly", () => {
      const jobs = [
        makeJob({ status: "Completed", startTimeUtc: "2026-03-09T01:00:00.000Z", endTimeUtc: "2026-03-09T01:05:00.000Z" }),
        makeJob({ status: "Failed", startTimeUtc: "2026-03-09T03:00:00.000Z", endTimeUtc: "2026-03-09T03:05:00.000Z" }),
        makeJob({ status: "Completed", startTimeUtc: "2026-03-09T02:00:00.000Z", endTimeUtc: "2026-03-09T02:05:00.000Z" }),
      ];
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      // Most recent start: 03:00
      expect(metrics[0].lastRunUtc).toBe("2026-03-09T03:00:00.000Z");
      // Most recent success (sorted by start): 02:00 (Completed), its endTime
      expect(metrics[0].lastSuccessUtc).toBe("2026-03-09T02:05:00.000Z");
    });

    it("groups metrics by workspaceId + itemId", () => {
      const jobs = [
        makeJob({ workspaceId: "ws-001", itemId: "item-pipeline-001", status: "Completed" }),
        makeJob({ workspaceId: "ws-001", itemId: "item-pipeline-001", status: "Failed" }),
        makeJob({ workspaceId: "ws-001", itemId: "item-notebook-001", itemDisplayName: "Transform-Sales-Data", itemType: "Notebook", status: "Completed" }),
      ];
      const ws = buildWorkspaceSnapshot(mockWorkspaces[0], mockItems["ws-001"]);

      const metrics = collector.computeSLOMetrics(jobs, [ws]);

      expect(metrics).toHaveLength(2);
      const pipelineMetric = metrics.find((m) => m.itemId === "item-pipeline-001");
      const notebookMetric = metrics.find((m) => m.itemId === "item-notebook-001");

      expect(pipelineMetric?.totalRuns).toBe(2);
      expect(notebookMetric?.totalRuns).toBe(1);
    });
  });
});
