/**
 * Observability Workbench - Configuration
 *
 * Loads and validates environment configuration for Fabric API access.
 * All secrets are read from environment variables - never hardcoded.
 */

export interface FabricConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  tokenEndpoint: string;
  scope: string;
  grantType: string;
  kqlEndpoint: string;
}

export interface KqlConfig {
  /** Query endpoint for the Eventhouse */
  queryEndpoint: string;
  /** Ingestion endpoint for the Eventhouse */
  ingestionEndpoint: string;
  /** Database name within the Eventhouse */
  database: string;
  /** OAuth2 token scope for KQL authentication */
  tokenScope: string;
  /** Token endpoint (same tenant as Fabric) */
  tokenEndpoint: string;
  /** Whether KQL ingestion is enabled */
  enabled: boolean;
}

export interface WorkspaceDefinition {
  id: string;
  displayName: string;
}

export interface AppConfig {
  fabric: FabricConfig;
  kql: KqlConfig;
  knownWorkspaces: WorkspaceDefinition[];
  dataDir: string;
  pollIntervalMs: number;
  slo: SLOConfig;
}

export interface SLOConfig {
  /** Minimum success rate threshold (0-1) */
  minSuccessRate: number;
  /** Maximum allowed average duration multiplier over baseline before alert */
  durationRegressionMultiplier: number;
  /** Maximum hours since last successful run before freshness violation */
  maxFreshnessHours: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it before running the workbench.`
    );
  }
  return value.trim();
}

export function loadConfig(): AppConfig {
  const tenantId = requireEnv("FABRIC_TENANT_ID");

  const kqlQueryEndpoint =
    process.env.EVENTHOUSE_QUERY_ENDPOINT ??
    process.env.KQL_QUERY_ENDPOINT ??
    (() => {
      throw new Error(
        "Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT. " +
          "Set it to your Eventhouse KQL query endpoint URL."
      );
    })();

  return {
    fabric: {
      tenantId,
      clientId: requireEnv("FABRIC_CLIENT_ID"),
      clientSecret: requireEnv("FABRIC_CLIENT_SECRET"),
      apiBaseUrl: "https://api.fabric.microsoft.com/v1",
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      scope: "https://api.fabric.microsoft.com/.default",
      grantType: "client_credentials",
      kqlEndpoint:
        "https://trd-vr0t78ut6v8as8zp09.z0.kusto.fabric.microsoft.com",
    },
    kql: {
      queryEndpoint: kqlQueryEndpoint,
      ingestionEndpoint:
        process.env.EVENTHOUSE_INGESTION_ENDPOINT ??
        process.env.KQL_INGESTION_ENDPOINT ??
        (() => {
          throw new Error(
            "Missing required environment variable: EVENTHOUSE_INGESTION_ENDPOINT. " +
              "Set it to your Eventhouse KQL ingestion endpoint URL."
          );
        })(),
      database: process.env.KQL_DATABASE ?? "EH_Observability",
      tokenScope: `${kqlQueryEndpoint}/.default`,
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      enabled: (process.env.KQL_ENABLED ?? "true").toLowerCase() === "true",
    },
    knownWorkspaces: [
      {
        id: "2da36c93-57b2-4b9e-a853-ce08251ae0b9",
        displayName: "Kane-Test-Personal",
      },
      {
        id: "d286b2c5-31fd-4b7c-a6da-a3a75435f52a",
        displayName: "FrameworkTesting",
      },
      {
        id: "a3a73dce-4c75-4c9a-8c9e-2d0814c4f697",
        displayName: "FrameworkProduction",
      },
    ],
    dataDir: decodeURIComponent(new URL("../data", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
    pollIntervalMs: 5 * 60 * 1000, // 5 minutes
    slo: {
      minSuccessRate: 0.95,
      durationRegressionMultiplier: 2.0,
      maxFreshnessHours: 24,
    },
  };
}
