#!/usr/bin/env node
/**
 * health-check.mjs
 *
 * Comprehensive health check for the Observability Workbench infrastructure.
 * Runs a series of probes and outputs a formatted report with OK/WARN/FAIL
 * status for each check.
 *
 * Usage:
 *   node scripts/health-check.mjs                        # Check all workspaces
 *   node scripts/health-check.mjs --workspace <id>       # Check specific workspace
 *   node scripts/health-check.mjs --json                 # Output as JSON (for CI parsing)
 *   node scripts/health-check.mjs --quiet                # Only print failures/warnings
 *
 * Environment variables (all required unless noted):
 *   FABRIC_TENANT_ID             Entra ID tenant
 *   FABRIC_CLIENT_ID             Service principal app ID
 *   FABRIC_CLIENT_SECRET         Service principal secret
 *   EVENTHOUSE_QUERY_ENDPOINT    KQL query endpoint (or KQL_QUERY_ENDPOINT)
 *   KQL_DATABASE                 (optional, defaults to EH_Observability)
 *
 * Exit codes:
 *   0  All checks passed
 *   1  One or more checks failed
 *   2  Script-level error (missing config, network failure, etc.)
 */

import https from 'https';
import { execSync } from 'child_process';

// ── Constants ──────────────────────────────────────────────────────

const NOTEBOOKS = [
  { name: 'NB_ObsIngestion', expectedIntervalMinutes: 5 },
  { name: 'NB_ObsCorrelation', expectedIntervalMinutes: 15 },
  { name: 'NB_ObsAlerts', expectedIntervalMinutes: 15 },
];

const KQL_TABLES = [
  'FabricEvents',
  'SloDefinitions',
  'SloSnapshots',
  'AlertRules',
  'AlertLog',
  'EventCorrelations',
  'WorkspaceInventory',
];

const OBS_WORKSPACE_ID = '910a8092-09f6-4498-984d-52b174715f67';

// ── Argument parsing ───────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { workspace: null, json: false, quiet: false };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
      opts.workspace = args[i + 1];
      i++;
    } else if (args[i] === '--json') {
      opts.json = true;
    } else if (args[i] === '--quiet' || args[i] === '-q') {
      opts.quiet = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/health-check.mjs [options]

Options:
  --workspace, -w <id>   Target a specific workspace ID
  --json                 Output results as JSON
  --quiet, -q            Only show warnings and failures
  --help, -h             Show this help message

Environment variables:
  FABRIC_TENANT_ID             (required)
  FABRIC_CLIENT_ID             (required)
  FABRIC_CLIENT_SECRET         (required)
  EVENTHOUSE_QUERY_ENDPOINT    (required, or KQL_QUERY_ENDPOINT)
  KQL_DATABASE                 (optional, default: EH_Observability)
`);
      process.exit(0);
    }
  }
  return opts;
}

// ── Secure environment variable loader ─────────────────────────────

function getEnvVar(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid env var name: ${name}`);
  }
  if (process.env[name]) return process.env[name];
  try {
    const val = execSync(
      `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (val && val !== '') return val;
  } catch {
    // PowerShell not available -- fine on Linux/CI
  }
  return null;
}

function requireEnv(name) {
  const val = getEnvVar(name);
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in your shell or as a Windows User environment variable.`
    );
  }
  return val;
}

