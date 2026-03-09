/**
 * Observability Workbench - Main Entry Point
 *
 * Orchestrates the full collection -> analysis -> dashboard cycle.
 *
 * Usage:
 *   node --import tsx src/index.ts                   # One-shot collect + dashboard
 *   node --import tsx src/index.ts --mode collect    # Collect only (no dashboard)
 *   node --import tsx src/index.ts --mode dashboard  # Dashboard from latest data
 *   node --import tsx src/index.ts --mode monitor    # Continuous polling
 */

import chalk from "chalk";
import { loadConfig } from "./config.ts";
import { FabricAuthProvider } from "./auth.ts";
import { FabricClient } from "./fabric-client.ts";
import { ObservabilityCollector } from "./collector.ts";
import type { CollectionResult } from "./collector.ts";
import { ObservabilityStore } from "./store.ts";
import { Dashboard, renderTrendAnalysis } from "./dashboard.ts";
import { AlertEngine } from "./alerts.ts";
import { Scheduler } from "./scheduler.ts";
import { KqlClient } from "./kql-client.ts";

// ── Parse CLI args ─────────────────────────────────────────────────

type RunMode = "full" | "collect" | "dashboard" | "monitor";

function parseMode(): RunMode {
  const args = process.argv.slice(2);
  const modeIdx = args.indexOf("--mode");
  if (modeIdx >= 0 && modeIdx + 1 < args.length) {
    const mode = args[modeIdx + 1];
    if (["full", "collect", "dashboard", "monitor"].includes(mode)) {
      return mode as RunMode;
    }
    console.warn(chalk.yellow(`Unknown mode "${mode}", defaulting to "full"`));
  }
  return "full";
}

// ── Banner ─────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(chalk.bold.blueBright(`
   ___  _                            _     _ _ _ _
  / _ \\| |__  ___  ___ _ ____   __  | |   | (_) | |_ _   _
 | | | | '_ \\/ __|/ _ \\ '__\\ \\ / /  | |   | | | | __| | | |
 | |_| | |_) \\__ \\  __/ |   \\ V /   | |___| | | | |_| |_| |
  \\___/|_.__/|___/\\___|_|    \\_/    |_____|_|_|_|\\__|\\__, |
                                                      |___/
  Workbench v0.1.0 - Fabric Monitoring & Analysis
  `));
}

// ── Core cycle ─────────────────────────────────────────────────────

async function runCollectionCycle(
  collector: ObservabilityCollector,
  store: ObservabilityStore,
  dashboard: Dashboard,
  alertEngine: AlertEngine,
  renderDashboard: boolean,
  kqlClient?: KqlClient
): Promise<CollectionResult> {
  // Collect
  const result = await collector.collect();

  // Save to local store
  await store.save(result);

  // Ingest into KQL Eventhouse (if configured)
  if (kqlClient) {
    try {
      await kqlClient.ingestCollectionResult(result);
    } catch (err: any) {
      console.warn(
        chalk.yellow(`[kql] Ingestion failed (non-fatal): ${err.message}`)
      );
    }
  }

  // Evaluate alerts (use previous snapshot as baseline if available)
  const history = await store.loadRecent(2);
  const baseline =
    history.length >= 2 ? history[history.length - 2].sloMetrics : undefined;
  const alerts = alertEngine.evaluate(result, baseline);

  // Write alerts to file
  await alertEngine.writeAlerts(alerts, store.getDataDir());

  // Render dashboard
  if (renderDashboard) {
    dashboard.render(result, alerts);

    // Trend analysis if we have history
    if (history.length >= 2) {
      renderTrendAnalysis(history);
    }
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  printBanner();

  const mode = parseMode();
  console.log(chalk.gray(`  Mode: ${mode}\n`));

  // Load config
  const config = loadConfig();
  console.log(chalk.green("[init] Configuration loaded"));

  // Initialize components
  const auth = new FabricAuthProvider(config.fabric);
  const client = new FabricClient(config.fabric, auth);
  const collector = new ObservabilityCollector(client, config);
  const store = new ObservabilityStore(config.dataDir);
  const dashboard = new Dashboard(config);
  const alertEngine = new AlertEngine(config);

  // Initialize KQL client if enabled
  let kqlClient: KqlClient | undefined;
  if (config.kql.enabled) {
    kqlClient = new KqlClient(config.fabric, config.kql);
    console.log(chalk.green("[init] KQL ingestion enabled"));
    console.log(chalk.gray(`  Query endpoint: ${config.kql.queryEndpoint}`));
    console.log(chalk.gray(`  Database: ${config.kql.database}`));
  } else {
    console.log(chalk.gray("[init] KQL ingestion disabled (set KQL_ENABLED=true to enable)"));
  }

  await store.init();
  console.log(chalk.green(`[init] Data directory: ${config.dataDir}`));

  // Verify authentication
  try {
    console.log(chalk.gray("[init] Verifying Fabric API credentials..."));
    await auth.getToken();
    console.log(chalk.green("[init] Authentication successful"));
  } catch (err: any) {
    console.error(
      chalk.red(`[init] Authentication failed: ${err.message}`)
    );
    console.error(
      chalk.yellow(
        "  Ensure FABRIC_TENANT_ID, FABRIC_CLIENT_ID, and FABRIC_CLIENT_SECRET are set correctly."
      )
    );
    process.exit(1);
  }

  // Execute based on mode
  switch (mode) {
    case "collect": {
      const result = await runCollectionCycle(
        collector,
        store,
        dashboard,
        alertEngine,
        false,
        kqlClient
      );
      console.log(
        chalk.green(
          `\n[done] Collection complete. ${result.jobs.length} jobs, ${result.sloMetrics.length} SLO metrics.`
        )
      );
      break;
    }

    case "dashboard": {
      const latest = await store.loadLatest();
      if (!latest) {
        console.error(
          chalk.red(
            "No data found. Run a collection first: npm run collect"
          )
        );
        process.exit(1);
      }
      const history = await store.loadRecent(5);
      const baseline =
        history.length >= 2 ? history[history.length - 2].sloMetrics : undefined;
      const alerts = alertEngine.evaluate(latest, baseline);
      dashboard.render(latest, alerts);
      if (history.length >= 2) {
        renderTrendAnalysis(history);
      }
      break;
    }

    case "monitor": {
      const scheduler = new Scheduler(config, async () => {
        await runCollectionCycle(
          collector,
          store,
          dashboard,
          alertEngine,
          true,
          kqlClient
        );
      });
      await scheduler.start();
      break;
    }

    case "full":
    default: {
      const result = await runCollectionCycle(
        collector,
        store,
        dashboard,
        alertEngine,
        true,
        kqlClient
      );
      console.log(
        chalk.green(
          `\n[done] Complete. ${result.workspaces.length} workspaces, ${result.jobs.length} jobs, ${result.correlations.length} chains, ${result.sloMetrics.length} SLOs.`
        )
      );
      break;
    }
  }
}

main().catch((err) => {
  console.error(chalk.red(`\nFatal error: ${err.message}`));
  if (err.stack) {
    console.error(chalk.gray(err.stack));
  }
  process.exit(1);
});
