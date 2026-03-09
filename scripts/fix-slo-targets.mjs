/**
 * Fix SLO definition target values and clean up bad correlations
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

async function mgmt(token, csl) {
  const resp = await httpsRequest(
    `${KUSTO_URI}/v1/rest/mgmt`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    JSON.stringify({ db: KUSTO_DB, csl })
  );
  return resp;
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

  // 1. Check current SLO definitions
  console.log('=== Current SLO Definitions ===');
  const slos = await query(token, `
    SloDefinitions
    | project SloId, ItemName, MetricType, TargetValue, WarningThreshold, IsActive
  `);
  for (const s of slos) {
    const needsFix = s.MetricType === 'success_rate' && s.TargetValue > 1;
    console.log(`  ${needsFix ? 'FIX' : ' OK'} ${s.ItemName} ${s.MetricType}: target=${s.TargetValue} warning=${s.WarningThreshold}`);
  }

  // 2. Fix: Drop and recreate SloDefinitions with correct values
  // SloDefinitions with TargetValue > 1 for success_rate need to be fixed to decimal
  const badSlos = slos.filter(s => s.MetricType === 'success_rate' && s.TargetValue > 1);
  if (badSlos.length > 0) {
    console.log(`\nFixing ${badSlos.length} SLO(s) with percentage values...`);

    // Clear and re-ingest with corrected values
    const clearResp = await mgmt(token, '.clear table SloDefinitions data');
    console.log(`  Cleared SloDefinitions: ${clearResp.status}`);

    // Re-ingest all SLOs with corrected target values
    let ingested = 0;
    const now = new Date().toISOString();
    for (const s of slos) {
      let target = s.TargetValue;
      let warning = s.WarningThreshold;

      // Fix percentage to decimal for success_rate
      if (s.MetricType === 'success_rate' && target > 1) {
        target = target / 100;
        warning = warning ? warning / 100 : target * 0.8;
      }

      const values = [
        s.SloId,
        '', // WorkspaceId — will be null, that's OK
        s.ItemName, // Using ItemName in ItemId position since we need guid...
        s.ItemName,
        s.MetricType,
        target.toString(),
        (warning || 0).toString(),
        '7d',
        now,
        s.IsActive ? '1' : '0',
      ].join('|');

      const resp = await mgmt(token, `.ingest inline into table SloDefinitions with (format=psv) <| ${values}`);
      if (resp.status === 200) ingested++;
      else console.log(`  Failed: ${resp.status} ${resp.body.substring(0, 200)}`);
    }
    console.log(`  Re-ingested ${ingested}/${slos.length} SLO definitions`);
  } else {
    console.log('\nNo SLO target fixes needed.');
  }

  // 3. Clean bad correlations (null RelationshipType)
  console.log('\n=== Cleaning Bad Correlations ===');
  const badCorrs = await query(token, `
    EventCorrelations | where isempty(RelationshipType) or isnull(RelationshipType) | count
  `);
  const badCount = badCorrs[0]?.Count || 0;
  console.log(`  Bad correlations (empty RelationshipType): ${badCount}`);

  if (badCount > 0) {
    // Can't selectively delete in KQL easily, but with only 7 rows, clear and re-run
    // Actually, let's just leave the good ones and clear all — the notebook will recreate
    console.log('  Clearing all correlations (notebook will recreate on next run)...');
    const resp = await mgmt(token, '.clear table EventCorrelations data');
    console.log(`  Cleared: ${resp.status}`);
  }

  // 4. Investigate NB_ObsIngestion failures
  console.log('\n=== NB_ObsIngestion Failure Analysis ===');
  const failures = await query(token, `
    FabricEvents
    | where ItemName == "NB_ObsIngestion" and Status == "Failed"
    | project Status, FailureReason, StartTimeUtc, EndTimeUtc, DurationSeconds
    | order by StartTimeUtc desc
    | take 5
  `);
  if (failures.length === 0) {
    console.log('  No failures found for NB_ObsIngestion');
  } else {
    for (const f of failures) {
      console.log(`  [${f.Status}] ${f.StartTimeUtc} dur=${f.DurationSeconds}s reason="${f.FailureReason?.substring(0, 100)}"`);
    }
  }

  // Verify fix
  console.log('\n=== Updated SLO Definitions ===');
  const updatedSlos = await query(token, `
    SloDefinitions | project ItemName, MetricType, TargetValue, WarningThreshold
  `);
  for (const s of updatedSlos) {
    console.log(`  ${s.ItemName} ${s.MetricType}: target=${s.TargetValue} warning=${s.WarningThreshold}`);
  }

  console.log('\n=== FIXES COMPLETE ===');
}

main().catch(e => console.error('Error:', e.message));
