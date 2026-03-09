/**
 * Observability Workbench - Fabric REST API Client
 *
 * Typed client for the Microsoft Fabric REST API.
 * Handles pagination, rate limiting, and automatic token refresh.
 */

import type { FabricConfig } from "./config.ts";
import type { FabricAuthProvider } from "./auth.ts";

// ── Fabric API Types ───────────────────────────────────────────────

export interface FabricWorkspace {
  id: string;
  displayName: string;
  description?: string;
  type: string;
  state: string;
  capacityId?: string;
}

export interface FabricItem {
  id: string;
  displayName: string;
  description?: string;
  type: string;
  workspaceId: string;
}

export interface FabricJobInstance {
  id: string;
  itemId: string;
  jobType: string;
  invokeType: string;
  status: string;
  failureReason: string | null;
  rootActivityId: string;
  startTimeUtc: string;
  endTimeUtc: string | null;
}

export interface PipelineActivityRun {
  activityName: string;
  activityType: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  durationMs: number | null;
  error: Record<string, unknown> | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  activityRunId?: string;
  pipelineRunId?: string;
}

interface PaginatedResponse<T> {
  value: T[];
  continuationToken?: string | null;
  continuationUri?: string | null;
}

// ── Client ─────────────────────────────────────────────────────────

export class FabricClient {
  private readonly baseUrl: string;
  /** Max retries on transient failures / rate-limit */
  private static readonly MAX_RETRIES = 3;
  private static readonly RATE_LIMIT_BACKOFF_MS = 10_000;

  constructor(
    private readonly config: FabricConfig,
    private readonly auth: FabricAuthProvider
  ) {
    this.baseUrl = config.apiBaseUrl;
  }

  // ── Workspaces ─────────────────────────────────────────────────

  async listWorkspaces(): Promise<FabricWorkspace[]> {
    return this.getPaginated<FabricWorkspace>(`/workspaces`);
  }

  // ── Items ──────────────────────────────────────────────────────

  async listItems(
    workspaceId: string,
    type?: string
  ): Promise<FabricItem[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.getPaginated<FabricItem>(
      `/workspaces/${workspaceId}/items${query}`
    );
  }

