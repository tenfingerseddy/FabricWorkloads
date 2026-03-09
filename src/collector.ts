/**
 * Observability Workbench - Data Collector
 *
 * Orchestrates data collection from the Fabric API:
 *  - Workspace inventory
 *  - Item catalog per workspace
 *  - Job execution history
 *  - Correlation mapping (pipeline --> notebook chains)
 *  - SLO metric computation
 */

import type { FabricClient, EnrichedJob, FabricItem, FabricWorkspace, PipelineActivityRun } from "./fabric-client.ts";
import type { AppConfig } from "./config.ts";

// ── Collected data model ───────────────────────────────────────────

export interface WorkspaceSnapshot {
  workspace: FabricWorkspace;
  items: FabricItem[];
  collectedAt: string;
}

export interface CollectionResult {
  timestamp: string;
  workspaces: WorkspaceSnapshot[];
  jobs: EnrichedJob[];
  correlations: CorrelationChain[];
  sloMetrics: SLOMetricSet[];
}

export interface CorrelationChain {
  /** The root pipeline job */
  pipelineJob: EnrichedJob;
  /** Notebook / Spark jobs that overlap in time or share rootActivityId */
  childJobs: EnrichedJob[];
  /** Individual activity runs within the pipeline (from Activity Runs API) */
  activityRuns: PipelineActivityRun[];
  totalDurationMs: number;
}

export interface SLOMetricSet {
  workspaceId: string;
  workspaceName: string;
  itemId: string;
  itemName: string;
  itemType: string;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  lastRunUtc: string | null;
  lastSuccessUtc: string | null;
  freshnessHours: number | null;
}

// ── Collector ──────────────────────────────────────────────────────

export class ObservabilityCollector {
  constructor(
    private readonly client: FabricClient,
    private readonly config: AppConfig
  ) {}

  /**
   * Run a full collection cycle: discover workspaces, collect items and jobs,
   * build correlations, compute SLO metrics.
   */
  async collect(): Promise<CollectionResult> {
    const timestamp = new Date().toISOString();
    console.log(`\n[collector] Starting collection at ${timestamp}`);

    // 1. Discover workspaces
    const workspaceSnapshots = await this.collectAllWorkspaces();

    // 2. Collect jobs for every workspace
    const allJobs: EnrichedJob[] = [];
    for (const ws of workspaceSnapshots) {
      const jobs = await this.collectJobHistory(ws.workspace.id);
      allJobs.push(...jobs);
    }

    console.log(`[collector] Collected ${allJobs.length} total job instances`);

    // 2b. Query pipeline activity runs for each pipeline job
    const pipelineJobs = allJobs.filter((j) => j.itemType === "DataPipeline");
    console.log(
      `[collector] Querying activity runs for ${pipelineJobs.length} pipeline job(s)...`
    );

    const activityRunMap = new Map<string, PipelineActivityRun[]>();
    for (const pj of pipelineJobs) {
      try {
        const activities = await this.client.queryPipelineActivityRuns(
          pj.workspaceId,
          pj.itemId,
          pj.id
        );
        if (activities.length > 0) {
          activityRunMap.set(pj.id, activities);
          console.log(
            `[collector]   ${pj.itemDisplayName} (${pj.id}): ${activities.length} activity run(s)`
          );
        }
      } catch (err: any) {
        console.warn(
          `[collector]   Failed to get activity runs for ${pj.itemDisplayName}: ${err.message}`
        );
      }
    }
    console.log(
      `[collector] Retrieved activity runs for ${activityRunMap.size} pipeline job(s)`
    );

    // 3. Build correlation chains (enriched with activity runs)
    const correlations = this.buildCorrelationMap(allJobs, activityRunMap);
    console.log(
      `[collector] Built ${correlations.length} correlation chains`
    );

    // 4. Compute SLO metrics
    const sloMetrics = this.computeSLOMetrics(allJobs, workspaceSnapshots);
    console.log(
      `[collector] Computed SLO metrics for ${sloMetrics.length} items`
    );

    return { timestamp, workspaces: workspaceSnapshots, jobs: allJobs, correlations, sloMetrics };
  }

  // ── Workspace discovery ────────────────────────────────────────

