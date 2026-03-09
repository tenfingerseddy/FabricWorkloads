/**
 * Check recent vs historic success rates for our notebooks
 */
import https from 'https';
import { execSync } from 'child_process';

function getEnvVar(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid env var name: ${name}`);
  if (process.env[name]) return process.env[name];
  try {
    const val = execSync(
      `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`,
      { encoding: 'utf-8' }
    ).trim();
    if (val && val !== '') return val;
  } catch {}
  return null;
}

const TENANT_ID = getEnvVar('FABRIC_TENANT_ID');
const CLIENT_ID = getEnvVar('FABRIC_CLIENT_ID');
const CLIENT_SECRET = getEnvVar('FABRIC_CLIENT_SECRET');
const KUSTO_URI = getEnvVar('EVENTHOUSE_QUERY_ENDPOINT') || (() => { throw new Error('Missing EVENTHOUSE_QUERY_ENDPOINT env var'); })();
const KUSTO_DB = 'EH_Observability';

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function query(token, kql) {
  const resp = await httpsRequest(
    `${KUSTO_URI}/v1/rest/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    JSON.stringify({ db: KUSTO_DB, csl: kql })
  );
  const data = JSON.parse(resp.body);
  const table = data.Tables?.[0];
  if (!table) return [];
  const cols = table.Columns.map(c => c.ColumnName);
  return table.Rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

async function main() {
  const tokenResp = await httpsRequest(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      scope: `${KUSTO_URI}/.default`, grant_type: 'client_credentials',
    }).toString()
  );
  const token = JSON.parse(tokenResp.body).access_token;

  console.log('=== Notebook Health (Recent vs Historic) ===\n');

  const rows = await query(token, `
    FabricEvents
    | where ItemName in ('NB_ObsIngestion', 'NB_ObsAlerts', 'NB_ObsCorrelation')
    | summarize
        Total=count(),
        Succeeded=countif(Status == 'Completed'),
        Failed=countif(Status == 'Failed'),
        InProgress=countif(Status == 'InProgress'),
        Recent_OK=countif(Status == 'Completed' and StartTimeUtc > ago(6h)),
        Recent_Fail=countif(Status == 'Failed' and StartTimeUtc > ago(6h)),
        LastRun=max(StartTimeUtc),
        LastSuccess=maxif(StartTimeUtc, Status == 'Completed'),
        LastFail=maxif(StartTimeUtc, Status == 'Failed')
      by ItemName
  `);

  for (const r of rows) {
    const historicRate = r.Total > 0 ? ((r.Succeeded / r.Total) * 100).toFixed(1) : 'N/A';
    const recentTotal = r.Recent_OK + r.Recent_Fail;
    const recentRate = recentTotal > 0 ? ((r.Recent_OK / recentTotal) * 100).toFixed(1) : 'No recent runs';
    console.log(`${r.ItemName}:`);
    console.log(`  All-time: ${r.Succeeded}/${r.Total} = ${historicRate}% (${r.Failed} failed, ${r.InProgress} in-progress)`);
    console.log(`  Last 6h:  ${r.Recent_OK}/${recentTotal} = ${recentRate}`);
    console.log(`  Last run: ${r.LastRun}`);
    console.log(`  Last success: ${r.LastSuccess}`);
    console.log(`  Last failure: ${r.LastFail}`);
    console.log();
  }

  // Check if failures are all historical (before our fixes)
  console.log('=== Recent Failures (last 12h) ===\n');
  const recentFailures = await query(token, `
    FabricEvents
    | where ItemName in ('NB_ObsIngestion', 'NB_ObsAlerts', 'NB_ObsCorrelation')
      and Status == 'Failed'
      and StartTimeUtc > ago(12h)
    | project ItemName, StartTimeUtc, FailureReason
    | order by StartTimeUtc desc
    | take 10
  `);

  if (recentFailures.length === 0) {
    console.log('  No failures in the last 12 hours — all notebooks healthy since fixes!');
  } else {
    for (const f of recentFailures) {
      console.log(`  ${f.ItemName} @ ${f.StartTimeUtc}: ${(f.FailureReason || 'unknown').substring(0, 120)}`);
    }
  }

  // Check schedule status
  console.log('\n=== Notebook Schedule Frequency ===\n');
  const frequency = await query(token, `
    FabricEvents
    | where ItemName in ('NB_ObsIngestion', 'NB_ObsAlerts', 'NB_ObsCorrelation')
      and StartTimeUtc > ago(24h)
    | summarize Runs=count(), AvgDuration=avg(DurationSeconds) by ItemName, bin(StartTimeUtc, 1h)
    | summarize RunsPerDay=sum(Runs), AvgRunsPerHour=avg(Runs), AvgDuration=avg(AvgDuration) by ItemName
  `);
  for (const r of frequency) {
    console.log(`  ${r.ItemName}: ${r.RunsPerDay} runs/24h, ~${r.AvgRunsPerHour?.toFixed(1)} per hour, avg ${r.AvgDuration?.toFixed(0)}s`);
  }
}

main().catch(e => console.error('Error:', e.message));
