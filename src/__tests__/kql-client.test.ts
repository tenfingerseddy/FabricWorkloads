/**
 * Tests for KqlClient — query execution, ingestion, escaping, retry logic,
 * and table provisioning.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { KqlClient } from "../kql-client.ts";
import type { FabricConfig } from "../config.ts";
import type { KqlConfig } from "../config.ts";

// ── Stubs ───────────────────────────────────────────────────────────

const stubFabricConfig: FabricConfig = {
  tenantId: "test-tenant",
  clientId: "test-client",
  clientSecret: "test-secret",
  apiBaseUrl: "https://api.test/v1",
  tokenEndpoint: "https://login.test/token",
  scope: "https://api.test/.default",
  grantType: "client_credentials",
  kqlEndpoint: "https://kql.test",
};

const stubKqlConfig: KqlConfig = {
  queryEndpoint: "https://kql.test",
  ingestionEndpoint: "https://ingest-kql.test",
  database: "TestDB",
  tokenScope: "https://kql.test/.default",
  tokenEndpoint: "https://login.test/test-tenant/oauth2/v2.0/token",
  enabled: true,
};

// ── Mock fetch helper ───────────────────────────────────────────────

function mockFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// Token response mock
const tokenResponse = {
  access_token: "mock-kql-token",
  token_type: "Bearer",
  expires_in: 3600,
};

// ── Tests ───────────────────────────────────────────────────────────

describe("KqlClient", () => {
  let client: KqlClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new KqlClient(stubFabricConfig, stubKqlConfig);
  });

  // ── escapeKql (tested via ingestion) ────────────────────────────

  describe("escapeKql security hardening", () => {
    it("strips semicolons from ingested data", async () => {
      // The escapeKql function is private, but we can test it through
      // ingestFabricEvents which calls it on itemDisplayName and failureReason
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // Ingest command
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const jobs = [
        {
          id: "job-1",
          itemId: "item-1",
          itemDisplayName: "name;with;semicolons",
          itemType: "Notebook",
          jobType: "RunNotebook",
          invokeType: "Manual",
          status: "Completed",
          failureReason: "reason;with;semicolons",
          rootActivityId: "root-1",
          startTimeUtc: "2024-01-01T00:00:00Z",
          endTimeUtc: "2024-01-01T00:10:00Z",
          workspaceId: "ws-1",
        },
      ];

      const workspaces = [
        {
          workspace: {
            id: "ws-1",
            displayName: "Test Workspace",
            state: "Active",
            capacityId: "cap-1",
          },
          items: [],
          timestamp: new Date().toISOString(),
        },
      ];

      await client.ingestFabricEvents(jobs as any, workspaces as any);

      // Token + ingest = 2 calls
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const ingestCall = fetchMock.mock.calls[1];
      const ingestBody = JSON.parse(ingestCall[1].body);

      // Semicolons should be replaced with commas in the CSL command
      expect(ingestBody.csl).not.toContain("name;with;semicolons");
      expect(ingestBody.csl).toContain("name,with,semicolons");
    });

    it("strips backticks and KQL injection markers", async () => {
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // Ingest command
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const jobs = [
        {
          id: "job-2",
          itemId: "item-2",
          itemDisplayName: "name`with`backticks",
          itemType: "Notebook",
          jobType: "RunNotebook",
          invokeType: "Manual",
          status: "Failed",
          failureReason: "error<|injection",
          rootActivityId: "root-2",
          startTimeUtc: "2024-01-01T00:00:00Z",
          endTimeUtc: "2024-01-01T00:10:00Z",
          workspaceId: "ws-1",
        },
      ];

      const workspaces = [
        {
          workspace: {
            id: "ws-1",
            displayName: "Test Workspace",
            state: "Active",
            capacityId: "cap-1",
          },
          items: [],
          timestamp: new Date().toISOString(),
        },
      ];

      await client.ingestFabricEvents(jobs as any, workspaces as any);

      const ingestCall = fetchMock.mock.calls[1];
      const ingestBody = JSON.parse(ingestCall[1].body);

      // Backticks replaced with single quotes
      expect(ingestBody.csl).not.toContain("`");
      expect(ingestBody.csl).toContain("name'with'backticks");

      // <| injection marker defused
      expect(ingestBody.csl).toContain("error< |injection");
    });
  });

  // ── Query Execution ─────────────────────────────────────────────

  describe("executeQuery", () => {
    it("sends query to /v2/rest/query with correct payload", async () => {
      const queryResult = [
        {
          FrameType: "DataTable",
          TableName: "PrimaryResult",
          Columns: [{ ColumnName: "Count", ColumnType: "long" }],
          Rows: [[42]],
        },
      ];

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        .mockResolvedValueOnce(mockFetchResponse(queryResult));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.executeQuery("FabricEvents | count");

      // Token request
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://login.test/test-tenant/oauth2/v2.0/token"
      );

      // Query request
      expect(fetchMock.mock.calls[1][0]).toBe("https://kql.test/v2/rest/query");
      const queryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(queryBody).toEqual({
        db: "TestDB",
        csl: "FabricEvents | count",
      });

      expect(result).toEqual(queryResult);
    });

    it("includes Bearer token in authorization header", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        .mockResolvedValueOnce(mockFetchResponse([]));
      vi.stubGlobal("fetch", fetchMock);

      await client.executeQuery("test");

      const headers = fetchMock.mock.calls[1][1].headers;
      expect(headers.Authorization).toBe("Bearer mock-kql-token");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  // ── Management Commands ─────────────────────────────────────────

  describe("executeManagementCommand", () => {
    it("sends command to /v1/rest/mgmt endpoint", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await client.executeManagementCommand(".show tables");

      expect(fetchMock.mock.calls[1][0]).toBe("https://kql.test/v1/rest/mgmt");
      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body).toEqual({
        db: "TestDB",
        csl: ".show tables",
      });
    });
  });

  // ── Table Provisioning ──────────────────────────────────────────

  describe("ensureTables", () => {
    it("creates FabricEvents and WorkspaceInventory tables", async () => {
      const fetchMock = vi.fn()
        // Token for first command
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // FabricEvents create
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }))
        // WorkspaceInventory create
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await client.ensureTables();

      // Should have made 3 fetch calls (1 token + 2 mgmt commands)
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // First mgmt command: FabricEvents
      const cmd1 = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(cmd1.csl).toContain(".create-merge table FabricEvents");
      expect(cmd1.csl).toContain("Timestamp: datetime");
      expect(cmd1.csl).toContain("WorkspaceId: guid");

      // Second mgmt command: WorkspaceInventory
      const cmd2 = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(cmd2.csl).toContain(".create-merge table WorkspaceInventory");
    });

    it("continues if FabricEvents creation fails", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // FabricEvents fails
        .mockResolvedValueOnce(mockFetchResponse({ error: "Forbidden" }, 403))
        // WorkspaceInventory succeeds (needs new token since first failed)
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      // Should not throw
      await client.ensureTables();
    });
  });

  // ── Retry Logic ─────────────────────────────────────────────────

  describe("retry logic", () => {
    it("retries on 429 rate limit with backoff", async () => {
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // First attempt: 429
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Too Many Requests" }, 429, {
            "Retry-After": "1",
          })
        )
        // Retry: success
        .mockResolvedValueOnce(mockFetchResponse([]));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.executeQuery("test");

      expect(result).toEqual([]);
      // Token + 2 query attempts
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 15000);

    it("retries on 500 server errors", async () => {
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // First attempt: 500
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Internal Server Error" }, 500)
        )
        // Retry: success
        .mockResolvedValueOnce(mockFetchResponse([]));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.executeQuery("test");

      expect(result).toEqual([]);
    }, 15000);

    it("throws immediately on 400 client errors", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Bad Request" }, 400)
        );
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.executeQuery("bad query")).rejects.toThrow(
        "KQL API 400"
      );

      // Should not retry — only 2 calls (token + 1 query)
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries on server errors", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // 3 attempts all fail with 500
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Server Error" }, 500)
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Server Error" }, 500)
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "Server Error" }, 500)
        );
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.executeQuery("test")).rejects.toThrow("KQL API 500");

      // Token + 3 retries
      expect(fetchMock).toHaveBeenCalledTimes(4);
    }, 30000);
  });

  // ── Token Caching ───────────────────────────────────────────────

  describe("token caching", () => {
    it("reuses cached token for subsequent requests", async () => {
      const fetchMock = vi.fn()
        // Single token request
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // First query
        .mockResolvedValueOnce(mockFetchResponse([]))
        // Second query (should reuse token, no new token fetch)
        .mockResolvedValueOnce(mockFetchResponse([]));
      vi.stubGlobal("fetch", fetchMock);

      await client.executeQuery("query1");
      await client.executeQuery("query2");

      // 1 token + 2 queries = 3 calls (not 2 tokens + 2 queries = 4)
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Both queries should use the same token
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer mock-kql-token"
      );
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        "Bearer mock-kql-token"
      );
    });
  });

  // ── Ingestion ───────────────────────────────────────────────────

  describe("ingestFabricEvents", () => {
    it("returns 0 for empty jobs array", async () => {
      const result = await client.ingestFabricEvents([], []);
      expect(result).toBe(0);
    });

    it("builds correct PSV rows from jobs", async () => {
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // Ingest command (ingestFabricEvents does NOT call ensureTables)
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const jobs = [
        {
          id: "job-1",
          itemId: "item-1",
          itemDisplayName: "MyNotebook",
          itemType: "Notebook",
          jobType: "RunNotebook",
          invokeType: "Scheduled",
          status: "Completed",
          failureReason: "",
          rootActivityId: "root-1",
          startTimeUtc: "2024-01-01T00:00:00Z",
          endTimeUtc: "2024-01-01T00:10:00Z",
          workspaceId: "ws-1",
        },
      ];

      const workspaces = [
        {
          workspace: { id: "ws-1", displayName: "ProdWS" },
          items: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const count = await client.ingestFabricEvents(
        jobs as any,
        workspaces as any
      );

      expect(count).toBe(1);

      // Verify the ingest command structure (call[0] = token, call[1] = ingest)
      const ingestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(ingestBody.csl).toContain(".ingest inline into table FabricEvents");
      expect(ingestBody.csl).toContain("<|");
      expect(ingestBody.csl).toContain("MyNotebook");
      expect(ingestBody.csl).toContain("ProdWS");
      expect(ingestBody.csl).toContain("ws-1");
      expect(ingestBody.csl).toContain("Completed");
    });

    it("batches large ingestions into groups of 100", async () => {
      const fetchMock = vi.fn()
        // Token
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        // Two batches of ingest (no ensureTables from ingestFabricEvents)
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }))
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      // Create 150 jobs to trigger 2 batches
      const jobs = Array.from({ length: 150 }, (_, i) => ({
        id: `job-${i}`,
        itemId: `item-${i}`,
        itemDisplayName: `Notebook_${i}`,
        itemType: "Notebook",
        jobType: "RunNotebook",
        invokeType: "Manual",
        status: "Completed",
        failureReason: "",
        rootActivityId: `root-${i}`,
        startTimeUtc: "2024-01-01T00:00:00Z",
        endTimeUtc: "2024-01-01T00:10:00Z",
        workspaceId: "ws-1",
      }));

      const workspaces = [
        {
          workspace: { id: "ws-1", displayName: "WS" },
          items: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const count = await client.ingestFabricEvents(
        jobs as any,
        workspaces as any
      );

      expect(count).toBe(150);
      // 1 token + 2 ingest batches = 3
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe("ingestWorkspaceInventory", () => {
    it("returns 0 when no workspace items", async () => {
      const count = await client.ingestWorkspaceInventory([]);
      expect(count).toBe(0);
    });

    it("ingests workspace inventory items", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchResponse(tokenResponse))
        .mockResolvedValueOnce(mockFetchResponse({ Tables: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const workspaces = [
        {
          workspace: {
            id: "ws-1",
            displayName: "Production",
            state: "Active",
            capacityId: "cap-1",
          },
          items: [
            { id: "item-1", displayName: "MyNotebook", type: "Notebook", description: "Test NB" },
            { id: "item-2", displayName: "MyPipeline", type: "DataPipeline", description: "" },
          ],
          timestamp: new Date().toISOString(),
        },
      ];

      const count = await client.ingestWorkspaceInventory(workspaces as any);

      expect(count).toBe(2);

      const ingestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(ingestBody.csl).toContain(
        ".ingest inline into table WorkspaceInventory"
      );
      expect(ingestBody.csl).toContain("Production");
      expect(ingestBody.csl).toContain("MyNotebook");
      expect(ingestBody.csl).toContain("MyPipeline");
    });
  });

  // ── Token Acquisition Errors ────────────────────────────────────

  describe("token acquisition errors", () => {
    it("throws on failed token acquisition", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        mockFetchResponse({ error: "invalid_client" }, 401)
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.executeQuery("test")).rejects.toThrow(
        "KQL token acquisition failed"
      );
    });
  });
});
