import { HealthCheckResults, WorkspaceResult, Issue } from './health-check';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKBENCH_URL = 'https://github.com/tenfingerseddy/FabricWorkloads';

// Box-drawing characters
const BOX = {
  topLeft: '\u250C',
  topRight: '\u2510',
  bottomLeft: '\u2514',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502',
  teeRight: '\u251C',
  teeLeft: '\u2524',
  cross: '\u253C',
  teeDown: '\u252C',
  teeUp: '\u2534',
};

// Status marks
const CHECK = '\u2714'; // heavy check mark
const CROSS = '\u2718'; // heavy ballot X
const WARN = '\u26A0';  // warning sign
const BULLET = '\u2022';

// Colors (ANSI escape codes)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Detect whether stdout supports color
const supportsColor = process.stdout.isTTY !== false;

function c(code: string, text: string): string {
  return supportsColor ? `${code}${text}${C.reset}` : text;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function horizontalLine(width: number): string {
  return BOX.horizontal.repeat(width);
}

function boxTop(width: number): string {
  return `${BOX.topLeft}${horizontalLine(width - 2)}${BOX.topRight}`;
}

function boxBottom(width: number): string {
  return `${BOX.bottomLeft}${horizontalLine(width - 2)}${BOX.bottomRight}`;
}

function boxMiddle(width: number): string {
  return `${BOX.teeRight}${horizontalLine(width - 2)}${BOX.teeLeft}`;
}

function boxRow(content: string, width: number): string {
  // Strip ANSI for length calculation
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, width - 4 - stripped.length);
  return `${BOX.vertical} ${content}${' '.repeat(padding)} ${BOX.vertical}`;
}

