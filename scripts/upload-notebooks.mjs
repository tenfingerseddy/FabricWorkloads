/**
 * Upload Fabric Notebooks via updateDefinition API
 *
 * Converts .py notebook files to ipynb format, base64-encodes them,
 * and uploads via the Fabric REST API.
 *
 * Usage: node upload-notebooks.mjs
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import https from 'https';

// ── Configuration ──────────────────────────────────────────────────────────────

function getEnvVar(name) {
  // Try process.env first (might be set in current shell)
  if (process.env[name]) return process.env[name];
  // Fall back to reading from Windows User environment via PowerShell
  try {
    const val = execSync(
      `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`,
      { encoding: 'utf-8' }
    ).trim();
    if (val && val !== '') return val;
  } catch {}
  // Try Machine scope
  try {
    const val = execSync(
      `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'Machine')"`,
      { encoding: 'utf-8' }
    ).trim();
    if (val && val !== '') return val;
  } catch {}
  return null;
}

const TENANT_ID = getEnvVar('FABRIC_TENANT_ID');
const CLIENT_ID = getEnvVar('FABRIC_CLIENT_ID');
const CLIENT_SECRET = getEnvVar('FABRIC_CLIENT_SECRET');

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Missing FABRIC_TENANT_ID, FABRIC_CLIENT_ID, or FABRIC_CLIENT_SECRET');
  process.exit(1);
}

// Notebook ID prefixes (short form). Full GUIDs will be resolved from workspace items.
const NOTEBOOKS = [
  {
    name: 'NB_ObsIngestion',
    idPrefix: 'b157ef6d',
    file: 'D:/AI Agency/products/observability-workbench/notebooks/NB_ObsIngestion.py',
  },
  {
    name: 'NB_ObsCorrelation',
    idPrefix: '177c7991',
    file: 'D:/AI Agency/products/observability-workbench/notebooks/NB_ObsCorrelation.py',
  },
  {
    name: 'NB_ObsAlerts',
    idPrefix: 'd0899650',
    file: 'D:/AI Agency/products/observability-workbench/notebooks/NB_ObsAlerts.py',
  },
];

const FABRIC_API = 'https://api.fabric.microsoft.com';

// ── HTTP helpers ───────────────────────────────────────────────────────────────

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Authentication ─────────────────────────────────────────────────────────────

async function getToken() {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://api.fabric.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const resp = await httpsRequest(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, params.toString());

  if (resp.status !== 200) {
    throw new Error(`Token request failed (${resp.status}): ${resp.body}`);
  }

  const tokenData = JSON.parse(resp.body);
  return tokenData.access_token;
}

// ── Workspace lookup ───────────────────────────────────────────────────────────

async function getWorkspaceId(token) {
  const resp = await httpsRequest(`${FABRIC_API}/v1/workspaces`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (resp.status !== 200) {
    throw new Error(`Workspace list failed (${resp.status}): ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  const ws = data.value.find((w) => w.displayName === 'ObservabilityWorkbench-Dev');
  if (!ws) {
    // Try partial match on the known ID prefix
    const wsByPrefix = data.value.find((w) => w.id.startsWith('910a8092'));
    if (wsByPrefix) return wsByPrefix.id;
    console.error('Available workspaces:', data.value.map(w => `${w.displayName} (${w.id})`));
    throw new Error('Workspace ObservabilityWorkbench-Dev not found');
  }
  return ws.id;
}

// ── Resolve notebook IDs from workspace items ─────────────────────────────────

async function resolveNotebookIds(token, workspaceId) {
  console.log('\n   Listing workspace items to resolve notebook IDs...');
  const resp = await httpsRequest(`${FABRIC_API}/v1/workspaces/${workspaceId}/items`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (resp.status !== 200) {
    throw new Error(`Item list failed (${resp.status}): ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  const items = data.value || [];
  const notebooks = items.filter((i) => i.type === 'Notebook');
  console.log(`   Found ${notebooks.length} notebook(s) in workspace:`);
  for (const nb of notebooks) {
    console.log(`     - ${nb.displayName} (${nb.id})`);
  }

  // Resolve each notebook by display name or ID prefix
  for (const nb of NOTEBOOKS) {
    // Try matching by display name first
    let found = notebooks.find((i) => i.displayName === nb.name);
    if (!found) {
      // Try matching by ID prefix
      found = notebooks.find((i) => i.id.startsWith(nb.idPrefix));
    }
    if (found) {
      nb.id = found.id;
      console.log(`   Resolved ${nb.name}: ${nb.id}`);
    } else {
      throw new Error(`Could not find notebook ${nb.name} (prefix: ${nb.idPrefix}) in workspace`);
    }
  }
}

// ── Convert .py to ipynb ───────────────────────────────────────────────────────

function pyToIpynb(pyContent) {
  // Split the content by cell markers (# Cell N: ...)
  // Each cell is separated by the pattern: # Cell N: Title\n# ─────
  const cellPattern = /^# Cell \d+:.*\n# ─+$/gm;

  // Find all cell boundaries
  const markers = [];
  let match;
  while ((match = cellPattern.exec(pyContent)) !== null) {
    markers.push({ index: match.index, length: match[0].length });
  }

  let cells = [];

  if (markers.length === 0) {
    // No cell markers — wrap entire content as one cell
    cells.push(pyContent);
  } else {
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index + markers[i].length;
      const end = i + 1 < markers.length ? markers[i].index + markers[i].length : undefined;

      // Get content between this marker and the next
      let cellContent;
      if (i + 1 < markers.length) {
        cellContent = pyContent.substring(start, markers[i + 1].index);
      } else {
        cellContent = pyContent.substring(start);
      }

      // Clean up: remove leading/trailing blank lines but keep cell marker as comment
      const markerText = pyContent.substring(markers[i].index, markers[i].index + markers[i].length);
      cellContent = markerText + '\n' + cellContent.replace(/^\n+/, '');
      // Trim trailing whitespace/newlines
      cellContent = cellContent.replace(/\s+$/, '') + '\n';

      cells.push(cellContent);
    }
  }

  // Build the ipynb JSON structure
  const notebookCells = cells.map((cellSource) => {
    // Split source into lines, each ending with \n (except possibly the last)
    const lines = cellSource.split('\n');
    const sourceLines = lines.map((line, idx) => {
      // Every line gets \n except the very last empty one
      if (idx < lines.length - 1) {
        return line + '\n';
      }
      return line.length > 0 ? line + '\n' : '';
    }).filter((line, idx, arr) => {
      // Remove trailing empty string
      if (idx === arr.length - 1 && line === '') return false;
      return true;
    });

    return {
      cell_type: 'code',
      execution_count: null,
      metadata: {},
      outputs: [],
      source: sourceLines,
    };
  });

  const ipynb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      language_info: {
        name: 'python',
      },
      kernel_info: {
        name: 'synapse_pyspark',
      },
      kernelspec: {
        display_name: 'Synapse PySpark',
        language: 'Python',
        name: 'synapse_pyspark',
      },
    },
    cells: notebookCells,
  };

  return JSON.stringify(ipynb);
}

// ── Upload notebook ────────────────────────────────────────────────────────────

async function uploadNotebook(token, workspaceId, notebookId, notebookName, pyFilePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Uploading: ${notebookName} (${notebookId})`);
  console.log(`  File: ${pyFilePath}`);

  // Read the .py file
  const pyContent = readFileSync(pyFilePath, 'utf-8');
  console.log(`  Python file: ${pyContent.length} chars, ${pyContent.split('\n').length} lines`);

  // Convert to ipynb
  const ipynbJson = pyToIpynb(pyContent);
  console.log(`  ipynb JSON: ${ipynbJson.length} chars`);

  // Base64 encode
  const base64Payload = Buffer.from(ipynbJson, 'utf-8').toString('base64');
  console.log(`  Base64 payload: ${base64Payload.length} chars`);

  // Build the request body
  const requestBody = JSON.stringify({
    definition: {
      format: 'ipynb',
      parts: [
        {
          path: 'notebook-content.ipynb',
          payload: base64Payload,
          payloadType: 'InlineBase64',
        },
      ],
    },
  });

  // POST to updateDefinition
  const updateUrl = `${FABRIC_API}/v1/workspaces/${workspaceId}/notebooks/${notebookId}/updateDefinition`;
  console.log(`  POST ${updateUrl}`);

  const resp = await httpsRequest(updateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, requestBody);

  console.log(`  Response: ${resp.status}`);

  if (resp.status === 200) {
    console.log(`  SUCCESS: Definition updated synchronously`);
    return true;
  }

  if (resp.status === 202) {
    // Async operation — poll for completion
    const operationUrl = resp.headers['location'];
    const retryAfter = parseInt(resp.headers['retry-after'] || '5', 10);
    console.log(`  Accepted (async). Operation URL: ${operationUrl}`);
    console.log(`  Retry-After: ${retryAfter}s`);

    if (operationUrl) {
      return await pollOperation(token, operationUrl, retryAfter);
    }

    // If no location header, try to extract operation ID from response
    console.log(`  No Location header. Response body: ${resp.body.substring(0, 500)}`);
    return true; // Assume success if 202 with no location
  }

  // Error
  console.error(`  FAILED: ${resp.status}`);
  console.error(`  Response body: ${resp.body.substring(0, 1000)}`);
  return false;
}

// ── Poll operation ─────────────────────────────────────────────────────────────

async function pollOperation(token, operationUrl, initialDelay) {
  const maxAttempts = 30;
  let delay = initialDelay * 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    console.log(`  Polling attempt ${attempt}/${maxAttempts}...`);

    const resp = await httpsRequest(operationUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (resp.status === 200) {
      let opData;
      try {
        opData = JSON.parse(resp.body);
      } catch {
        console.log(`  Poll response: ${resp.body.substring(0, 300)}`);
        continue;
      }

      const status = opData.status || opData.Status || '';
      console.log(`  Operation status: ${status}`);

      if (status === 'Succeeded' || status === 'succeeded') {
        console.log(`  SUCCESS: Operation completed`);
        return true;
      }
      if (status === 'Failed' || status === 'failed') {
        console.error(`  FAILED: ${JSON.stringify(opData.error || opData)}`);
        return false;
      }
      if (status === 'Cancelled' || status === 'cancelled') {
        console.error(`  CANCELLED`);
        return false;
      }

      // Still running, update delay from retry-after if available
      delay = (parseInt(resp.headers['retry-after'] || '5', 10)) * 1000;
    } else {
      console.log(`  Poll returned ${resp.status}: ${resp.body.substring(0, 300)}`);
      delay = 5000;
    }
  }

  console.error(`  TIMEOUT: Operation did not complete after ${maxAttempts} attempts`);
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fabric Notebook Upload Script');
  console.log('='.repeat(60));

  // 1. Get token
  console.log('\n1. Acquiring access token...');
  const token = await getToken();
  console.log(`   Token acquired (${token.length} chars)`);

  // 2. Get workspace ID
  console.log('\n2. Looking up workspace...');
  const workspaceId = await getWorkspaceId(token);
  console.log(`   Workspace ID: ${workspaceId}`);

  // 3. Resolve full notebook IDs
  console.log('\n3. Resolving notebook IDs...');
  await resolveNotebookIds(token, workspaceId);

  // 4. Upload each notebook
  console.log('\n4. Uploading notebooks...');
  const results = [];

  for (const nb of NOTEBOOKS) {
    const success = await uploadNotebook(token, workspaceId, nb.id, nb.name, nb.file);
    results.push({ name: nb.name, success });
  }

  // 5. Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Upload Summary:');
  for (const r of results) {
    console.log(`  ${r.success ? 'OK' : 'FAIL'}: ${r.name}`);
  }

  const allSuccess = results.every((r) => r.success);
  console.log(`\nOverall: ${allSuccess ? 'ALL SUCCEEDED' : 'SOME FAILED'}`);
  process.exit(allSuccess ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