  async getItem(
    workspaceId: string,
    itemId: string
  ): Promise<FabricItem | null> {
    try {
      return await this.request<FabricItem>(
        `/workspaces/${workspaceId}/items/${itemId}`
      );
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  }

  // ── Jobs ───────────────────────────────────────────────────────

  /**
   * Get job instances for a specific item.
   * The Fabric API path: GET /workspaces/{workspaceId}/items/{itemId}/jobs/instances
   */
  async getJobInstances(
    workspaceId: string,
    itemId: string
  ): Promise<FabricJobInstance[]> {
    try {
      return await this.getPaginated<FabricJobInstance>(
        `/workspaces/${workspaceId}/items/${itemId}/jobs/instances`
      );
    } catch (err: any) {
      // Some item types don't support jobs — swallow gracefully
      if (err?.status === 400 || err?.status === 403 || err?.status === 404) {
        return [];
      }
      throw err;
    }
  }

  // ── Pipeline Activity Runs ─────────────────────────────────────

  /**
   * Query individual activity runs within a pipeline run.
   * Uses: POST /workspaces/{workspaceId}/datapipelines/pipelineruns/{jobId}/queryactivityruns
   *
   * @param workspaceId  The workspace containing the pipeline
   * @param pipelineItemId  The pipeline item ID (used for context, not in the URL)
   * @param jobInstanceId  The pipeline job instance / run ID
   */
  async queryPipelineActivityRuns(
    workspaceId: string,
    _pipelineItemId: string,
    jobInstanceId: string
  ): Promise<PipelineActivityRun[]> {
    try {
      const path = `/workspaces/${workspaceId}/datapipelines/pipelineruns/${jobInstanceId}/queryactivityruns`;
      const response = await this.request<{ value?: RawActivityRun[] }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const rawRuns = response.value ?? [];
      return rawRuns.map((r) => this.normalizeActivityRun(r));
    } catch (err: any) {
      // Not all pipelines support this endpoint — swallow gracefully
      if (
        err?.status === 400 ||
        err?.status === 403 ||
        err?.status === 404 ||
        err?.status === 405
      ) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Normalize the raw API response into our typed PipelineActivityRun.
   * The Fabric API may use camelCase or PascalCase field names.
   */
  private normalizeActivityRun(raw: RawActivityRun): PipelineActivityRun {
    const startTime = raw.activityRunStart ?? raw.startTime ?? null;
    const endTime = raw.activityRunEnd ?? raw.endTime ?? null;

    let durationMs: number | null = null;
    if (raw.durationInMs != null) {
      durationMs = raw.durationInMs;
    } else if (startTime && endTime) {
      durationMs =
        new Date(endTime).getTime() - new Date(startTime).getTime();
    }

    return {
      activityName: raw.activityName ?? raw.ActivityName ?? "Unknown",
      activityType: raw.activityType ?? raw.ActivityType ?? "Unknown",
      status: raw.status ?? raw.Status ?? "Unknown",
      startTime,
      endTime,
      durationMs,
      error: raw.error ?? null,
      input: raw.input ?? null,
      output: raw.output ?? null,
      activityRunId: raw.activityRunId ?? raw.ActivityRunId,
      pipelineRunId: raw.pipelineRunId ?? raw.PipelineRunId,
    };
  }

  /**
   * Iterate every item in a workspace and collect all job instances.
   * Returns jobs enriched with the item's display name and type.
   */
  /** Item types that support the Jobs API */
  private static readonly JOB_ITEM_TYPES = new Set([
    "DataPipeline",
    "Notebook",
    "CopyJob",
    "Lakehouse",
    "SemanticModel",
    "Dataflow",
    "SparkJobDefinition",
    "MLExperiment",
    "MLModel",
  ]);

  async getAllJobsForWorkspace(
    workspaceId: string
  ): Promise<EnrichedJob[]> {
    const items = await this.listItems(workspaceId);
    const jobItems = items.filter((i) => FabricClient.JOB_ITEM_TYPES.has(i.type));
    const allJobs: EnrichedJob[] = [];

    for (const item of jobItems) {
      const jobs = await this.getJobInstances(workspaceId, item.id);
      for (const job of jobs) {
        allJobs.push({
          ...job,
          workspaceId,
          itemDisplayName: item.displayName,
          itemType: item.type,
        });
      }
    }

    return allJobs;
  }

  // ── HTTP plumbing ──────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < FabricClient.MAX_RETRIES; attempt++) {
      const token = await this.auth.getToken();
      const url = `${this.baseUrl}${path}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...((options.headers as Record<string, string>) ?? {}),
        },
      });

      if (response.ok) {
        const text = await response.text();
        return text.length > 0 ? JSON.parse(text) : ({} as T);
      }

      // Rate limited
      if (response.status === 429) {
        const retryAfter =
          parseInt(response.headers.get("Retry-After") ?? "", 10) * 1000 ||
          FabricClient.RATE_LIMIT_BACKOFF_MS;
        console.warn(
          `  [rate-limit] 429 on ${path}, backing off ${retryAfter}ms (attempt ${attempt + 1})`
        );
        await sleep(retryAfter);
        continue;
      }

      // Unauthorized — maybe token expired between checks
      if (response.status === 401 && attempt === 0) {
        await this.auth.forceRefresh();
        continue;
      }

      const errBody = await response.text().catch(() => "");
      const err: any = new Error(
        `Fabric API ${response.status} on ${path}: ${errBody}`
      );
      err.status = response.status;
      lastError = err;

      // Transient server errors
      if (response.status >= 500) {
        await sleep(2000 * (attempt + 1));
        continue;
      }

      throw err;
    }

    throw lastError ?? new Error(`Request failed after retries: ${path}`);
  }

  private async getPaginated<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let currentPath: string | null = path;

    while (currentPath) {
      const data = (await this.request(currentPath)) as PaginatedResponse<T>;
      if (data.value) {
        results.push(...data.value);
      }

      if (data.continuationUri) {
        // continuationUri is a full URL; strip the base to pass through request()
        currentPath = data.continuationUri.replace(this.baseUrl, "");
      } else if (data.continuationToken) {
        const separator: string = currentPath.includes("?") ? "&" : "?";
        currentPath = `${path}${separator}continuationToken=${encodeURIComponent(data.continuationToken)}`;
      } else {
        currentPath = null;
      }
    }

    return results;
  }
}

// ── Enriched job type (job + item metadata) ────────────────────────

export interface EnrichedJob extends FabricJobInstance {
  workspaceId: string;
  itemDisplayName: string;
  itemType: string;
}

// ── Raw API response shape (loosely typed) ─────────────────────────

interface RawActivityRun {
  activityName?: string;
  ActivityName?: string;
  activityType?: string;
  ActivityType?: string;
  status?: string;
  Status?: string;
  activityRunStart?: string;
  activityRunEnd?: string;
  startTime?: string;
  endTime?: string;
  durationInMs?: number;
  error?: Record<string, unknown>;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  activityRunId?: string;
  ActivityRunId?: string;
  pipelineRunId?: string;
  PipelineRunId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