function pad(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = Math.max(0, len - stripped.length);
  return str + ' '.repeat(diff);
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export function printBanner(): void {
  const W = 60;
  console.log('');
  console.log(c(C.cyan, boxTop(W)));
  console.log(c(C.cyan, boxRow(c(C.bold, 'Fabric Health Check'), W)));
  console.log(c(C.cyan, boxRow(c(C.dim, 'Quick health scan for Microsoft Fabric environments'), W)));
  console.log(c(C.cyan, boxBottom(W)));
  console.log('');
}

export function printUsage(): void {
  console.log(c(C.red, `${CROSS} Missing required environment variables.`));
  console.log('');
  console.log(c(C.bold, 'Required environment variables:'));
  console.log(`  ${BULLET} FABRIC_TENANT_ID      Your Azure AD tenant ID`);
  console.log(`  ${BULLET} FABRIC_CLIENT_ID      Service principal (app) client ID`);
  console.log(`  ${BULLET} FABRIC_CLIENT_SECRET   Service principal client secret`);
  console.log('');
  console.log(c(C.bold, 'Usage:'));
  console.log(
    c(C.dim, '  FABRIC_TENANT_ID=xxx FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=xxx npx fabric-health-check')
  );
  console.log('');
  console.log(c(C.bold, 'Or export them first:'));
  console.log(c(C.dim, '  export FABRIC_TENANT_ID=your-tenant-id'));
  console.log(c(C.dim, '  export FABRIC_CLIENT_ID=your-client-id'));
  console.log(c(C.dim, '  export FABRIC_CLIENT_SECRET=your-secret'));
  console.log(c(C.dim, '  npx fabric-health-check'));
  console.log('');
}

export function printAuthFailure(error: string): void {
  console.log(c(C.red, `${CROSS} Authentication Failed`));
  console.log('');
  console.log(`  ${error}`);
  console.log('');
  console.log(c(C.yellow, 'Troubleshooting:'));
  console.log(`  ${BULLET} Verify your FABRIC_TENANT_ID is a valid Azure AD tenant`);
  console.log(`  ${BULLET} Confirm the service principal has Fabric API permissions`);
  console.log(`  ${BULLET} Check that FABRIC_CLIENT_SECRET has not expired`);
  console.log(`  ${BULLET} Ensure the app registration has admin consent for the Fabric API scope`);
  console.log('');
}

export function printError(message: string): void {
  console.log(c(C.red, `${CROSS} Unexpected error: ${message}`));
  console.log('');
}

export function printResults(results: HealthCheckResults): void {
  const W = 60;

  // Authentication success
  console.log(c(C.green, `  ${CHECK} Authentication successful`));
  console.log('');

  // Workspace summary
  printWorkspaceSection(results.workspaces, W);

  // Issues
  if (results.issues.length > 0) {
    printIssuesSection(results.issues, W);
  }

  // Overall summary
  printSummarySection(results, W);

  // Footer
  printFooter(W);
}

// ---------------------------------------------------------------------------
// Section printers
// ---------------------------------------------------------------------------

function printWorkspaceSection(workspaces: WorkspaceResult[], W: number): void {
  console.log(c(C.bold, '  Workspaces'));
  console.log(`  ${horizontalLine(W - 4)}`);
  console.log('');

  if (workspaces.length === 0) {
    console.log(c(C.yellow, `  ${WARN} No workspaces found. The service principal may not have access to any workspaces.`));
    console.log('');
    return;
  }

  for (const ws of workspaces) {
    const statusIcon = ws.flaggedItems.length > 0 ? c(C.red, CROSS) : c(C.green, CHECK);
    console.log(`  ${statusIcon} ${c(C.bold, ws.displayName)}`);

    // Item counts table
    const types = Object.entries(ws.itemCounts).sort((a, b) => b[1] - a[1]);
    if (types.length > 0) {
      for (const [type, count] of types) {
        console.log(`    ${pad(type, 25)} ${count}`);
      }
    } else {
      console.log(c(C.dim, '    (no items)'));
    }

    // Recent jobs summary
    if (ws.recentJobs.total > 0) {
      const successRate =
        ws.recentJobs.total > 0
          ? Math.round((ws.recentJobs.succeeded / ws.recentJobs.total) * 100)
          : 0;
      const rateColor = successRate >= 90 ? C.green : successRate >= 70 ? C.yellow : C.red;

      console.log('');
      console.log(
        `    Recent Jobs: ${ws.recentJobs.total} total  ${c(C.green, `${CHECK} ${ws.recentJobs.succeeded} passed`)}  ${c(C.red, `${CROSS} ${ws.recentJobs.failed} failed`)}  Success: ${c(rateColor, `${successRate}%`)}`
      );
    } else if (ws.totalItems > 0) {
      console.log('');
      console.log(c(C.dim, '    No recent job activity'));
    }

    // Flagged items
    for (const flagged of ws.flaggedItems) {
      console.log(
        c(
          C.red,
          `    ${CROSS} ${flagged.displayName} (${flagged.type}): ${flagged.failureRate}% failure rate (${flagged.failedJobs}/${flagged.totalJobs})`
        )
      );
    }

    console.log('');
  }
}

function printIssuesSection(issues: Issue[], W: number): void {
  console.log(c(C.bold + C.yellow, `  ${WARN}  Issues Found (${issues.length})`));
  console.log(`  ${horizontalLine(W - 4)}`);
  console.log('');

  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (criticalIssues.length > 0) {
    console.log(c(C.red, '  Critical:'));
    for (const issue of criticalIssues) {
      console.log(c(C.red, `    ${CROSS} [${issue.workspace}] ${issue.message}`));
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(c(C.yellow, '  Warnings:'));
    for (const issue of warnings) {
      console.log(c(C.yellow, `    ${WARN}  [${issue.workspace}] ${issue.message}`));
    }
    console.log('');
  }
}

function printSummarySection(results: HealthCheckResults, W: number): void {
  const { summary } = results;

  console.log(boxTop(W));
  console.log(boxRow(c(C.bold, 'Health Check Summary'), W));
  console.log(boxMiddle(W));

  console.log(boxRow(`Workspaces scanned:    ${summary.totalWorkspaces}`, W));
  console.log(boxRow(`Total items:           ${summary.totalItems}`, W));
  console.log(boxRow(`Recent jobs:           ${summary.totalRecentJobs}`, W));

  const successRateStr = `${summary.overallSuccessRate}%`;
  const successColor =
    summary.overallSuccessRate >= 90
      ? C.green
      : summary.overallSuccessRate >= 70
        ? C.yellow
        : C.red;
  console.log(boxRow(`Job success rate:      ${c(successColor, successRateStr)}`, W));

  console.log(boxMiddle(W));

  // Health score with visual bar
  const score = summary.healthScore;
  const barLength = 20;
  const filled = Math.round((score / 100) * barLength);
  const empty = barLength - filled;
  const barColor = score >= 80 ? C.green : score >= 50 ? C.yellow : C.red;
  const bar = c(barColor, '\u2588'.repeat(filled)) + c(C.dim, '\u2591'.repeat(empty));
  const scoreLabel = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Unhealthy';

  console.log(boxRow(`Health Score:  ${bar}  ${c(barColor + C.bold, `${score}/100 ${scoreLabel}`)}`, W));

  console.log(boxBottom(W));
  console.log('');
}

function printFooter(_W: number): void {
  console.log(c(C.dim, '  For deeper analysis, capacity planning, and automated monitoring:'));
  console.log(c(C.cyan, `  ${WORKBENCH_URL}`));
  console.log('');
  console.log(c(C.dim, `  Scan completed at ${new Date().toISOString()}`));
  console.log('');
}
