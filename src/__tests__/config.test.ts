/**
 * Tests for config.ts — environment variable loading, validation, and defaults.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../config.ts";
import type { AppConfig } from "../config.ts";

// ── Helpers ─────────────────────────────────────────────────────────

/** Minimal env vars needed for loadConfig to succeed */
const REQUIRED_ENV = {
  FABRIC_TENANT_ID: "test-tenant-id",
  FABRIC_CLIENT_ID: "test-client-id",
  FABRIC_CLIENT_SECRET: "test-secret",
  EVENTHOUSE_QUERY_ENDPOINT: "https://kql.test.kusto.fabric.microsoft.com",
  EVENTHOUSE_INGESTION_ENDPOINT: "https://ingest-kql.test.kusto.fabric.microsoft.com",
};

/** Save and restore env vars around each test */
let savedEnv: Record<string, string | undefined>;

function setEnv(vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }
}

function clearEnv(...keys: string[]): void {
  for (const key of keys) {
    delete process.env[key];
  }
}

describe("Config", () => {
  beforeEach(() => {
    // Save current env
    savedEnv = {};
    const allKeys = [
      ...Object.keys(REQUIRED_ENV),
      "KQL_QUERY_ENDPOINT",
      "KQL_INGESTION_ENDPOINT",
      "KQL_DATABASE",
      "KQL_ENABLED",
    ];
    for (const key of allKeys) {
      savedEnv[key] = process.env[key];
    }
    // Clear all config env vars
    clearEnv(...allKeys);
  });

  afterEach(() => {
    // Restore env
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  // ── Required env var validation ────────────────────────────────

  describe("required environment variables", () => {
    it("throws when FABRIC_TENANT_ID is missing", () => {
      setEnv({ ...REQUIRED_ENV });
      clearEnv("FABRIC_TENANT_ID");
      expect(() => loadConfig()).toThrow("FABRIC_TENANT_ID");
    });

    it("throws when FABRIC_CLIENT_ID is missing", () => {
      setEnv({ ...REQUIRED_ENV });
      clearEnv("FABRIC_CLIENT_ID");
      expect(() => loadConfig()).toThrow("FABRIC_CLIENT_ID");
    });

    it("throws when FABRIC_CLIENT_SECRET is missing", () => {
      setEnv({ ...REQUIRED_ENV });
      clearEnv("FABRIC_CLIENT_SECRET");
      expect(() => loadConfig()).toThrow("FABRIC_CLIENT_SECRET");
    });

    it("throws when EVENTHOUSE_QUERY_ENDPOINT is missing (no fallback)", () => {
      setEnv({ ...REQUIRED_ENV });
      clearEnv("EVENTHOUSE_QUERY_ENDPOINT");
      expect(() => loadConfig()).toThrow("EVENTHOUSE_QUERY_ENDPOINT");
    });

    it("throws when EVENTHOUSE_INGESTION_ENDPOINT is missing (no fallback)", () => {
      setEnv({ ...REQUIRED_ENV });
      clearEnv("EVENTHOUSE_INGESTION_ENDPOINT");
      expect(() => loadConfig()).toThrow("EVENTHOUSE_INGESTION_ENDPOINT");
    });

    it("treats empty string as missing", () => {
      setEnv({ ...REQUIRED_ENV, FABRIC_TENANT_ID: "" });
      expect(() => loadConfig()).toThrow("FABRIC_TENANT_ID");
    });

    it("treats whitespace-only as missing", () => {
      setEnv({ ...REQUIRED_ENV, FABRIC_TENANT_ID: "   " });
      expect(() => loadConfig()).toThrow("FABRIC_TENANT_ID");
    });
  });

  // ── Successful config loading ──────────────────────────────────

  describe("loadConfig with valid env", () => {
    it("returns a valid AppConfig with all required fields", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();

      expect(config.fabric.tenantId).toBe("test-tenant-id");
      expect(config.fabric.clientId).toBe("test-client-id");
      expect(config.fabric.clientSecret).toBe("test-secret");
      expect(config.kql.queryEndpoint).toBe("https://kql.test.kusto.fabric.microsoft.com");
      expect(config.kql.ingestionEndpoint).toBe("https://ingest-kql.test.kusto.fabric.microsoft.com");
    });

    it("constructs token endpoint from tenant ID", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.fabric.tokenEndpoint).toBe(
        "https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token"
      );
      expect(config.kql.tokenEndpoint).toBe(
        "https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token"
      );
    });

    it("constructs KQL token scope from query endpoint", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.kql.tokenScope).toBe(
        "https://kql.test.kusto.fabric.microsoft.com/.default"
      );
    });

    it("uses default database name EH_Observability", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.kql.database).toBe("EH_Observability");
    });

    it("sets KQL enabled to true by default", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.kql.enabled).toBe(true);
    });

    it("sets Fabric API base URL correctly", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.fabric.apiBaseUrl).toBe("https://api.fabric.microsoft.com/v1");
    });

    it("sets grant type to client_credentials", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.fabric.grantType).toBe("client_credentials");
    });
  });

  // ── Fallback env var aliases ───────────────────────────────────

  describe("env var aliases", () => {
    it("falls back to KQL_QUERY_ENDPOINT when EVENTHOUSE_QUERY_ENDPOINT is missing", () => {
      setEnv({
        ...REQUIRED_ENV,
        KQL_QUERY_ENDPOINT: "https://kql-alias.test",
      });
      clearEnv("EVENTHOUSE_QUERY_ENDPOINT");
      const config = loadConfig();
      expect(config.kql.queryEndpoint).toBe("https://kql-alias.test");
    });

    it("falls back to KQL_INGESTION_ENDPOINT when EVENTHOUSE_INGESTION_ENDPOINT is missing", () => {
      setEnv({
        ...REQUIRED_ENV,
        KQL_INGESTION_ENDPOINT: "https://ingest-alias.test",
      });
      clearEnv("EVENTHOUSE_INGESTION_ENDPOINT");
      const config = loadConfig();
      expect(config.kql.ingestionEndpoint).toBe("https://ingest-alias.test");
    });

    it("prefers EVENTHOUSE_QUERY_ENDPOINT over KQL_QUERY_ENDPOINT", () => {
      setEnv({
        ...REQUIRED_ENV,
        KQL_QUERY_ENDPOINT: "https://should-not-use.test",
      });
      const config = loadConfig();
      expect(config.kql.queryEndpoint).toBe("https://kql.test.kusto.fabric.microsoft.com");
    });
  });

  // ── Optional overrides ─────────────────────────────────────────

  describe("optional overrides", () => {
    it("uses KQL_DATABASE override when provided", () => {
      setEnv({ ...REQUIRED_ENV, KQL_DATABASE: "CustomDB" });
      const config = loadConfig();
      expect(config.kql.database).toBe("CustomDB");
    });

    it("disables KQL when KQL_ENABLED is false", () => {
      setEnv({ ...REQUIRED_ENV, KQL_ENABLED: "false" });
      const config = loadConfig();
      expect(config.kql.enabled).toBe(false);
    });

    it("disables KQL when KQL_ENABLED is FALSE (case insensitive)", () => {
      setEnv({ ...REQUIRED_ENV, KQL_ENABLED: "FALSE" });
      const config = loadConfig();
      expect(config.kql.enabled).toBe(false);
    });

    it("enables KQL when KQL_ENABLED is any truthy string", () => {
      setEnv({ ...REQUIRED_ENV, KQL_ENABLED: "true" });
      const config = loadConfig();
      expect(config.kql.enabled).toBe(true);
    });
  });

  // ── SLO defaults ───────────────────────────────────────────────

  describe("SLO configuration defaults", () => {
    it("sets default minSuccessRate to 0.95", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.slo.minSuccessRate).toBe(0.95);
    });

    it("sets default durationRegressionMultiplier to 2.0", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.slo.durationRegressionMultiplier).toBe(2.0);
    });

    it("sets default maxFreshnessHours to 24", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.slo.maxFreshnessHours).toBe(24);
    });
  });

  // ── Known workspaces ───────────────────────────────────────────

  describe("known workspaces", () => {
    it("includes 3 default workspaces", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.knownWorkspaces).toHaveLength(3);
    });

    it("includes Kane-Test-Personal workspace", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      const ktp = config.knownWorkspaces.find(
        (ws) => ws.displayName === "Kane-Test-Personal"
      );
      expect(ktp).toBeDefined();
      expect(ktp!.id).toBe("2da36c93-57b2-4b9e-a853-ce08251ae0b9");
    });

    it("includes FrameworkTesting workspace", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      const ft = config.knownWorkspaces.find(
        (ws) => ws.displayName === "FrameworkTesting"
      );
      expect(ft).toBeDefined();
    });

    it("includes FrameworkProduction workspace", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      const fp = config.knownWorkspaces.find(
        (ws) => ws.displayName === "FrameworkProduction"
      );
      expect(fp).toBeDefined();
    });
  });

  // ── Poll interval ──────────────────────────────────────────────

  describe("poll interval", () => {
    it("defaults to 5 minutes (300000ms)", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();
      expect(config.pollIntervalMs).toBe(300_000);
    });
  });
});
