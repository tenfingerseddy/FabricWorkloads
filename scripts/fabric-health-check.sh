#!/bin/bash
# fabric-health-check.sh — Open source Fabric health check tool
# Quick one-liner to check the health of your Microsoft Fabric environment
# Part of the Observability Workbench project
#
# Usage: FABRIC_TENANT_ID=xxx FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=xxx ./fabric-health-check.sh

set -euo pipefail

echo "🔍 Fabric Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get token
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/${FABRIC_TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${FABRIC_CLIENT_ID}&client_secret=${FABRIC_CLIENT_SECRET}&scope=https://api.fabric.microsoft.com/.default&grant_type=client_credentials" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed. Check your FABRIC_TENANT_ID, FABRIC_CLIENT_ID, and FABRIC_CLIENT_SECRET."
  exit 1
fi

echo "✅ Authentication successful"
echo ""

# List workspaces
echo "📁 Workspaces"
echo "──────────────────────────────────────────────────────"
WORKSPACES=$(curl -s "https://api.fabric.microsoft.com/v1/workspaces" \
  -H "Authorization: Bearer $TOKEN")

echo "$WORKSPACES" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const ws = JSON.parse(d).value || [];
  ws.forEach(w => {
    console.log('  ' + w.displayName.padEnd(30) + w.id);
  });
  console.log('  Total: ' + ws.length + ' workspace(s)');
});
"
echo ""

# For each workspace, count items and check recent jobs
echo "📊 Item Inventory & Recent Jobs"
echo "──────────────────────────────────────────────────────"
echo "$WORKSPACES" | node -e "
const https = require('https');
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end', async ()=>{
  const ws = JSON.parse(d).value || [];
  const token = '$TOKEN';
  const jobTypes = new Set(['DataPipeline','Notebook','CopyJob','Lakehouse','SemanticModel','Dataflow']);

  for (const w of ws) {
    // Get items
    const items = await get('/v1/workspaces/' + w.id + '/items', token);
    const typeCounts = {};
    items.forEach(i => { typeCounts[i.type] = (typeCounts[i.type]||0)+1; });

    console.log('  ' + w.displayName);
    Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => {
      console.log('    ' + t.padEnd(20) + c);
    });

    // Check recent jobs for job-supporting items
    const jobItems = items.filter(i => jobTypes.has(i.type));
    let totalJobs = 0, failedJobs = 0;
    for (const item of jobItems.slice(0, 10)) { // limit to avoid rate limits
      try {
        const jobs = await get('/v1/workspaces/' + w.id + '/items/' + item.id + '/jobs/instances', token);
        totalJobs += jobs.length;
        failedJobs += jobs.filter(j => j.status === 'Failed').length;
      } catch(e) {}
    }
    if (totalJobs > 0) {
      console.log('    ─── Recent Jobs: ' + totalJobs + ' total, ' + failedJobs + ' failed');
    }
    console.log('');
  }
});

function get(path, token) {
  return new Promise((resolve, reject) => {
    const u = new URL('https://api.fabric.microsoft.com' + path);
    https.get({hostname:u.hostname, path:u.pathname+u.search, headers:{Authorization:'Bearer '+token}}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{try{resolve(JSON.parse(d).value||[])}catch(e){resolve([])}});
    }).on('error',()=>resolve([]));
  });
}
" 2>/dev/null

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Health check complete. For deeper observability, check out the Observability Workbench."
echo "https://github.com/your-org/observability-workbench"