// ── HTTP helper ────────────────────────────────────────────────────

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Request timed out: ${url}`));
    });
    if (body) req.write(body);
    req.end();
  });
}

// ── Token acquisition ──────────────────────────────────────────────

async function acquireToken(tenantId, clientId, clientSecret, scope) {
  const resp = await httpsRequest(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope,
      grant_type: 'client_credentials',
    }).toString()
  );

  if (resp.status !== 200) {
    let detail;
    try {
      const errBody = JSON.parse(resp.body);
      detail = errBody.error_description || errBody.error || resp.body;
    } catch {
      detail = resp.body;
    }
    throw new Error(`Token request failed (HTTP ${resp.status}): ${detail}`);
  }

  const parsed = JSON.parse(resp.body);
  if (!parsed.access_token) {
    throw new Error('Token response missing access_token');
  }
  return parsed.access_token;
}

// ── KQL query helper ───────────────────────────────────────────────

async function kqlQuery(kustoUri, database, token, kql) {
  const resp = await httpsRequest(
    `${kustoUri}/v1/rest/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ db: database, csl: kql })
  );

  if (resp.status !== 200) {
    let detail = resp.body;
    try { detail = JSON.parse(resp.body)?.error?.message || resp.body; } catch {}
    throw new Error(`KQL query failed (HTTP ${resp.status}): ${detail}`);
  }

  const data = JSON.parse(resp.body);
  const table = data.Tables?.[0];
  if (!table) return [];
  const cols = table.Columns.map((c) => c.ColumnName);
  return table.Rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

// ── KQL management command helper ──────────────────────────────────

async function kqlMgmt(kustoUri, database, token, command) {
  const resp = await httpsRequest(
    `${kustoUri}/v1/rest/mgmt`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ db: database, csl: command })
  );

  if (resp.status !== 200) {
    throw new Error(`KQL mgmt command failed (HTTP ${resp.status})`);
  }
  return JSON.parse(resp.body);
}

// ── Check result accumulator ───────────────────────────────────────

class HealthReport {
  constructor() {
    this.checks = [];
    this.startTime = Date.now();
  }

  add(category, name, status, detail = '') {
    this.checks.push({ category, name, status, detail, timestamp: new Date().toISOString() });
  }

  ok(category, name, detail = '') { this.add(category, name, 'OK', detail); }
  warn(category, name, detail = '') { this.add(category, name, 'WARN', detail); }
  fail(category, name, detail = '') { this.add(category, name, 'FAIL', detail); }

  get hasFail() { return this.checks.some((c) => c.status === 'FAIL'); }
  get hasWarn() { return this.checks.some((c) => c.status === 'WARN'); }
  get elapsed() { return ((Date.now() - this.startTime) / 1000).toFixed(1); }

  get overall() {
    if (this.hasFail) return 'FAIL';
    if (this.hasWarn) return 'WARN';
    return 'OK';
  }

  toJSON() {
    return {
      overall: this.overall,
      elapsed: this.elapsed,
      timestamp: new Date().toISOString(),
      checks: this.checks,
    };
  }

  print({ quiet = false } = {}) {
    const pad = (s, n) => String(s).padEnd(n);
    const badge = (s) => {
      if (s === 'OK')   return '[ OK  ]';
      if (s === 'WARN') return '[ WARN]';
      return '[ FAIL]';
    };

    console.log('');
    console.log('='.repeat(78));
    console.log('  Observability Workbench -- Infrastructure Health Check');
    console.log(`  ${new Date().toISOString()}`);
    console.log('='.repeat(78));

    let currentCategory = '';
    for (const c of this.checks) {
      if (quiet && c.status === 'OK') continue;
      if (c.category !== currentCategory) {
        currentCategory = c.category;
        console.log('');
        console.log(`  --- ${currentCategory} ${''.padEnd(Math.max(0, 68 - currentCategory.length), '-')}`);
      }
      const detailStr = c.detail ? `  ${c.detail}` : '';
      console.log(`  ${badge(c.status)} ${pad(c.name, 40)}${detailStr}`);
    }

    console.log('');
    console.log('='.repeat(78));
    const counts = {
      ok: this.checks.filter((c) => c.status === 'OK').length,
      warn: this.checks.filter((c) => c.status === 'WARN').length,
      fail: this.checks.filter((c) => c.status === 'FAIL').length,
    };
    console.log(
      `  Overall: ${this.overall}  |  ` +
      `${counts.ok} passed, ${counts.warn} warnings, ${counts.fail} failures  |  ` +
      `${this.elapsed}s`
    );
    console.log('='.repeat(78));
    console.log('');
  }
}

