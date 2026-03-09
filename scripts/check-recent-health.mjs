#!/usr/bin/env node
/**
 * check-recent-health.mjs
 *
 * Compares recent (6h) vs all-time success rates for the three
 * Observability Workbench notebooks. Also shows recent failures and
 * schedule frequency.
 *
 * Environment variables (all required):
 *   FABRIC_TENANT_ID
 *   FABRIC_CLIENT_ID
 *   FABRIC_CLIENT_SECRET
 *   EVENTHOUSE_QUERY_ENDPOINT  (or KQL_QUERY_ENDPOINT as fallback)
 *   KQL_DATABASE               (optional, defaults to EH_Observability)
 *
 * Exit codes:
 *   0  All notebooks healthy in the last 6 hours
 *   1  One or more notebooks have recent failures or no recent runs
 *   2  Script-level error (auth failure, network issue, etc.)
 */

import https from 'https';
import { execSync } from 'child_process';

// ── Configuration ──────────────────────────────────────────────────

const NOTEBOOKS = ['NB_ObsIngestion', 'NB_ObsAlerts', 'NB_ObsCorrelation'];
const RECENT_WINDOW = '6h';
const FAILURE_LOOKBACK = '12h';

// ── Secure environment variable loader ─────────────────────────────

function getEnvVar(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid env var name: ${name}`);
  }
  // 1. Check process-level env first (works in CI, Docker, etc.)
  if (process.env[name]) return process.env[name];
  // 2. Fall back to Windows User env (for local dev on Windows)
  try {
    const val = execSync(
      `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (val && val !== '') return val;
  } catch {
    // PowerShell not available (Linux CI, etc.) -- that is fine
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

// ── Load config ────────────────────────────────────────────────────

const TENANT_ID = requireEnv('FABRIC_TENANT_ID');
const CLIENT_ID = requireEnv('FABRIC_CLIENT_ID');
const CLIENT_SECRET = requireEnv('FABRIC_CLIENT_SECRET');
const KUSTO_URI = getEnvVar('EVENTHOUSE_QUERY_ENDPOINT') || getEnvVar('KQL_QUERY_ENDPOINT');
if (!KUSTO_URI) {
  throw new Error(
    'Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT (or KQL_QUERY_ENDPOINT). ' +
    'Set it to your Eventhouse KQL query endpoint URL.'
  );
}
const KUSTO_DB = getEnvVar('KQL_DATABASE') || 'EH_Observability';

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

// ── Auth ───────────────────────────────────────────────────────────

async function acquireToken() {
  const tokenResp = await httpsRequest(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: `${KUSTO_URI}/.default`,
      grant_type: 'client_credentials',
    }).toString()
  );

  if (tokenResp.status !== 200) {
    let detail = '';
    try {
      const errBody = JSON.parse(tokenResp.body);
      detail = errBody.error_description || errBody.error || tokenResp.body;
    } catch {
      detail = tokenResp.body;
    }
    throw new Error(`Authentication failed (HTTP ${tokenResp.status}): ${detail}`);
  }

  const parsed = JSON.parse(tokenResp.body);
  if (!parsed.access_token) {
    throw new Error('Authentication succeeded but response contained no access_token');
  }
  return parsed.access_token;
}

// ── KQL query helper ───────────────────────────────────────────────

