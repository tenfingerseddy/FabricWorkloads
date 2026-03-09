#!/usr/bin/env node

import { runHealthCheck } from './health-check';
import { printResults, printBanner, printAuthFailure, printUsage, printError } from './output';

/**
 * Exit codes:
 *   0 = healthy — all checks passed
 *   1 = issues found — health check completed but flagged problems
 *   2 = auth failure — could not authenticate with Fabric API
 */

async function main(): Promise<void> {
  printBanner();

  const tenantId = process.env.FABRIC_TENANT_ID;
  const clientId = process.env.FABRIC_CLIENT_ID;
  const clientSecret = process.env.FABRIC_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    printUsage();
    process.exit(2);
  }

  try {
    const results = await runHealthCheck({ tenantId, clientId, clientSecret });

    if (results.authError) {
      printAuthFailure(results.authError);
      process.exit(2);
    }

    printResults(results);

    if (results.issues.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    printError(message);
    process.exit(2);
  }
}

main();