// ── Individual health checks ───────────────────────────────────────

async function checkAuthentication(report, tenantId, clientId, clientSecret, kustoUri) {
  const category = 'Authentication';

  // Check Fabric API token
  try {
    const fabricToken = await acquireToken(
      tenantId, clientId, clientSecret,
      'https://api.fabric.microsoft.com/.default'
    );
    report.ok(category, 'Fabric API token', 'Token acquired');
    return { fabricToken };
  } catch (e) {
    report.fail(category, 'Fabric API token', e.message.substring(0, 100));
    return { fabricToken: null };
  }
}

async function checkKustoAuth(report, tenantId, clientId, clientSecret, kustoUri) {
  const category = 'Authentication';
  try {
    const kustoToken = await acquireToken(
      tenantId, clientId, clientSecret,
      `${kustoUri}/.default`
    );
    report.ok(category, 'Eventhouse (KQL) token', 'Token acquired');
    return { kustoToken };
  } catch (e) {
    report.fail(category, 'Eventhouse (KQL) token', e.message.substring(0, 100));
    return { kustoToken: null };
  }
}

async function checkWorkspaces(report, fabricToken, targetWorkspace) {
  const category = 'Fabric API';

  if (!fabricToken) {
    report.fail(category, 'List workspaces', 'Skipped: no Fabric token');
    return [];
  }

  try {
    const resp = await httpsRequest(
      'https://api.fabric.microsoft.com/v1/workspaces',
      { method: 'GET', headers: { Authorization: `Bearer ${fabricToken}` } }
    );

    if (resp.status !== 200) {
      report.fail(category, 'List workspaces', `HTTP ${resp.status}`);
      return [];
    }

    const data = JSON.parse(resp.body);
    const workspaces = data.value || [];
    report.ok(category, 'List workspaces', `${workspaces.length} workspace(s) accessible`);

    // Check for the Observability workspace specifically
    const obsWs = workspaces.find((w) => w.id === OBS_WORKSPACE_ID);
    if (obsWs) {
      report.ok(category, 'ObservabilityWorkbench-Dev workspace', `Found: ${obsWs.displayName}`);
    } else {
      report.warn(category, 'ObservabilityWorkbench-Dev workspace', 'Not found in accessible workspaces');
    }

    // If a target workspace was specified, verify it exists
    if (targetWorkspace) {
      const target = workspaces.find((w) => w.id === targetWorkspace);
      if (target) {
        report.ok(category, `Target workspace (${targetWorkspace.substring(0, 8)}...)`, target.displayName);
      } else {
        report.fail(category, `Target workspace (${targetWorkspace.substring(0, 8)}...)`, 'Not found or not accessible');
      }
    }

    return workspaces;
  } catch (e) {
    report.fail(category, 'List workspaces', e.message.substring(0, 100));
    return [];
  }
}

async function checkWorkspaceItems(report, fabricToken, workspaceId) {
  const category = 'Fabric API';

  if (!fabricToken) {
    report.fail(category, 'List workspace items', 'Skipped: no Fabric token');
    return [];
  }

  try {
    const resp = await httpsRequest(
      `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items`,
      { method: 'GET', headers: { Authorization: `Bearer ${fabricToken}` } }
    );

    if (resp.status !== 200) {
      report.fail(category, 'List workspace items', `HTTP ${resp.status}`);
      return [];
    }

    const data = JSON.parse(resp.body);
    const items = data.value || [];
    const typeCounts = {};
    for (const item of items) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }
    const summary = Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(', ');
    report.ok(category, 'Workspace items', `${items.length} items (${summary})`);

    // Check that our 3 notebooks exist
    for (const nb of NOTEBOOKS) {
      const found = items.find((i) => i.displayName === nb.name && i.type === 'Notebook');
      if (found) {
        report.ok(category, `Notebook: ${nb.name}`, `ID: ${found.id.substring(0, 8)}...`);
      } else {
        report.fail(category, `Notebook: ${nb.name}`, 'Not found in workspace');
      }
    }

    return items;
  } catch (e) {
    report.fail(category, 'List workspace items', e.message.substring(0, 100));
    return [];
  }
}