async function query(token, kql) {
  const resp = await httpsRequest(
    `${KUSTO_URI}/v1/rest/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ db: KUSTO_DB, csl: kql })
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

// ── Formatting helpers ─────────────────────────────────────────────

function statusBadge(rate) {
  if (rate === null) return '  --  ';
  if (rate >= 95) return '  OK  ';
  if (rate >= 80) return ' WARN ';
  return ' FAIL ';
}

function pad(s, len) {
  return String(s).padEnd(len);
}

function rpad(s, len) {
  return String(s).padStart(len);
}

function separator(char = '-', len = 78) {
  return char.repeat(len);
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  } catch {
    return String(ts);
  }
}

function timeSince(ts) {
  if (!ts) return '';
  try {
    const diffMs = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ago`;
  } catch {
    return '';
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log(separator('='));
  console.log('  Observability Workbench -- Notebook Health Report');
  console.log(`  ${new Date().toISOString()}  |  DB: ${KUSTO_DB}`);
  console.log(separator('='));

  // Authenticate
  console.log('\n  Authenticating...');
  const token = await acquireToken();
  console.log('  Authentication successful.\n');

  // ── Section 1: Health summary table ──────────────────────────────

  console.log(separator('-'));
  console.log('  1. NOTEBOOK HEALTH SUMMARY (recent vs all-time)');
  console.log(separator('-'));

  const notebookList = NOTEBOOKS.map((n) => `'${n}'`).join(', ');
  const rows = await query(
    token,
    `FabricEvents
    | where ItemName in (${notebookList})
    | summarize
        Total = count(),
        Succeeded = countif(Status == 'Completed'),
        Failed = countif(Status == 'Failed'),
        InProgress = countif(Status == 'InProgress'),
        Recent_OK = countif(Status == 'Completed' and StartTimeUtc > ago(${RECENT_WINDOW})),
        Recent_Fail = countif(Status == 'Failed' and StartTimeUtc > ago(${RECENT_WINDOW})),
        LastRun = max(StartTimeUtc),
        LastSuccess = maxif(StartTimeUtc, Status == 'Completed'),
        LastFail = maxif(StartTimeUtc, Status == 'Failed')
      by ItemName`
  );

  // Track overall health for exit code
  let hasFailure = false;
  let hasWarning = false;

  // Header
  console.log('');
  console.log(
    `  ${pad('Notebook', 22)} ${rpad('All-Time', 10)} ${rpad('Last 6h', 10)} ${pad('Status', 8)} Last Run`
  );
  console.log(`  ${separator('-', 76)}`);

  for (const r of rows) {
    const historicRate = r.Total > 0 ? ((r.Succeeded / r.Total) * 100) : null;
    const recentTotal = r.Recent_OK + r.Recent_Fail;
    const recentRate = recentTotal > 0 ? ((r.Recent_OK / recentTotal) * 100) : null;

    const badge = statusBadge(recentRate);
    if (recentRate !== null && recentRate < 95) hasWarning = true;
    if (recentRate !== null && recentRate < 80) hasFailure = true;
    if (recentRate === null && r.Total > 0) hasWarning = true;

    const historicStr = historicRate !== null ? `${historicRate.toFixed(1)}%` : 'N/A';
    const recentStr = recentRate !== null ? `${recentRate.toFixed(1)}%` : 'No runs';
    const lastRunStr = timeSince(r.LastRun);

    console.log(
      `  ${pad(r.ItemName, 22)} ${rpad(historicStr, 10)} ${rpad(recentStr, 10)} [${badge}] ${lastRunStr}`
    );
  }

  // Detail breakdown
  console.log('');
  for (const r of rows) {
    const historicRate = r.Total > 0 ? ((r.Succeeded / r.Total) * 100).toFixed(1) : 'N/A';
    const recentTotal = r.Recent_OK + r.Recent_Fail;
    const recentRate = recentTotal > 0 ? ((r.Recent_OK / recentTotal) * 100).toFixed(1) : 'No recent runs';

    console.log(`  ${r.ItemName}`);
    console.log(`    All-time : ${r.Succeeded}/${r.Total} = ${historicRate}% (${r.Failed} failed, ${r.InProgress} in-progress)`);
    console.log(`    Last 6h  : ${r.Recent_OK}/${recentTotal} = ${recentRate}`);
    console.log(`    Last run : ${formatTimestamp(r.LastRun)} (${timeSince(r.LastRun)})`);
    console.log(`    Last OK  : ${formatTimestamp(r.LastSuccess)}`);
    console.log(`    Last fail: ${formatTimestamp(r.LastFail)}`);
    console.log('');
  }

  // ── Section 2: Recent failures ───────────────────────────────────

  console.log(separator('-'));
  console.log(`  2. RECENT FAILURES (last ${FAILURE_LOOKBACK})`);
  console.log(separator('-'));

  const recentFailures = await query(
    token,
    `FabricEvents
    | where ItemName in (${notebookList})
      and Status == 'Failed'
      and StartTimeUtc > ago(${FAILURE_LOOKBACK})
    | project ItemName, StartTimeUtc, FailureReason
    | order by StartTimeUtc desc
    | take 10`
  );

  if (recentFailures.length === 0) {
    console.log(`\n  No failures in the last ${FAILURE_LOOKBACK} -- all notebooks healthy.\n`);
  } else {
    hasFailure = true;
    console.log('');
    for (const f of recentFailures) {
      const reason = (f.FailureReason || 'unknown').substring(0, 100);
      console.log(`  [FAIL] ${pad(f.ItemName, 20)} ${formatTimestamp(f.StartTimeUtc)}`);
      console.log(`         ${reason}`);
    }
    console.log('');
  }

  // ── Section 3: Schedule frequency ────────────────────────────────

  console.log(separator('-'));
  console.log('  3. SCHEDULE FREQUENCY (last 24h)');
  console.log(separator('-'));

  const frequency = await query(
    token,
    `FabricEvents
    | where ItemName in (${notebookList})
      and StartTimeUtc > ago(24h)
    | summarize
        Runs = count(),
        AvgDuration = avg(DurationSeconds)
      by ItemName, bin(StartTimeUtc, 1h)
    | summarize
        RunsPerDay = sum(Runs),
        AvgRunsPerHour = avg(Runs),
        AvgDurationSec = avg(AvgDuration)
      by ItemName`
  );

  console.log('');
  console.log(`  ${pad('Notebook', 22)} ${rpad('Runs/24h', 10)} ${rpad('Runs/hr', 10)} ${rpad('Avg Duration', 14)}`);
  console.log(`  ${separator('-', 56)}`);

  for (const r of frequency) {
    const avgDur = r.AvgDurationSec != null ? `${r.AvgDurationSec.toFixed(0)}s` : 'N/A';
    const runsHr = r.AvgRunsPerHour != null ? r.AvgRunsPerHour.toFixed(1) : 'N/A';
    console.log(
      `  ${pad(r.ItemName, 22)} ${rpad(r.RunsPerDay, 10)} ${rpad(runsHr, 10)} ${rpad(avgDur, 14)}`
    );
  }

  // ── Summary ──────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(separator('='));
  const overallStatus = hasFailure ? 'UNHEALTHY' : hasWarning ? 'DEGRADED' : 'HEALTHY';
  console.log(`  Overall: ${overallStatus}  |  Completed in ${elapsed}s`);
  console.log(separator('='));
  console.log('');

  // Return appropriate exit code
  if (hasFailure) process.exit(1);
}

main().catch((e) => {
  console.error('');
  console.error(`  [ERROR] ${e.message}`);
  if (e.cause) console.error(`  [CAUSE] ${e.cause}`);
  console.error('');
  process.exit(2);
});
