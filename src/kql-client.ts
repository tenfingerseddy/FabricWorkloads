/**
 * Observability Workbench - KQL Ingestion Client
 *
 * Authenticates to the Fabric Eventhouse KQL endpoint and provides:
 *  - Management command execution (.create table, .ingest inline, etc.)
 *  - KQL query execution (via /v2/rest/query)
 *  - Typed ingestion of FabricEvents and WorkspaceInventory tables
 */

import type { KqlConfig, FabricConfig } from "./config.ts";
import type { CollectionResult, WorkspaceSnapshot } from "./collector.ts";
import type { EnrichedJob } from "./fabric-client.ts";

// ── KQL Auth ──────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

class KqlAuthProvider {
  private cache: CachedToken | null = null;
  private static readonly EXPIRY_BUFFER_MS = 2 * 60 * 1000;

  constructor(
    private readonly fabricConfig: FabricConfig,
    private readonly kqlConfig: KqlConfig
  ) {}

  async getToken(): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.accessToken;
    }
    return this.acquireToken();
  }

  private async acquireToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.fabricConfig.clientId,
      client_secret: this.fabricConfig.clientSecret,
      scope: this.kqlConfig.tokenScope,
      grant_type: "client_credentials",
    });

    const response = await fetch(this.kqlConfig.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `KQL token acquisition failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as TokenResponse;

    this.cache = {
      accessToken: data.access_token,
      expiresAt:
        Date.now() +
        data.expires_in * 1000 -
        KqlAuthProvider.EXPIRY_BUFFER_MS,
    };

    return this.cache.accessToken;
  }
}

// ── KQL Response Types ────────────────────────────────────────────

interface KqlV2Frame {
  FrameType?: string;
  TableName?: string;
  Columns?: Array<{ ColumnName: string; ColumnType: string }>;
  Rows?: unknown[][];
}

interface KqlManagementResponse {
  Tables?: Array<{
    TableName: string;
    Columns: Array<{ ColumnName: string; ColumnType: string }>;
    Rows: unknown[][];
  }>;
}

// ── KQL Client ────────────────────────────────────────────────────

export class KqlClient {
  private readonly auth: KqlAuthProvider;
  private static readonly MAX_RETRIES = 3;

  constructor(
    private readonly fabricConfig: FabricConfig,
    private readonly kqlConfig: KqlConfig
  ) {
    this.auth = new KqlAuthProvider(fabricConfig, kqlConfig);
  }

  // ── Management Commands ─────────────────────────────────────────

  /**
   * Execute a KQL management command (.create table, .ingest inline, etc.)
   * Uses the /v1/rest/mgmt endpoint.
   */
  async executeManagementCommand(
    command: string
  ): Promise<KqlManagementResponse> {
    const url = `${this.kqlConfig.queryEndpoint}/v1/rest/mgmt`;
    const payload = {
      db: this.kqlConfig.database,
      csl: command,
    };

    return this.postWithRetry<KqlManagementResponse>(url, payload);
  }

  // ── Query Execution ─────────────────────────────────────────────

  /**
   * Execute a KQL query via the /v2/rest/query endpoint.
   * Returns the raw v2 frame array for flexible processing.
   */
  async executeQuery(query: string): Promise<KqlV2Frame[]> {
    const url = `${this.kqlConfig.queryEndpoint}/v2/rest/query`;
    const payload = {
      db: this.kqlConfig.database,
      csl: query,
    };

    return this.postWithRetry<KqlV2Frame[]>(url, payload);
  }

  // ── Table Provisioning ──────────────────────────────────────────

  /**
   * Ensure the FabricEvents and WorkspaceInventory tables exist.
   * Uses .create-merge table to be idempotent.
   */
  async ensureTables(): Promise<void> {
    console.log("[kql] Ensuring KQL tables exist...");

    const fabricEventsCmd = `.create-merge table FabricEvents (
  Timestamp: datetime,
  WorkspaceId: guid,
  WorkspaceName: string,
  ItemId: guid,
  ItemName: string,
  ItemType: string,
  JobInstanceId: string,
  JobType: string,
  InvokeType: string,
  Status: string,
  FailureReason: string,
  RootActivityId: guid,
  StartTimeUtc: datetime,
  EndTimeUtc: datetime,
  DurationMs: long
)`;

    const inventoryCmd = `.create-merge table WorkspaceInventory (
  Timestamp: datetime,
  WorkspaceId: guid,
  WorkspaceName: string,
  WorkspaceState: string,
  CapacityId: guid,
  ItemId: guid,
  ItemName: string,
  ItemType: string,
  ItemDescription: string
)`;

    try {
      await this.executeManagementCommand(fabricEventsCmd);
      console.log("[kql]   FabricEvents table ready");
    } catch (err: any) {
      console.warn(`[kql]   FabricEvents table creation warning: ${err.message}`);
    }

    try {
      await this.executeManagementCommand(inventoryCmd);
      console.log("[kql]   WorkspaceInventory table ready");
    } catch (err: any) {
      console.warn(
        `[kql]   WorkspaceInventory table creation warning: ${err.message}`
      );
    }
  }

  // ── Ingestion ───────────────────────────────────────────────────

  /**
   * Ingest collected events (job instances) into the FabricEvents table.
   * Uses .ingest inline for small batches; suitable for MVP volumes.
   */
  async ingestFabricEvents(
    jobs: EnrichedJob[],
    workspaces: WorkspaceSnapshot[]
  ): Promise<number> {
    if (jobs.length === 0) {
      console.log("[kql] No job events to ingest");
      return 0;
    }

    // Build workspace name lookup
    const wsNames = new Map<string, string>();
    for (const snap of workspaces) {
      wsNames.set(snap.workspace.id, snap.workspace.displayName);
    }

    const now = new Date().toISOString();

    // Ingest in batches of 100 to stay within command size limits
    const batchSize = 100;
    let totalIngested = 0;

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const rows = batch
        .map((j) => {
          const durationMs =
            j.startTimeUtc && j.endTimeUtc
              ? new Date(j.endTimeUtc).getTime() -
                new Date(j.startTimeUtc).getTime()
              : 0;

          return [
            now,
            j.workspaceId,
            escapeKql(wsNames.get(j.workspaceId) ?? j.workspaceId),
            j.itemId,
            escapeKql(j.itemDisplayName),
            j.itemType,
            j.id,
            j.jobType,
            j.invokeType,
            j.status,
            escapeKql(j.failureReason ?? ""),
            j.rootActivityId ?? "",
            j.startTimeUtc ?? "",
            j.endTimeUtc ?? "",
            String(durationMs),
          ].join(";");
        })
        .join("\n");

      const cmd = `.ingest inline into table FabricEvents <|\n${rows}`;

      try {
        await this.executeManagementCommand(cmd);
        totalIngested += batch.length;
      } catch (err: any) {
        console.warn(
          `[kql] Failed to ingest FabricEvents batch (rows ${i}-${i + batch.length}): ${err.message}`
        );
      }
    }

    console.log(
      `[kql] Ingested ${totalIngested}/${jobs.length} events into FabricEvents`
    );
    return totalIngested;
  }

  /**
   * Ingest workspace inventory into the WorkspaceInventory table.
   */
  async ingestWorkspaceInventory(
    workspaces: WorkspaceSnapshot[]
  ): Promise<number> {
    const allItems: string[] = [];
    const now = new Date().toISOString();

    for (const snap of workspaces) {
      for (const item of snap.items) {
        allItems.push(
          [
            now,
            snap.workspace.id,
            escapeKql(snap.workspace.displayName),
            snap.workspace.state ?? "",
            snap.workspace.capacityId ?? "",
            item.id,
            escapeKql(item.displayName),
            item.type,
            escapeKql(item.description ?? ""),
          ].join(";")
        );
      }
    }

    if (allItems.length === 0) {
      console.log("[kql] No inventory items to ingest");
      return 0;
    }

    // Ingest in batches
    const batchSize = 100;
    let totalIngested = 0;

    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, i + batchSize);
      const rows = batch.join("\n");
      const cmd = `.ingest inline into table WorkspaceInventory <|\n${rows}`;

      try {
        await this.executeManagementCommand(cmd);
        totalIngested += batch.length;
      } catch (err: any) {
        console.warn(
          `[kql] Failed to ingest WorkspaceInventory batch (rows ${i}-${i + batch.length}): ${err.message}`
        );
      }
    }

    console.log(
      `[kql] Ingested ${totalIngested}/${allItems.length} items into WorkspaceInventory`
    );
    return totalIngested;
  }

  /**
   * Run the full ingestion pipeline: ensure tables, then ingest events + inventory.
   */
  async ingestCollectionResult(result: CollectionResult): Promise<void> {
    console.log("\n[kql] Starting KQL ingestion...");

    await this.ensureTables();
    await this.ingestFabricEvents(result.jobs, result.workspaces);
    await this.ingestWorkspaceInventory(result.workspaces);

    console.log("[kql] KQL ingestion complete\n");
  }

  // ── HTTP plumbing ───────────────────────────────────────────────

  private async postWithRetry<T>(url: string, payload: unknown): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < KqlClient.MAX_RETRIES; attempt++) {
      const token = await this.auth.getToken();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const text = await response.text();
        return text.length > 0 ? JSON.parse(text) : ({} as T);
      }

      // Rate limited
      if (response.status === 429) {
        const retryAfter =
          parseInt(response.headers.get("Retry-After") ?? "", 10) * 1000 ||
          10_000;
        console.warn(
          `  [kql rate-limit] 429, backing off ${retryAfter}ms (attempt ${attempt + 1})`
        );
        await sleep(retryAfter);
        continue;
      }

      // Transient server errors
      if (response.status >= 500) {
        const errBody = await response.text().catch(() => "");
        lastError = new Error(
          `KQL API ${response.status}: ${errBody}`
        );
        await sleep(2000 * (attempt + 1));
        continue;
      }

      // Client errors - don't retry
      const errBody = await response.text().catch(() => "");
      throw new Error(`KQL API ${response.status}: ${errBody}`);
    }

    throw lastError ?? new Error("KQL request failed after retries");
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape a string value for KQL inline ingestion.
 * Semicolons are replaced because they serve as the column delimiter,
 * and newlines are replaced to avoid breaking the row format.
 */
function escapeKql(value: string): string {
  return value
    .replace(/;/g, ",")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}