async function checkEventhouse(report, kustoToken, kustoUri, database) {
  const category = 'Eventhouse';

  if (!kustoToken) {
    report.fail(category, 'KQL connectivity', 'Skipped: no Kusto token');
    return;
  }

  // 1. Basic connectivity -- run a trivial query
  try {
    const rows = await kqlQuery(kustoUri, database, kustoToken, 'print Connected=true');
    if (rows.length > 0 && rows[0].Connected === true) {
      report.ok(category, 'KQL connectivity', `Database: ${database}`);
    } else {
      report.fail(category, 'KQL connectivity', 'Unexpected response from test query');
      return;
    }
  } catch (e) {
    report.fail(category, 'KQL connectivity', e.message.substring(0, 100));
    return;
  }

  // 2. Check each expected table exists and has rows
  for (const table of KQL_TABLES) {
    try {
      const rows = await kqlQuery(kustoUri, database, kustoToken, `${table} | count`);
      const count = rows[0]?.Count ?? rows[0]?.count ?? 0;
      if (count > 0) {
        report.ok(category, `Table: ${table}`, `${count} rows`);
      } else {
        report.warn(category, `Table: ${table}`, 'Table exists but is empty');
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes("not found") || msg.includes("doesn't exist") || msg.includes("Semantic error")) {
        report.fail(category, `Table: ${table}`, 'Table does not exist');
      } else {
        report.fail(category, `Table: ${table}`, msg.substring(0, 80));
      }
    }
  }

  // 3. Data freshness -- when was last event ingested?
  try {
    const rows = await kqlQuery(
      kustoUri, database, kustoToken,
      `FabricEvents | summarize LastEvent=max(IngestedAt) | extend AgeMinutes=datetime_diff('minute', now(), LastEvent)`
    );
    if (rows.length > 0 && rows[0].AgeMinutes != null) {
      const ageMins = rows[0].AgeMinutes;
      const detail = `Last event ${ageMins}m ago (${rows[0].LastEvent})`;
      if (ageMins <= 15) {
        report.ok(category, 'Data freshness (FabricEvents)', detail);
      } else if (ageMins <= 60) {
        report.warn(category, 'Data freshness (FabricEvents)', detail);
      } else {
        report.fail(category, 'Data freshness (FabricEvents)', detail);
      }
    } else {
      report.warn(category, 'Data freshness (FabricEvents)', 'No events found');
    }
  } catch (e) {
    report.fail(category, 'Data freshness (FabricEvents)', e.message.substring(0, 80));
  }
}

