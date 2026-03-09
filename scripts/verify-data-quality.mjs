/**
 * Verify data quality in Eventhouse after notebook fixes
 * Checks SloSnapshots, EventCorrelations, AlertLog for correctness
 */
import https from 'https';
import { execSync } from 'child_process';

function getEnvVar(name) {
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
const KUSTO_URI = 'https://trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com';
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

  console.log('=== DATA QUALITY VERIFICATION ===\n');

  // 1. SloSnapshots — check for valid data
  console.log('--- SloSnapshots (latest per item/metric) ---');
  const snapshots = await query(token, `
    SloSnapshots
    | summarize arg_max(ComputedAt, *) by ItemId, MetricType
    | project MetricType, CurrentValue, TargetValue, IsBreaching, ErrorBudgetRemaining, ComputedAt
    | order by MetricType asc, IsBreaching desc
  `);
  for (const s of snapshots) {
    const status = s.IsBreaching ? 'BREACHING' : 'healthy';
    console.log(`  [${status}] ${s.MetricType}: current=${s.CurrentValue} target=${s.TargetValue} budget=${s.ErrorBudgetRemaining} @${s.ComputedAt}`);
  }
  console.log(`  Total: ${snapshots.length} latest snapshots\n`);

  // 2. EventCorrelations — check for valid guid pairs
  console.log('--- EventCorrelations ---');
  const corrs = await query(token, `
    EventCorrelations
    | project UpstreamEventId, DownstreamEventId, RelationshipType, ConfidenceScore, DetectedAt
    | order by DetectedAt desc
  `);
  let validCorrs = 0;
  for (const c of corrs) {
    const upValid = c.UpstreamEventId && c.UpstreamEventId !== '00000000-0000-0000-0000-000000000000';
    const downValid = c.DownstreamEventId && c.DownstreamEventId !== '00000000-0000-0000-0000-000000000000';
    const status = (upValid && downValid) ? 'OK' : 'BAD';
    if (status === 'OK') validCorrs++;
    console.log(`  [${status}] ${c.RelationshipType} (${c.ConfidenceScore}) up=${c.UpstreamEventId?.substring(0, 8)} down=${c.DownstreamEventId?.substring(0, 8)}`);
  }
  console.log(`  Valid: ${validCorrs}/${corrs.length}\n`);

  // 3. AlertLog — recent alerts
  console.log('--- AlertLog (last 10) ---');
  const alerts = await query(token, `
    AlertLog
    | order by Timestamp desc
    | take 10
    | project Severity, Kind, ItemName, Message, Value, Threshold, Timestamp
  `);
  for (const a of alerts) {
    const icon = a.Severity === 'critical' ? 'CRIT' : 'WARN';
    console.log(`  [${icon}] ${a.Kind}: ${a.ItemName} — ${a.Message} (${a.Value}/${a.Threshold}) @${a.Timestamp}`);
  }
  console.log(`  Total alerts in log: ${(await query(token, 'AlertLog | count'))[0]?.Count}\n`);

  // 4. FabricEvents — status distribution
  console.log('--- FabricEvents Status Distribution ---');
  const statuses = await query(token, `
    FabricEvents
    | summarize Count=count() by Status
    | order by Count desc
  `);
  for (const s of statuses) {
    console.log(`  ${s.Status}: ${s.Count}`);
  }

  // 5. Dedup check
  console.log('\n--- Dedup Verification ---');
  const dedupCheck = await query(token, `
    FabricEvents
    | summarize Copies=count() by EventId
    | where Copies > 1
    | count
  `);
  const dupes = dedupCheck[0]?.Count || 0;
  console.log(`  Duplicate EventIds: ${dupes} ${dupes === 0 ? '(CLEAN)' : '(NEEDS ATTENTION)'}`);

  // 6. Data freshness
  console.log('\n--- Data Freshness ---');
  const freshness = await query(token, `
    FabricEvents | summarize LastEvent=max(IngestedAt) | extend AgeMinutes=datetime_diff('minute', now(), LastEvent);
    `);
  if (freshness[0]) {
    console.log(`  Last event ingested: ${freshness[0].LastEvent} (${freshness[0].AgeMinutes} minutes ago)`);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

main().catch(e => console.error('Error:', e.message));
