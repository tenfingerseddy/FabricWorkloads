/**
 * Quick check of actual Eventhouse table schemas
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

async function main() {
  // Get token
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
  const token = JSON.parse(tokenResp.body).access_token;

  const tables = ['SloSnapshots', 'EventCorrelations', 'SloDefinitions', 'AlertLog', 'FabricEvents'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);

    // Get schema
    const resp = await httpsRequest(
      `${KUSTO_URI}/v1/rest/mgmt`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      JSON.stringify({ db: KUSTO_DB, csl: `.show table ${table} schema as json` })
    );
    const data = JSON.parse(resp.body);
    const row = data.Tables?.[0]?.Rows?.[0];
    if (row) {
      const schema = JSON.parse(row[1] || row[0]);
      if (schema.OrderedColumns) {
        schema.OrderedColumns.forEach(c => console.log(`  ${c.Name}: ${c.CslType || c.Type}`));
      }
    }

    // Get count
    const countResp = await httpsRequest(
      `${KUSTO_URI}/v1/rest/query`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      JSON.stringify({ db: KUSTO_DB, csl: `${table} | count` })
    );
    const countData = JSON.parse(countResp.body);
    const count = countData.Tables?.[0]?.Rows?.[0]?.[0];
    console.log(`  Rows: ${count}`);
  }
}

main().catch(e => console.error('Error:', e.message));