async function checkNotebookSchedules(report, kustoToken, kustoUri, database) {
  const category = 'Notebook Schedules';

  if (!kustoToken) {
    report.fail(category, 'Schedule check', 'Skipped: no Kusto token');
    return;
  }

  const notebookList = NOTEBOOKS.map((n) => `'${n.name}'`).join(', ');

  try {
    const rows = await kqlQuery(
      kustoUri, database, kustoToken,
      `FabricEvents
      | where ItemName in (${notebookList})
      | summarize
          LastRun = max(StartTimeUtc),
          LastSuccess = maxif(StartTimeUtc, Status == 'Completed'),
          Last6hTotal = countif(StartTimeUtc > ago(6h)),
          Last6hOK = countif(Status == 'Completed' and StartTimeUtc > ago(6h)),
          Last6hFail = countif(Status == 'Failed' and StartTimeUtc > ago(6h)),
          Last1hTotal = countif(StartTimeUtc > ago(1h))
        by ItemName`
    );

    // Build a map for easy lookup
    const nbMap = {};
    for (const r of rows) nbMap[r.ItemName] = r;

    for (const nb of NOTEBOOKS) {
      const r = nbMap[nb.name];
      if (!r) {
        report.fail(category, `${nb.name} -- running`, 'No events found in FabricEvents');
        continue;
      }

      // Check if running recently
      const lastRunAgeMin = r.LastRun
        ? Math.floor((Date.now() - new Date(r.LastRun).getTime()) / 60000)
        : null;

      // Staleness threshold: 3x the expected interval
      const staleThreshold = nb.expectedIntervalMinutes * 3;

      if (lastRunAgeMin !== null && lastRunAgeMin <= staleThreshold) {
        report.ok(category, `${nb.name} -- running`, `Last run ${lastRunAgeMin}m ago`);
      } else if (lastRunAgeMin !== null) {
        report.warn(
          category,
          `${nb.name} -- running`,
          `Last run ${lastRunAgeMin}m ago (expected every ${nb.expectedIntervalMinutes}m)`
        );
      } else {
        report.fail(category, `${nb.name} -- running`, 'No run timestamp available');
      }

      // Check success rate in last 6h
      const total6h = r.Last6hTotal || 0;
      const ok6h = r.Last6hOK || 0;
      const fail6h = r.Last6hFail || 0;

      if (total6h === 0) {
        report.warn(category, `${nb.name} -- success rate (6h)`, 'No runs in last 6 hours');
      } else {
        const rate = (ok6h / total6h) * 100;
        const detail = `${rate.toFixed(1)}% (${ok6h}/${total6h}, ${fail6h} failed)`;
        if (rate >= 95) {
          report.ok(category, `${nb.name} -- success rate (6h)`, detail);
        } else if (rate >= 80) {
          report.warn(category, `${nb.name} -- success rate (6h)`, detail);
        } else {
          report.fail(category, `${nb.name} -- success rate (6h)`, detail);
        }
      }

      // Check that runs are happening at expected frequency
      // In 1 hour, we expect at least (60 / interval) runs
      const expectedRuns1h = Math.floor(60 / nb.expectedIntervalMinutes);
      const actual1h = r.Last1hTotal || 0;
      if (actual1h >= expectedRuns1h * 0.5) {
        report.ok(
          category,
          `${nb.name} -- frequency (1h)`,
          `${actual1h} runs (expected ~${expectedRuns1h})`
        );
      } else if (actual1h > 0) {
        report.warn(
          category,
          `${nb.name} -- frequency (1h)`,
          `${actual1h} runs (expected ~${expectedRuns1h})`
        );
      } else {
        report.fail(
          category,
          `${nb.name} -- frequency (1h)`,
          `0 runs in last hour (expected ~${expectedRuns1h})`
        );
      }
    }
  } catch (e) {
    report.fail(category, 'Schedule analysis', e.message.substring(0, 100));
  }
}

async function checkSloHealth(report, kustoToken, kustoUri, database) {
  const category = 'SLO Health';

  if (!kustoToken) {
    report.fail(category, 'SLO check', 'Skipped: no Kusto token');
    return;
  }

  try {
    // Check active SLO definitions
    const defs = await kqlQuery(
      kustoUri, database, kustoToken,
      `SloDefinitions | where IsActive == true | count`
    );
    const defCount = defs[0]?.Count ?? 0;
    if (defCount > 0) {
      report.ok(category, 'Active SLO definitions', `${defCount} active`);
    } else {
      report.warn(category, 'Active SLO definitions', 'No active SLO definitions found');
    }

    // Check breaching SLOs
    const breaching = await kqlQuery(
      kustoUri, database, kustoToken,
      `SloSnapshots
      | summarize arg_max(ComputedAt, *) by SloId
      | where IsBreaching == true
      | count`
    );
    const breachCount = breaching[0]?.Count ?? 0;
    if (breachCount === 0) {
      report.ok(category, 'SLO breaches', 'No SLOs currently breaching');
    } else {
      report.warn(category, 'SLO breaches', `${breachCount} SLO(s) currently breaching`);
    }
  } catch (e) {
    // SLO tables might not have data yet -- warn rather than fail
    report.warn(category, 'SLO health check', `Could not query: ${e.message.substring(0, 80)}`);
  }
}

