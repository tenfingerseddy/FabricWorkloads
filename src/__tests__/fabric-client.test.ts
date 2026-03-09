/**
 * Tests for FabricClient — pagination, rate limiting, error handling,
 * and JOB_ITEM_TYPES filtering.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { FabricClient } from "../fabric-client.ts";
import type { FabricAuthProvider } from "../auth.ts";
import type { FabricConfig } from "../config.ts";
import { mockItems } from "./fixtures/mock-items.ts";

// ── Stubs ───────────────────────────────────────────────────────────

const stubConfig: FabricConfig = {
  tenantId: "test-tenant",
  clientId: "test-client",
  clientSecret: "test-secret",
  apiBaseUrl: "https://api.test/v1",
  tokenEndpoint: "https://login.test/token",
  scope: "https://api.test/.default",
  grantType: "client_credentials",
  kqlEndpoint: "https://kql.test",
};

function makeStubAuth(): FabricAuthProvider {
  return {
    getToken: vi.fn().mockResolvedValue("mock-token"),
    forceRefresh: vi.fn().mockResolvedValue("refreshed-token"),
  } as unknown as FabricAuthProvider;
}

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

function mockFetchErrorResponse(
  status: number,
  body = "Error"
): Response {
  return {
    ok: false,
    status,
    headers: {
      get: () => null,
    },
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn().mockRejectedValue(new Error("not json")),
  } as unknown as Response;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("FabricClient", () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  // ── Pagination ─────────────────────────────────────────────────

  describe("pagination handling", () => {
    it("follows continuationToken across multiple pages", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // Page 1: returns 2 workspaces + continuationToken
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
            { id: "ws-2", displayName: "WS2", type: "Workspace", state: "Active" },
          ],
          continuationToken: "page2token",
        })
      );

      // Page 2: returns 1 workspace, no continuation
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-3", displayName: "WS3", type: "Workspace", state: "Active" },
          ],
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(3);
      expect(workspaces[0].id).toBe("ws-1");
      expect(workspaces[2].id).toBe("ws-3");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify the second request includes the continuationToken as a query parameter
      const secondCallUrl = fetchMock.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain("continuationToken=page2token");
    });

    it("follows continuationUri when provided", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // Page 1: uses continuationUri instead of token
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
          ],
          continuationUri: "https://api.test/v1/workspaces?page=2&token=xyz",
        })
      );

      // Page 2: no more pages
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-2", displayName: "WS2", type: "Workspace", state: "Active" },
          ],
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(2);
      // continuationUri should be stripped of baseUrl and passed to request()
      const secondCallUrl = fetchMock.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain("/workspaces?page=2&token=xyz");
    });

    it("stops paginating when no continuation is present", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
          ],
          continuationToken: null,
          continuationUri: null,
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Rate limiting ──────────────────────────────────────────────

  describe("rate limit retry logic", () => {
    it("retries on 429 and succeeds on next attempt", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // First call: 429
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({}, 429, { "Retry-After": "1" })
      );

      // Second call: success
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
          ],
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries on 401 with token refresh on first attempt", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // First call: 401 (token expired)
      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(401, "Unauthorized")
      );

      // Second call after token refresh: success
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
          ],
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(auth.forceRefresh).toHaveBeenCalledTimes(1);
    });

    it("retries on 500+ server errors with backoff", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // First call: 500
      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(502, "Bad Gateway")
      );

      // Second call: 503
      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(503, "Service Unavailable")
      );

      // Third call: success
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            { id: "ws-1", displayName: "WS1", type: "Workspace", state: "Active" },
          ],
        })
      );

      const workspaces = await client.listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("throws after exhausting all retries on server errors", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      // All 3 attempts return 500
      fetchMock.mockResolvedValue(
        mockFetchErrorResponse(500, "Internal Server Error")
      );

      await expect(client.listWorkspaces()).rejects.toThrow(/500/);
      expect(fetchMock).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });
  });

  // ── Error status code handling ─────────────────────────────────

  describe("error status code handling", () => {
    it("swallows 404 on getItem and returns null", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(404, "Not Found")
      );

      const item = await client.getItem("ws-001", "non-existent");

      expect(item).toBeNull();
    });

    it("swallows 403 on getJobInstances and returns empty array", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(403, "Forbidden")
      );

      const jobs = await client.getJobInstances("ws-001", "item-001");

      expect(jobs).toEqual([]);
    });

    it("swallows 404 on getJobInstances and returns empty array", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(404, "Not Found")
      );

      const jobs = await client.getJobInstances("ws-001", "item-001");

      expect(jobs).toEqual([]);
    });

    it("swallows 400 on getJobInstances and returns empty array", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(400, "Bad Request")
      );

      const jobs = await client.getJobInstances("ws-001", "item-001");

      expect(jobs).toEqual([]);
    });

    it("throws on non-swallowed error status codes (e.g. 409)", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchErrorResponse(409, "Conflict")
      );

      await expect(
        client.getJobInstances("ws-001", "item-001")
      ).rejects.toThrow(/409/);
    });
  });

  // ── JOB_ITEM_TYPES filtering ───────────────────────────────────

  describe("JOB_ITEM_TYPES filtering", () => {
    it("only queries jobs for supported item types", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      const ws001Items = mockItems["ws-001"]; // includes a Report which is not job-capable

      // First call: listItems returns ws-001 items
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ value: ws001Items })
      );

      // Subsequent calls: return empty jobs for each job-capable item
      // ws-001 has: DataPipeline, Notebook, Notebook, Lakehouse, SemanticModel, Report
      // Report is not in JOB_ITEM_TYPES, so only 5 job queries expected
      const jobCapableCount = ws001Items.filter((i) =>
        ["DataPipeline", "Notebook", "CopyJob", "Lakehouse", "SemanticModel",
         "Dataflow", "SparkJobDefinition", "MLExperiment", "MLModel"].includes(i.type)
      ).length;

      for (let i = 0; i < jobCapableCount; i++) {
        fetchMock.mockResolvedValueOnce(
          mockFetchResponse({ value: [] })
        );
      }

      const jobs = await client.getAllJobsForWorkspace("ws-001");

      expect(jobs).toEqual([]);
      // 1 listItems call + N getJobInstances calls (one per job-capable item)
      expect(fetchMock).toHaveBeenCalledTimes(1 + jobCapableCount);

      // Verify no call was made for the Report item
      const allUrls = fetchMock.mock.calls.map((c) => c[0] as string);
      const reportItem = ws001Items.find((i) => i.type === "Report");
      expect(reportItem).toBeDefined();
      const reportJobUrl = `/items/${reportItem!.id}/jobs/instances`;
      const hasReportCall = allUrls.some((url) => url.includes(reportJobUrl));
      expect(hasReportCall).toBe(false);
    });

    it("enriches job instances with item metadata", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      const pipelineItem = mockItems["ws-001"][0]; // DataPipeline: ETL-Daily-Load

      // listItems returns only the pipeline item
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ value: [pipelineItem] })
      );

      // getJobInstances returns one job
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            {
              id: "job-001",
              itemId: pipelineItem.id,
              jobType: "Pipeline",
              invokeType: "Scheduled",
              status: "Completed",
              failureReason: null,
              rootActivityId: "root-123",
              startTimeUtc: "2026-03-09T08:00:00Z",
              endTimeUtc: "2026-03-09T08:05:00Z",
            },
          ],
        })
      );

      const jobs = await client.getAllJobsForWorkspace("ws-001");

      expect(jobs).toHaveLength(1);
      expect(jobs[0].workspaceId).toBe("ws-001");
      expect(jobs[0].itemDisplayName).toBe("ETL-Daily-Load");
      expect(jobs[0].itemType).toBe("DataPipeline");
      expect(jobs[0].status).toBe("Completed");
    });
  });

  // ── Authorization header ───────────────────────────────────────

  describe("authorization", () => {
    it("includes Bearer token in request headers", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ value: [] })
      );

      await client.listWorkspaces();

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer mock-token");
    });
  });

  // ── Pipeline Activity Runs ─────────────────────────────────────

  describe("queryPipelineActivityRuns", () => {
    it("returns normalized activity runs from the API", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          value: [
            {
              activityName: "MyNotebook",
              activityType: "NotebookActivity",
              status: "Succeeded",
              activityRunStart: "2026-03-09T08:00:00Z",
              activityRunEnd: "2026-03-09T08:05:00Z",
              durationInMs: 300000,
            },
          ],
        })
      );

      const runs = await client.queryPipelineActivityRuns("ws-001", "item-001", "job-001");

      expect(runs).toHaveLength(1);
      expect(runs[0].activityName).toBe("MyNotebook");
      expect(runs[0].startTime).toBe("2026-03-09T08:00:00Z");
      expect(runs[0].endTime).toBe("2026-03-09T08:05:00Z");
      expect(runs[0].durationMs).toBe(300000);
    });

    it("swallows 403/404/405 and returns empty array", async () => {
      const auth = makeStubAuth();
      const client = new FabricClient(stubConfig, auth);

      fetchMock.mockResolvedValueOnce(mockFetchErrorResponse(405, "Method Not Allowed"));

      const runs = await client.queryPipelineActivityRuns("ws-001", "item-001", "job-001");

      expect(runs).toEqual([]);
    });
  });
});
