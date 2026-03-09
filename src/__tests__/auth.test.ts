/**
 * Tests for src/auth.ts -- FabricAuthProvider
 *
 * Validates OAuth2 client-credentials token acquisition, caching,
 * expiry handling, force-refresh, and error cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FabricAuthProvider } from "../auth.ts";
import type { FabricConfig } from "../config.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<FabricConfig>): FabricConfig {
  return {
    tenantId: "test-tenant",
    clientId: "test-client",
    clientSecret: "test-secret",
    apiBaseUrl: "https://api.fabric.microsoft.com/v1",
    tokenEndpoint: "https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token",
    scope: "https://api.fabric.microsoft.com/.default",
    grantType: "client_credentials",
    kqlEndpoint: "https://kql.test.kusto.fabric.microsoft.com",
    ...overrides,
  };
}

function makeTokenResponse(expiresIn = 3600) {
  return {
    access_token: `token-${Date.now()}`,
    token_type: "Bearer",
    expires_in: expiresIn,
    ext_expires_in: expiresIn,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("FabricAuthProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("acquires a token on first call", async () => {
    const tokenData = makeTokenResponse();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => tokenData,
    });

    const auth = new FabricAuthProvider(makeConfig());
    const token = await auth.getToken();

    expect(token).toBe(tokenData.access_token);
    expect(fetchSpy).toHaveBeenCalledOnce();

    // Verify the request was a POST with correct body
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain("/oauth2/v2.0/token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const body = new URLSearchParams(opts.body);
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("client_secret")).toBe("test-secret");
    expect(body.get("grant_type")).toBe("client_credentials");
  });

  it("returns cached token on subsequent calls within expiry window", async () => {
    const tokenData = makeTokenResponse(3600);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => tokenData,
    });

    const auth = new FabricAuthProvider(makeConfig());

    const token1 = await auth.getToken();
    const token2 = await auth.getToken();
    const token3 = await auth.getToken();

    expect(token1).toBe(token2);
    expect(token2).toBe(token3);
    // Only one fetch call — token was cached
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("refreshes token when cache expires", async () => {
    const token1Data = makeTokenResponse(1); // expires in 1 second
    const token2Data = {
      access_token: "fresh-token",
      token_type: "Bearer",
      expires_in: 3600,
    };

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => token1Data,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => token2Data,
      });

    const auth = new FabricAuthProvider(makeConfig());

    // First call acquires token
    const token1 = await auth.getToken();
    expect(token1).toBe(token1Data.access_token);

    // The token has expires_in=1s, but the provider subtracts a 2-minute buffer,
    // so the effective expiry is already in the past. The next call should refresh.
    const token2 = await auth.getToken();
    expect(token2).toBe("fresh-token");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("forceRefresh clears cache and acquires new token", async () => {
    const token1Data = makeTokenResponse(3600);
    const token2Data = {
      access_token: "forced-fresh-token",
      token_type: "Bearer",
      expires_in: 3600,
    };

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => token1Data,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => token2Data,
      });

    const auth = new FabricAuthProvider(makeConfig());

    const token1 = await auth.getToken();
    expect(token1).toBe(token1Data.access_token);

    const token2 = await auth.forceRefresh();
    expect(token2).toBe("forced-fresh-token");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws on HTTP error response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Invalid client credentials",
    });

    const auth = new FabricAuthProvider(makeConfig());

    await expect(auth.getToken()).rejects.toThrow(
      /Token acquisition failed \(401\)/
    );
  });

  it("throws on network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network unreachable"));

    const auth = new FabricAuthProvider(makeConfig());

    await expect(auth.getToken()).rejects.toThrow("Network unreachable");
  });

  it("uses correct token endpoint from config", async () => {
    const customEndpoint = "https://custom-auth.example.com/token";
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTokenResponse(),
    });

    const auth = new FabricAuthProvider(
      makeConfig({ tokenEndpoint: customEndpoint })
    );
    await auth.getToken();

    expect(fetchSpy.mock.calls[0][0]).toBe(customEndpoint);
  });

  it("uses correct scope from config", async () => {
    const customScope = "https://custom.scope/.default";
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTokenResponse(),
    });

    const auth = new FabricAuthProvider(makeConfig({ scope: customScope }));
    await auth.getToken();

    const body = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    expect(body.get("scope")).toBe(customScope);
  });

  it("includes ext_expires_in in token response without error", async () => {
    const tokenData = {
      access_token: "extended-token",
      token_type: "Bearer",
      expires_in: 3600,
      ext_expires_in: 7200,
    };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => tokenData,
    });

    const auth = new FabricAuthProvider(makeConfig());
    const token = await auth.getToken();
    expect(token).toBe("extended-token");
  });

  it("handles 500 server error from auth endpoint", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const auth = new FabricAuthProvider(makeConfig());
    await expect(auth.getToken()).rejects.toThrow(
      /Token acquisition failed \(500\)/
    );
  });

  it("retries successfully after a failed attempt", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      });

    const auth = new FabricAuthProvider(makeConfig());

    // First call fails
    await expect(auth.getToken()).rejects.toThrow(/503/);

    // Second call succeeds (cache was not populated, so it re-acquires)
    const token = await auth.getToken();
    expect(token).toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
