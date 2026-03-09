import * as https from 'https';
import * as querystring from 'querystring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Credentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface WorkspaceResult {
  id: string;
  displayName: string;
  description: string;
  itemCounts: Record<string, number>;
  totalItems: number;
  recentJobs: {
    total: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    inProgress: number;
  };
  flaggedItems: FlaggedItem[];
  hasRecentActivity: boolean;
}

export interface FlaggedItem {
  id: string;
  displayName: string;
  type: string;
  failureRate: number;
  totalJobs: number;
  failedJobs: number;
}

export interface Issue {
  severity: 'warning' | 'critical';
  workspace: string;
  message: string;
}

export interface HealthCheckResults {
  authError: string | null;
  timestamp: string;
  summary: {
    totalWorkspaces: number;
    totalItems: number;
    totalRecentJobs: number;
    overallSuccessRate: number;
    healthScore: number;
  };
  workspaces: WorkspaceResult[];
  issues: Issue[];
}

// ---------------------------------------------------------------------------
// Fabric API constants
// ---------------------------------------------------------------------------

const FABRIC_API_HOST = 'api.fabric.microsoft.com';
const TOKEN_HOST = 'login.microsoftonline.com';
const FABRIC_SCOPE = 'https://api.fabric.microsoft.com/.default';

/** Item types that support job instances. */
const JOB_CAPABLE_TYPES = new Set([
  'DataPipeline',
  'Notebook',
  'CopyJob',
  'Lakehouse',
  'SemanticModel',
  'Dataflow',
  'SparkJobDefinition',
  'MLModel',
  'MLExperiment',
]);

// ---------------------------------------------------------------------------
// HTTP helpers (zero-dependency, uses built-in https)
// ---------------------------------------------------------------------------

interface HttpResponse {
  statusCode: number;
  body: string;
}