async function checkAlerts(report, kustoToken, kustoUri, database) {
  const category = 'Alerts';

  if (!kustoToken) {
    report.fail(category, 'Alert check', 'Skipped: no Kusto token');
    return;
  }

  try {
    // Count recent critical alerts
    const criticals = await kqlQuery(
      kustoUri, database, kustoToken,
      `AlertLog
      | where Timestamp > ago(1h) and Severity == 'critical'
      | count`
    );
    const critCount = criticals[0]?.Count ?? 0;
    if (critCount === 0) {
      report.ok(category, 'Critical alerts (1h)', 'None');
    } else {
      report.fail(category, 'Critical alerts (1h)', `${critCount} critical alert(s) in last hour`);
    }

    // Count recent warning alerts
    const warnings = await kqlQuery(
      kustoUri, database, kustoToken,
      `AlertLog
      | where Timestamp > ago(1h) and Severity == 'warning'
      | count`
    );
    const warnCount = warnings[0]?.Count ?? 0;
    if (warnCount === 0) {
      report.ok(category, 'Warning alerts (1h)', 'None');
    } else {
      report.warn(category, 'Warning alerts (1h)', `${warnCount} warning alert(s) in last hour`);
    }
  } catch (e) {
    report.warn(category, 'Alert check', `Could not query: ${e.message.substring(0, 80)}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const report = new HealthReport();

  // Load configuration
  let tenantId, clientId, clientSecret, kustoUri, database;
  try {
    tenantId = requireEnv('FABRIC_TENANT_ID');
    clientId = requireEnv('FABRIC_CLIENT_ID');
    clientSecret = requireEnv('FABRIC_CLIENT_SECRET');
    kustoUri = getEnvVar('EVENTHOUSE_QUERY_ENDPOINT') || getEnvVar('KQL_QUERY_ENDPOINT');
    if (!kustoUri) {
      throw new Error('Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT (or KQL_QUERY_ENDPOINT)');
    }
    database = getEnvVar('KQL_DATABASE') || 'EH_Observability';
    report.ok('Configuration', 'Environment variables', 'All required vars present');
  } catch (e) {
    report.fail('Configuration', 'Environment variables', e.message);
    if (opts.json) {
      console.log(JSON.stringify(report.toJSON(), null, 2));
    } else {
      report.print({ quiet: opts.quiet });
    }
    process.exit(2);
  }

  // Run checks in a logical order (auth first, then dependent checks)

  // 1. Authentication
  const { fabricToken } = await checkAuthentication(report, tenantId, clientId, clientSecret, kustoUri);
  const { kustoToken } = await checkKustoAuth(report, tenantId, clientId, clientSecret, kustoUri);

  // 2. Fabric API checks
  const workspaceToCheck = opts.workspace || OBS_WORKSPACE_ID;
  await checkWorkspaces(report, fabricToken, opts.workspace);
  await checkWorkspaceItems(report, fabricToken, workspaceToCheck);

  // 3. Eventhouse checks
  await checkEventhouse(report, kustoToken, kustoUri, database);

  // 4. Notebook schedule checks
  await checkNotebookSchedules(report, kustoToken, kustoUri, database);

  // 5. SLO health
  await checkSloHealth(report, kustoToken, kustoUri, database);

  // 6. Alert state
  await checkAlerts(report, kustoToken, kustoUri, database);

  // Output
  if (opts.json) {
    console.log(JSON.stringify(report.toJSON(), null, 2));
  } else {
    report.print({ quiet: opts.quiet });
  }

  // Exit code
  process.exit(report.hasFail ? 1 : 0);
}

main().catch((e) => {
  console.error('');
  console.error(`  [FATAL] ${e.message}`);
  if (e.stack) {
    // Only show stack in non-production for debugging
    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    if (!isCI) console.error(e.stack);
  }
  console.error('');
  process.exit(2);
});