  async collectAllWorkspaces(): Promise<WorkspaceSnapshot[]> {
    console.log("[collector] Discovering workspaces...");
    const workspaces = await this.client.listWorkspaces();
    console.log(`[collector] Found ${workspaces.length} workspace(s)`);

    const snapshots: WorkspaceSnapshot[] = [];
    for (const ws of workspaces) {
      console.log(`[collector]   Scanning workspace: ${ws.displayName}`);
      try {
        const items = await this.client.listItems(ws.id);
        console.log(`[collector]     ${items.length} item(s)`);
        snapshots.push({
          workspace: ws,
          items,
          collectedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.warn(
          `[collector]     Failed to list items for ${ws.displayName}: ${err.message}`
        );
        snapshots.push({
          workspace: ws,
          items: [],
          collectedAt: new Date().toISOString(),
        });
      }
    }

    return snapshots;
  }

  // ── Job history collection ─────────────────────────────────────

  async collectJobHistory(workspaceId: string): Promise<EnrichedJob[]> {
    console.log(`[collector] Collecting jobs for workspace ${workspaceId}...`);
    try {
      const jobs = await this.client.getAllJobsForWorkspace(workspaceId);
      console.log(`[collector]   ${jobs.length} job instance(s)`);
      return jobs;
    } catch (err: any) {
      console.warn(
        `[collector]   Failed to collect jobs for workspace ${workspaceId}: ${err.message}`
      );
      return [];
    }
  }

  // ── Correlation map ────────────────────────────────────────────

  /**
   * Builds correlation chains linking pipeline runs to their child
   * notebook / Spark job runs. Three strategies are used:
   *
   *   1. Activity run data from the Pipeline Activity Runs API (strongest signal)
   *   2. Matching rootActivityId
   *   3. Overlapping time windows within the same workspace (fallback)
   */
  buildCorrelationMap(
    jobs: EnrichedJob[],
    activityRunMap?: Map<string, PipelineActivityRun[]>
  ): CorrelationChain[] {
    const pipelineJobs = jobs.filter((j) => j.jobType === "Pipeline");
    const nonPipelineJobs = jobs.filter((j) => j.jobType !== "Pipeline");

    // Index non-pipeline jobs by rootActivityId for fast lookup
    const byRootActivity = new Map<string, EnrichedJob[]>();
    for (const j of nonPipelineJobs) {
      if (j.rootActivityId) {
        const existing = byRootActivity.get(j.rootActivityId) ?? [];
        existing.push(j);
        byRootActivity.set(j.rootActivityId, existing);
      }
    }

    const chains: CorrelationChain[] = [];
    const claimedJobIds = new Set<string>();

    for (const pj of pipelineJobs) {
      const children: EnrichedJob[] = [];
      const activityRuns = activityRunMap?.get(pj.id) ?? [];

      // Strategy 1: Use activity run data to find child jobs by matching
      // activity names to item display names
      if (activityRuns.length > 0) {
        for (const activity of activityRuns) {
          // Try to match activity to a known non-pipeline job by name
          for (const nj of nonPipelineJobs) {
            if (claimedJobIds.has(nj.id)) continue;
            if (nj.workspaceId !== pj.workspaceId) continue;

            // Match if the activity name references the item display name
            const nameMatch =
              activity.activityName === nj.itemDisplayName ||
              activity.activityName.includes(nj.itemDisplayName) ||
              nj.itemDisplayName.includes(activity.activityName);

            // Also check time overlap between activity and job
            let timeOverlap = false;
            if (activity.startTime && nj.startTimeUtc) {
              const aStart = new Date(activity.startTime).getTime();
              const nStart = new Date(nj.startTimeUtc).getTime();
              const tolerance = 60_000; // 1 minute tolerance
              timeOverlap = Math.abs(aStart - nStart) < tolerance;
            }

            if (nameMatch || timeOverlap) {
              children.push(nj);
              claimedJobIds.add(nj.id);
            }
          }
        }
      }

      // Strategy 2: rootActivityId match
      if (pj.rootActivityId) {
        const byRoot = byRootActivity.get(pj.rootActivityId) ?? [];
        for (const child of byRoot) {
          if (claimedJobIds.has(child.id)) continue;
          if (child.workspaceId === pj.workspaceId) {
            children.push(child);
            claimedJobIds.add(child.id);
          }
        }
      }

      // Strategy 3: overlapping time window within same workspace (fallback)
      if (children.length === 0 && pj.startTimeUtc && pj.endTimeUtc) {
        const pStart = new Date(pj.startTimeUtc).getTime();
        const pEnd = new Date(pj.endTimeUtc).getTime();

        for (const nj of nonPipelineJobs) {
          if (claimedJobIds.has(nj.id)) continue;
          if (nj.workspaceId !== pj.workspaceId) continue;
          if (!nj.startTimeUtc) continue;

          const nStart = new Date(nj.startTimeUtc).getTime();

          // Check overlap: child started during pipeline window (with 30s tolerance)
          const tolerance = 30_000;
          if (nStart >= pStart - tolerance && nStart <= pEnd + tolerance) {
            children.push(nj);
            claimedJobIds.add(nj.id);
          }
        }
      }

      // Build chain if we have children OR activity runs
      if (children.length > 0 || activityRuns.length > 0) {
        const allTimes = [pj, ...children]
          .flatMap((j) => [
            j.startTimeUtc ? new Date(j.startTimeUtc).getTime() : null,
            j.endTimeUtc ? new Date(j.endTimeUtc).getTime() : null,
          ])
          .filter((t): t is number => t !== null);

        const totalDurationMs =
          allTimes.length >= 2 ? Math.max(...allTimes) - Math.min(...allTimes) : 0;

        chains.push({
          pipelineJob: pj,
          childJobs: children,
          activityRuns,
          totalDurationMs,
        });
      }
    }

    return chains;
  }

  // ── SLO Metrics ────────────────────────────────────────────────

  computeSLOMetrics(
    jobs: EnrichedJob[],
    workspaces: WorkspaceSnapshot[]
  ): SLOMetricSet[] {
    // Group jobs by workspaceId + itemId
    const grouped = new Map<string, EnrichedJob[]>();
    for (const j of jobs) {
      const key = `${j.workspaceId}::${j.itemId}`;
      const arr = grouped.get(key) ?? [];
      arr.push(j);
      grouped.set(key, arr);
    }

    // Build a workspace name lookup
    const wsNames = new Map<string, string>();
    for (const snap of workspaces) {
      wsNames.set(snap.workspace.id, snap.workspace.displayName);
    }

    const metrics: SLOMetricSet[] = [];

    for (const [key, itemJobs] of grouped) {
      const [workspaceId] = key.split("::");
      const sample = itemJobs[0];

      // Compute durations for completed jobs
      const durations: number[] = [];
      for (const j of itemJobs) {
        if (j.startTimeUtc && j.endTimeUtc) {
          durations.push(
            new Date(j.endTimeUtc).getTime() -
              new Date(j.startTimeUtc).getTime()
          );
        }
      }
      durations.sort((a, b) => a - b);

      const successCount = itemJobs.filter(
        (j) => j.status === "Completed"
      ).length;
      const failedCount = itemJobs.filter(
        (j) => j.status === "Failed"
      ).length;
      const cancelledCount = itemJobs.filter(
        (j) => j.status === "Cancelled"
      ).length;
      const totalRuns = itemJobs.length;

      // Last run / last success timestamps
      const sortedByStart = [...itemJobs]
        .filter((j) => j.startTimeUtc)
        .sort(
          (a, b) =>
            new Date(b.startTimeUtc).getTime() -
            new Date(a.startTimeUtc).getTime()
        );
      const lastRunUtc = sortedByStart[0]?.startTimeUtc ?? null;

      const lastSuccess = sortedByStart.find(
        (j) => j.status === "Completed"
      );
      const lastSuccessUtc = lastSuccess?.endTimeUtc ?? lastSuccess?.startTimeUtc ?? null;

      // Freshness: hours since last successful completion
      let freshnessHours: number | null = null;
      if (lastSuccessUtc) {
        freshnessHours =
          (Date.now() - new Date(lastSuccessUtc).getTime()) / (1000 * 60 * 60);
        freshnessHours = Math.round(freshnessHours * 100) / 100;
      }

      metrics.push({
        workspaceId,
        workspaceName: wsNames.get(workspaceId) ?? workspaceId,
        itemId: sample.itemId,
        itemName: sample.itemDisplayName,
        itemType: sample.itemType,
        totalRuns,
        successCount,
        failedCount,
        cancelledCount,
        successRate: totalRuns > 0 ? successCount / totalRuns : 0,
        avgDurationMs: durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
        p50DurationMs: percentile(durations, 0.5),
        p95DurationMs: percentile(durations, 0.95),
        maxDurationMs: durations.length > 0 ? durations[durations.length - 1] : 0,
        lastRunUtc,
        lastSuccessUtc,
        freshnessHours,
      });
    }

    // Sort by workspace name, then item name
    metrics.sort((a, b) => {
      const wsCmp = a.workspaceName.localeCompare(b.workspaceName);
      return wsCmp !== 0 ? wsCmp : a.itemName.localeCompare(b.itemName);
    });

    return metrics;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