function httpsRequest(options: https.RequestOptions, body?: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error('Request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function fabricGet<T = unknown>(path: string, token: string): Promise<T[]> {
  const allItems: T[] = [];
  let url: string | null = path;

  while (url) {
    const isFullUrl = url.startsWith('http');
    const parsedPath = isFullUrl ? new URL(url).pathname + new URL(url).search : url;

    const res = await httpsRequest({
      hostname: FABRIC_API_HOST,
      path: parsedPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.statusCode === 429) {
      // Rate limited — wait and retry
      const retryAfter = 5;
      await sleep(retryAfter * 1000);
      continue;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      break;
    }

    try {
      const data = JSON.parse(res.body);
      const items = data.value ?? [];
      allItems.push(...items);
      url = data.continuationUri ?? data['@odata.nextLink'] ?? null;
    } catch {
      break;
    }
  }

  return allItems;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function authenticate(creds: Credentials): Promise<string> {
  const body = querystring.stringify({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: FABRIC_SCOPE,
    grant_type: 'client_credentials',
  });

  const res = await httpsRequest(
    {
      hostname: TOKEN_HOST,
      path: `/${creds.tenantId}/oauth2/v2.0/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    let detail = '';
    try {
      const parsed = JSON.parse(res.body);
      detail = parsed.error_description || parsed.error || '';
    } catch {
      detail = res.body.slice(0, 200);
    }
    throw new Error(`Authentication failed (HTTP ${res.statusCode}): ${detail}`);
  }

  const data = JSON.parse(res.body);
  if (!data.access_token) {
    throw new Error('Authentication response did not include an access token');
  }

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Workspace analysis
// ---------------------------------------------------------------------------

interface FabricItem {
  id: string;
  displayName: string;
  type: string;
}

interface JobInstance {
  id: string;
  status: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
}

async function analyzeWorkspace(
  workspaceId: string,
  workspaceName: string,
  token: string
): Promise<WorkspaceResult> {
  // Fetch all items in the workspace
  const items = await fabricGet<FabricItem>(`/v1/workspaces/${workspaceId}/items`, token);

  // Count items by type
  const itemCounts: Record<string, number> = {};
  for (const item of items) {
    itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
  }

  // Identify job-capable items and check recent runs
  const jobCapableItems = items.filter((i) => JOB_CAPABLE_TYPES.has(i.type));
  const maxJobItems = 15; // cap to avoid rate limits
  const itemsToCheck = jobCapableItems.slice(0, maxJobItems);

  let totalJobs = 0;
  let succeededJobs = 0;
  let failedJobs = 0;
  let cancelledJobs = 0;
  let inProgressJobs = 0;
  const flaggedItems: FlaggedItem[] = [];

  for (const item of itemsToCheck) {
    try {
      const jobs = await fabricGet<JobInstance>(
        `/v1/workspaces/${workspaceId}/items/${item.id}/jobs/instances`,
        token
      );

      const itemTotal = jobs.length;
      const itemFailed = jobs.filter((j) => j.status === 'Failed').length;
      const itemSucceeded = jobs.filter((j) => j.status === 'Completed').length;
      const itemCancelled = jobs.filter((j) => j.status === 'Cancelled').length;
      const itemInProgress = jobs.filter(
        (j) => j.status === 'InProgress' || j.status === 'NotStarted'
      ).length;

      totalJobs += itemTotal;
      succeededJobs += itemSucceeded;
      failedJobs += itemFailed;
      cancelledJobs += itemCancelled;
      inProgressJobs += itemInProgress;

      // Flag items with >50% failure rate (minimum 2 jobs to avoid false positives)
      if (itemTotal >= 2 && itemFailed / itemTotal > 0.5) {
        flaggedItems.push({
          id: item.id,
          displayName: item.displayName,
          type: item.type,
          failureRate: Math.round((itemFailed / itemTotal) * 100),
          totalJobs: itemTotal,
          failedJobs: itemFailed,
        });
      }

      // Small delay between calls to be respectful of rate limits
      await sleep(200);
    } catch {
      // Silently skip items that fail — e.g. insufficient permissions
    }
  }

  const hasRecentActivity = totalJobs > 0;

  return {
    id: workspaceId,
    displayName: workspaceName,
    description: '',
    itemCounts,
    totalItems: items.length,
    recentJobs: {
      total: totalJobs,
      succeeded: succeededJobs,
      failed: failedJobs,
      cancelled: cancelledJobs,
      inProgress: inProgressJobs,
    },
    flaggedItems,
    hasRecentActivity,
  };
}

// ---------------------------------------------------------------------------
// Main health check
// ---------------------------------------------------------------------------

export async function runHealthCheck(creds: Credentials): Promise<HealthCheckResults> {
  // Authenticate
  let token: string;
  try {
    token = await authenticate(creds);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      authError: message,
      timestamp: new Date().toISOString(),
      summary: {
        totalWorkspaces: 0,
        totalItems: 0,
        totalRecentJobs: 0,
        overallSuccessRate: 0,
        healthScore: 0,
      },
      workspaces: [],
      issues: [],
    };
  }

  // List all workspaces
  interface FabricWorkspace {
    id: string;
    displayName: string;
    description?: string;
  }

  const workspaces = await fabricGet<FabricWorkspace>('/v1/workspaces', token);

  // Analyze each workspace
  const workspaceResults: WorkspaceResult[] = [];
  for (const ws of workspaces) {
    const result = await analyzeWorkspace(ws.id, ws.displayName, token);
    result.description = ws.description ?? '';
    workspaceResults.push(result);
  }

  // Collect issues
  const issues: Issue[] = [];

  for (const ws of workspaceResults) {
    // Flag workspaces with no recent activity
    if (!ws.hasRecentActivity && ws.totalItems > 0) {
      issues.push({
        severity: 'warning',
        workspace: ws.displayName,
        message: `No recent job activity found (${ws.totalItems} items exist but none have run recently)`,
      });
    }

    // Flag items with high failure rate
    for (const flagged of ws.flaggedItems) {
      issues.push({
        severity: 'critical',
        workspace: ws.displayName,
        message: `"${flagged.displayName}" (${flagged.type}) has ${flagged.failureRate}% failure rate (${flagged.failedJobs}/${flagged.totalJobs} jobs failed)`,
      });
    }
  }

  // Compute summary
  const totalItems = workspaceResults.reduce((sum, ws) => sum + ws.totalItems, 0);
  const totalRecentJobs = workspaceResults.reduce((sum, ws) => sum + ws.recentJobs.total, 0);
  const totalSucceeded = workspaceResults.reduce((sum, ws) => sum + ws.recentJobs.succeeded, 0);

  const overallSuccessRate =
    totalRecentJobs > 0 ? Math.round((totalSucceeded / totalRecentJobs) * 100) : 100;

  // Health score: 100 base, subtract for issues
  let healthScore = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') healthScore -= 15;
    if (issue.severity === 'warning') healthScore -= 5;
  }
  healthScore = Math.max(0, healthScore);

  return {
    authError: null,
    timestamp: new Date().toISOString(),
    summary: {
      totalWorkspaces: workspaces.length,
      totalItems,
      totalRecentJobs,
      overallSuccessRate,
      healthScore,
    },
    workspaces: workspaceResults,
    issues,
  };
}
