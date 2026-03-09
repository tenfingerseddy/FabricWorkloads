#!/usr/bin/env node
/**
 * generate-demo-data.mjs
 *
 * Generates realistic demo data for the Observability Workbench Eventhouse.
 * Produces KQL `.ingest inline` commands that populate all seven tables with
 * rich, interconnected data that demonstrates every product capability.
 *
 * Usage:
 *   node scripts/generate-demo-data.mjs                 # Generate all files
 *   node scripts/generate-demo-data.mjs --dry-run       # Preview counts only
 *   node scripts/generate-demo-data.mjs --seed 42       # Deterministic output
 *   node scripts/generate-demo-data.mjs --days 14       # Span 14 days instead of 7
 *
 * Output:
 *   scripts/demo-data.kql                  — Combined KQL ingest commands
 *   scripts/demo-data/FabricEvents.kql     — Events table only
 *   scripts/demo-data/SloDefinitions.kql   — SLO definitions only
 *   scripts/demo-data/SloSnapshots.kql     — SLO snapshots only
 *   scripts/demo-data/EventCorrelations.kql— Correlations only
 *   scripts/demo-data/AlertRules.kql       — Alert rules only
 *   scripts/demo-data/AlertLog.kql         — Alert log only
 *   scripts/demo-data/WorkspaceInventory.kql — Inventory only
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, 'demo-data');
const COMBINED_FILE = join(__dirname, 'demo-data.kql');

// ── Argument parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, seed: null, days: 7 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--seed' && args[i + 1]) { opts.seed = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--days' && args[i + 1]) { opts.days = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: node scripts/generate-demo-data.mjs [options]

Options:
  --dry-run       Preview counts, do not write files
  --seed <num>    Seed for deterministic random generation
  --days <num>    Number of days to span (default: 7)
  --help, -h      Show this help message
`);
      process.exit(0);
    }
  }
  return opts;
}

// ── Seeded PRNG (xoshiro128**) ─────────────────────────────────────────
// Provides deterministic random numbers when --seed is used.

class PRNG {
  constructor(seed) {
    if (seed != null) {
      // Simple seed expansion
      this.s = new Uint32Array(4);
      this.s[0] = seed ^ 0x12345678;
      this.s[1] = seed ^ 0x9ABCDEF0;
      this.s[2] = seed ^ 0xFEDCBA98;
      this.s[3] = seed ^ 0x76543210;
      // Warm up
      for (let i = 0; i < 20; i++) this.next();
    } else {
      this.s = null; // Use Math.random
    }
  }

  next() {
    if (!this.s) return Math.random();
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result / 0x100000000;
  }

  // Random float in [min, max)
  float(min, max) { return min + this.next() * (max - min); }

  // Random int in [min, max] inclusive
  int(min, max) { return Math.floor(this.float(min, max + 1)); }

  // Pick random element from array
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }

  // Pick N random elements from array (without replacement)
  pickN(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = this.int(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }

  // Weighted random pick: weights[i] is weight for items[i]
  weightedPick(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.float(0, total);
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  // Generate a deterministic GUID
  guid() {
    if (!this.s) return crypto.randomUUID();
    const hex = (n) => {
      let s = '';
      for (let i = 0; i < n; i++) s += this.int(0, 15).toString(16);
      return s;
    };
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${this.pick(['8','9','a','b'])}${hex(3)}-${hex(12)}`;
  }
}

function rotl(x, k) { return (x << k) | (x >>> (32 - k)); }

// ── Demo Scenario Definitions ──────────────────────────────────────────

// Two realistic workspaces: a production analytics workspace and a staging one.
// This gives us data for workspace comparison queries.
const WORKSPACES = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Analytics-Production',
    state: 'Active',
    capacityId: '1f61331b-db2a-4afd-9a26-e159aa338cee',
  },
  {
    id: 'f6e5d4c3-b2a1-4098-8765-432109876543',
    name: 'Analytics-Staging',
    state: 'Active',
    capacityId: '1f61331b-db2a-4afd-9a26-e159aa338cee',
  },
];

// Realistic Fabric item catalog across both workspaces.
// Each item has a type, a display name, and belongs to a workspace.
// The naming follows common Fabric naming conventions.
const ITEMS = [
  // --- Production workspace items ---
  { workspaceIdx: 0, id: null, name: 'PL_MasterOrchestrator',  type: 'DataPipeline',  jobType: 'Pipeline',      avgDurationSec: 1800, durationSpread: 0.3 },
  { workspaceIdx: 0, id: null, name: 'PL_DailyIngest',         type: 'DataPipeline',  jobType: 'Pipeline',      avgDurationSec: 900,  durationSpread: 0.25 },
  { workspaceIdx: 0, id: null, name: 'PL_IncrementalRefresh',  type: 'DataPipeline',  jobType: 'Pipeline',      avgDurationSec: 420,  durationSpread: 0.2 },
  { workspaceIdx: 0, id: null, name: 'NB_TransformSilver',     type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 600,  durationSpread: 0.4 },
  { workspaceIdx: 0, id: null, name: 'NB_TransformGold',       type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 300,  durationSpread: 0.35 },
  { workspaceIdx: 0, id: null, name: 'NB_DataQualityChecks',   type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 120,  durationSpread: 0.3 },
  { workspaceIdx: 0, id: null, name: 'NB_FeatureEngineering',  type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 480,  durationSpread: 0.5 },
  { workspaceIdx: 0, id: null, name: 'LH_Bronze',              type: 'Lakehouse',     jobType: 'TableMaint',    avgDurationSec: 240,  durationSpread: 0.2 },
  { workspaceIdx: 0, id: null, name: 'LH_Gold',                type: 'Lakehouse',     jobType: 'TableMaint',    avgDurationSec: 180,  durationSpread: 0.2 },
  { workspaceIdx: 0, id: null, name: 'SM_SalesAnalytics',      type: 'SemanticModel', jobType: 'Refresh',       avgDurationSec: 900,  durationSpread: 0.3 },
  { workspaceIdx: 0, id: null, name: 'SM_FinanceReporting',    type: 'SemanticModel', jobType: 'Refresh',       avgDurationSec: 1200, durationSpread: 0.25 },
  { workspaceIdx: 0, id: null, name: 'SQL_AnalyticsEndpoint',  type: 'SQLEndpoint',   jobType: 'Maintenance',   avgDurationSec: 60,   durationSpread: 0.15 },

  // --- Staging workspace items ---
  { workspaceIdx: 1, id: null, name: 'PL_StagingIngest',       type: 'DataPipeline',  jobType: 'Pipeline',      avgDurationSec: 600,  durationSpread: 0.3 },
  { workspaceIdx: 1, id: null, name: 'PL_TestPipeline',        type: 'DataPipeline',  jobType: 'Pipeline',      avgDurationSec: 300,  durationSpread: 0.4 },
  { workspaceIdx: 1, id: null, name: 'NB_StagingTransform',    type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 360,  durationSpread: 0.5 },
  { workspaceIdx: 1, id: null, name: 'NB_ExperimentalML',      type: 'Notebook',      jobType: 'SparkJob',      avgDurationSec: 720,  durationSpread: 0.6 },
  { workspaceIdx: 1, id: null, name: 'LH_StagingLake',         type: 'Lakehouse',     jobType: 'TableMaint',    avgDurationSec: 200,  durationSpread: 0.2 },
  { workspaceIdx: 1, id: null, name: 'SM_StagingModel',        type: 'SemanticModel', jobType: 'Refresh',       avgDurationSec: 600,  durationSpread: 0.35 },
];

// Correlation chain definitions: which pipelines trigger which downstream items.
// These define the realistic execution chains that the correlation engine detects.
const CORRELATION_CHAINS = [
  // Production: Master orchestrator triggers the full ETL chain
  {
    pipelineName: 'PL_MasterOrchestrator',
    children: ['NB_TransformSilver', 'NB_TransformGold', 'NB_DataQualityChecks'],
    delayRangeSec: [5, 30],  // child starts 5-30s after pipeline starts
  },
  // Production: Daily ingest triggers silver transform then semantic model refresh
  {
    pipelineName: 'PL_DailyIngest',
    children: ['NB_TransformSilver', 'SM_SalesAnalytics'],
    delayRangeSec: [10, 60],
  },
  // Production: Incremental refresh triggers gold transform
  {
    pipelineName: 'PL_IncrementalRefresh',
    children: ['NB_TransformGold', 'SM_FinanceReporting'],
    delayRangeSec: [5, 20],
  },
  // Staging: Staging ingest triggers staging transform
  {
    pipelineName: 'PL_StagingIngest',
    children: ['NB_StagingTransform', 'SM_StagingModel'],
    delayRangeSec: [10, 45],
  },
];

// Realistic error messages for failed jobs
const FAILURE_REASONS = {
  DataPipeline: [
    'Source connection timeout after 300s - Azure SQL source "sales_db" unreachable',
    'Copy activity "CopyToLakehouse" failed: insufficient permissions on destination',
    'Pipeline execution timeout: exceeded 7200s limit',
    'Data validation failed: row count mismatch between source (142,831) and sink (141,290)',
    'Rate limit exceeded on source REST API (HTTP 429)',
  ],
  Notebook: [
    'SparkSessionTimeout: Spark session did not start within 180s',
    'OutOfMemoryError: Java heap space - DataFrame exceeds available executor memory',
    'FileNotFoundException: abfss://gold@onelake.dfs.fabric.microsoft.com/dim_customer/part-00000.parquet',
    'AnalysisException: cannot resolve column "customer_id" given input columns [cust_id, name, email]',
    'PythonException: KeyError "transaction_date" in transform step 3',
    'DeltaTableMergeError: concurrent modification detected on table "fact_sales"',
  ],
  SemanticModel: [
    'RefreshFailed_DataSourceError: The credentials provided for the SQL source are not valid',
    'RefreshFailed_Timeout: Refresh operation exceeded the 2 hour time limit',
    'RefreshFailed_OutOfMemory: Not enough memory to complete the refresh operation',
    'ProcessingError: A duplicate attribute key was found when processing dimension "DimDate"',
  ],
  Lakehouse: [
    'TableMaintenanceError: VACUUM operation failed - concurrent write detected',
    'CompactionFailed: Maximum file count exceeded during optimize on table "raw_events"',
  ],
  SQLEndpoint: [
    'SyncError: SQL endpoint sync failed - schema change detected in upstream lakehouse',
  ],
};

// Invoke types and their distribution
const INVOKE_TYPES = ['Scheduled', 'Manual', 'External'];
const INVOKE_WEIGHTS = [0.75, 0.15, 0.10];

// SLO definitions: a mix of healthy and breaching scenarios
const SLO_DEFINITIONS = [
  // Healthy SLOs (demonstrating green state)
  { itemName: 'PL_MasterOrchestrator',  metricType: 'SuccessRate',       targetValue: 0.95, warningThreshold: 0.97, evalWindow: '7d',  scenario: 'healthy' },
  { itemName: 'PL_DailyIngest',         metricType: 'SuccessRate',       targetValue: 0.99, warningThreshold: 0.995, evalWindow: '7d', scenario: 'healthy' },
  { itemName: 'NB_TransformSilver',     metricType: 'DurationRegression', targetValue: 2.0,  warningThreshold: 1.5, evalWindow: '7d',  scenario: 'healthy' },
  { itemName: 'SM_SalesAnalytics',      metricType: 'Freshness',         targetValue: 24.0, warningThreshold: 18.0, evalWindow: '24h', scenario: 'healthy' },

  // Warning SLOs (trending toward breach — great for demos)
  { itemName: 'NB_FeatureEngineering',  metricType: 'SuccessRate',       targetValue: 0.95, warningThreshold: 0.97, evalWindow: '7d',  scenario: 'warning' },
  { itemName: 'SM_FinanceReporting',    metricType: 'Freshness',         targetValue: 12.0, warningThreshold: 8.0,  evalWindow: '12h', scenario: 'warning' },
  { itemName: 'PL_IncrementalRefresh',  metricType: 'DurationRegression', targetValue: 2.0,  warningThreshold: 1.5, evalWindow: '7d',  scenario: 'warning' },

  // Breaching SLOs (demonstrating red state and alerting)
  { itemName: 'NB_ExperimentalML',      metricType: 'SuccessRate',       targetValue: 0.90, warningThreshold: 0.93, evalWindow: '7d',  scenario: 'breaching' },
  { itemName: 'PL_TestPipeline',        metricType: 'SuccessRate',       targetValue: 0.95, warningThreshold: 0.97, evalWindow: '7d',  scenario: 'breaching' },
  { itemName: 'NB_StagingTransform',    metricType: 'Freshness',         targetValue: 6.0,  warningThreshold: 4.0,  evalWindow: '6h',  scenario: 'breaching' },

  // Recovered SLOs (was breaching, now ok — demonstrates trend)
  { itemName: 'PL_StagingIngest',       metricType: 'SuccessRate',       targetValue: 0.95, warningThreshold: 0.97, evalWindow: '7d',  scenario: 'recovered' },
  { itemName: 'NB_TransformGold',       metricType: 'DurationRegression', targetValue: 2.0,  warningThreshold: 1.5, evalWindow: '7d',  scenario: 'recovered' },
];

// Alert rules covering various conditions
const ALERT_RULE_DEFS = [
  { condition: 'slo_breach',          threshold: 1.0,   notificationType: 'email',   target: 'data-eng@contoso.com',  cooldownMin: 60, enabled: true },
  { condition: 'slo_warning',         threshold: 1.0,   notificationType: 'email',   target: 'data-eng@contoso.com',  cooldownMin: 120, enabled: true },
  { condition: 'success_rate_below',  threshold: 0.90,  notificationType: 'teams',   target: '#fabric-alerts',        cooldownMin: 30, enabled: true },
  { condition: 'success_rate_below',  threshold: 0.80,  notificationType: 'email',   target: 'oncall@contoso.com',    cooldownMin: 15, enabled: true },
  { condition: 'consecutive_failures', threshold: 3.0,  notificationType: 'email',   target: 'data-eng@contoso.com',  cooldownMin: 30, enabled: true },
  { condition: 'consecutive_failures', threshold: 5.0,  notificationType: 'pagerduty', target: 'svc-fabric-prod',     cooldownMin: 15, enabled: true },
  { condition: 'duration_spike',      threshold: 3.0,   notificationType: 'teams',   target: '#fabric-perf',          cooldownMin: 60, enabled: true },
  { condition: 'freshness_stale',     threshold: 24.0,  notificationType: 'email',   target: 'data-eng@contoso.com',  cooldownMin: 120, enabled: true },
  { condition: 'freshness_stale',     threshold: 48.0,  notificationType: 'pagerduty', target: 'svc-fabric-prod',     cooldownMin: 60, enabled: true },
  { condition: 'no_recent_runs',      threshold: 72.0,  notificationType: 'teams',   target: '#fabric-alerts',        cooldownMin: 240, enabled: true },
  { condition: 'failure_cascade',     threshold: 3.0,   notificationType: 'email',   target: 'oncall@contoso.com',    cooldownMin: 30, enabled: true },
  { condition: 'error_budget_burn',   threshold: 80.0,  notificationType: 'teams',   target: '#fabric-slo',           cooldownMin: 120, enabled: true },
  { condition: 'error_budget_burn',   threshold: 100.0, notificationType: 'pagerduty', target: 'svc-fabric-prod',     cooldownMin: 60, enabled: true },
  { condition: 'capacity_throttle',   threshold: 0.8,   notificationType: 'email',   target: 'platform@contoso.com',  cooldownMin: 60, enabled: true },
  { condition: 'success_rate_below',  threshold: 0.95,  notificationType: 'teams',   target: '#fabric-staging',       cooldownMin: 60, enabled: false },
];

// ── Generator Class ────────────────────────────────────────────────────

class DemoDataGenerator {
  constructor(opts) {
    this.rng = new PRNG(opts.seed);
    this.days = opts.days;
    this.dryRun = opts.dryRun;
    this.now = new Date();

    // Assign stable GUIDs to all items
    this.items = ITEMS.map(item => ({
      ...item,
      id: this.rng.guid(),
      workspace: WORKSPACES[item.workspaceIdx],
    }));

    // Build lookup maps
    this.itemsByName = new Map();
    for (const item of this.items) {
      this.itemsByName.set(item.name, item);
    }

    // Collections
    this.events = [];
    this.correlations = [];
    this.sloDefinitions = [];
    this.sloSnapshots = [];
    this.alertRules = [];
    this.alertLog = [];
    this.inventoryRows = [];
  }

  // ── Main generation orchestrator ─────────────────────────────────

  generate() {
    console.log(`\n  Demo Data Generator`);
    console.log(`  ${'='.repeat(50)}`);
    console.log(`  Time range: last ${this.days} days`);
    console.log(`  Workspaces: ${WORKSPACES.length}`);
    console.log(`  Items: ${this.items.length}`);
    console.log(`  Seed: ${this.rng.s ? 'deterministic' : 'random'}\n`);

    this.generateWorkspaceInventory();
    this.generateFabricEvents();
    this.generateEventCorrelations();
    this.generateSloDefinitions();
    this.generateSloSnapshots();
    this.generateAlertRules();
    this.generateAlertLog();

    this.printSummary();

    if (!this.dryRun) {
      this.writeFiles();
    }
  }

  // ── 1. Workspace Inventory ───────────────────────────────────────

  generateWorkspaceInventory() {
    const now = this.now.toISOString();
    const sevenDaysAgo = new Date(this.now.getTime() - 7 * 86400000).toISOString();

    for (const item of this.items) {
      this.inventoryRows.push({
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        ItemType: item.type,
        CapacityId: item.workspace.capacityId,
        DiscoveredAt: sevenDaysAgo,
        LastSeenAt: now,
      });
    }
  }

  // ── 2. Fabric Events ────────────────────────────────────────────
  //
  // Generates 150+ events with:
  //   - Realistic business-hours weighting (more events 6am-8pm AEST)
  //   - Status distribution: 75% Completed, 15% Failed, 5% InProgress, 5% Cancelled
  //   - Duration variations per item type
  //   - Correlated pipeline-child chains
  //   - Failure cascades at specific time windows
  //   - A "bad day" scenario (day 3) with elevated failure rate

  generateFabricEvents() {
    const startDate = new Date(this.now.getTime() - this.days * 86400000);

    // SCENARIO A: Regular scheduled runs for each item
    // Pipelines run every 4-8 hours, notebooks every 2-6 hours, etc.
    for (const item of this.items) {
      const intervalHours = this.getRunInterval(item);
      let cursor = new Date(startDate.getTime() + this.rng.float(0, intervalHours * 3600000));

      while (cursor < this.now) {
        // Business hours weighting: 80% chance of running during 6am-8pm AEST (UTC+11)
        const hourUtc = cursor.getUTCHours();
        const hourAest = (hourUtc + 11) % 24;
        const isBusinessHours = hourAest >= 6 && hourAest <= 20;

        if (!isBusinessHours && this.rng.next() < 0.6) {
          // Skip some off-hours runs (pipelines still run, just less frequently)
          cursor = new Date(cursor.getTime() + intervalHours * 3600000 * this.rng.float(0.8, 1.2));
          continue;
        }

        const event = this.createEvent(item, cursor);
        this.events.push(event);

        cursor = new Date(cursor.getTime() + intervalHours * 3600000 * this.rng.float(0.8, 1.2));
      }
    }

    // SCENARIO B: "Bad day" — inject a failure cascade on day 3.
    // Multiple items fail within a 10-minute window (simulates capacity throttle or source outage).
    const badDayStart = new Date(startDate.getTime() + 3 * 86400000 + 2 * 3600000); // Day 3, 2am UTC
    const cascadeItems = this.items.filter(i => i.workspace === WORKSPACES[0]).slice(0, 5);
    for (const item of cascadeItems) {
      const eventTime = new Date(badDayStart.getTime() + this.rng.float(0, 600000)); // within 10 min
      const event = this.createEvent(item, eventTime, 'Failed');
      event.FailureReason = 'Capacity throttle detected: concurrent CU usage exceeded F64 limit (100%)';
      event.CorrelationGroup = 'cascade-capacity-throttle-day3';
      this.events.push(event);
    }

    // SCENARIO C: Inject a few InProgress events (currently running)
    const recentItems = this.rng.pickN(this.items, 3);
    for (const item of recentItems) {
      const startTime = new Date(this.now.getTime() - this.rng.float(60000, 600000)); // 1-10 min ago
      const event = this.createEvent(item, startTime, 'InProgress');
      event.EndTimeUtc = '';
      event.DurationSeconds = '';
      this.events.push(event);
    }

    // SCENARIO D: "NB_ExperimentalML" has consecutive failures in the last 24h
    // (to trigger the consecutive failure detection queries)
    const mlItem = this.itemsByName.get('NB_ExperimentalML');
    for (let i = 0; i < 5; i++) {
      const eventTime = new Date(this.now.getTime() - (i + 1) * 3600000 * 2); // every 2h for last 10h
      const event = this.createEvent(mlItem, eventTime, 'Failed');
      event.FailureReason = this.rng.pick(FAILURE_REASONS.Notebook);
      this.events.push(event);
    }

    // Sort all events by time
    this.events.sort((a, b) => new Date(a.StartTimeUtc) - new Date(b.StartTimeUtc));
  }

  createEvent(item, startTime, forceStatus = null) {
    const status = forceStatus || this.pickStatus(item);
    const durationSec = this.computeDuration(item, status);
    const endTime = status === 'InProgress'
      ? null
      : new Date(startTime.getTime() + durationSec * 1000);
    const rootActivityId = this.rng.guid();

    return {
      EventId: this.rng.guid(),
      WorkspaceId: item.workspace.id,
      WorkspaceName: item.workspace.name,
      ItemId: item.id,
      ItemName: item.name,
      ItemType: item.type,
      JobType: item.jobType,
      InvokeType: this.rng.weightedPick(INVOKE_TYPES, INVOKE_WEIGHTS),
      Status: status,
      FailureReason: status === 'Failed' ? this.rng.pick(FAILURE_REASONS[item.type] || ['Unknown error']) : '',
      RootActivityId: rootActivityId,
      StartTimeUtc: startTime.toISOString(),
      EndTimeUtc: endTime ? endTime.toISOString() : '',
      DurationSeconds: status === 'InProgress' ? '' : durationSec.toFixed(1),
      CorrelationGroup: '',
      IngestedAt: this.now.toISOString(),
    };
  }

  pickStatus(item) {
    // Item-specific failure rates to create interesting patterns
    const failRates = {
      'NB_ExperimentalML': 0.30,    // High failure rate — experimental
      'PL_TestPipeline': 0.25,      // Staging pipeline — unstable
      'NB_StagingTransform': 0.20,  // Staging notebook — somewhat unreliable
      'PL_MasterOrchestrator': 0.08, // Production — mostly reliable
      'SM_FinanceReporting': 0.10,   // Occasional refresh failures
    };
    const failRate = failRates[item.name] || 0.12; // Default 12% failure

    const r = this.rng.next();
    if (r < failRate) return 'Failed';
    if (r < failRate + 0.05) return 'Cancelled';
    return 'Completed';
  }

  computeDuration(item, status) {
    let base = item.avgDurationSec;

    // Failed jobs tend to be shorter (they fail early) or much longer (timeout)
    if (status === 'Failed') {
      if (this.rng.next() < 0.3) {
        // Timeout — 2x to 4x normal duration
        base *= this.rng.float(2.0, 4.0);
      } else {
        // Early failure — 10% to 50% of normal
        base *= this.rng.float(0.1, 0.5);
      }
    }

    // Cancelled jobs run for a random fraction of normal time
    if (status === 'Cancelled') {
      base *= this.rng.float(0.05, 0.7);
    }

    // Apply spread
    const spread = item.durationSpread;
    base *= this.rng.float(1 - spread, 1 + spread);

    // Minimum 5 seconds
    return Math.max(5, base);
  }

  getRunInterval(item) {
    // Returns hours between runs
    switch (item.type) {
      case 'DataPipeline': return item.name.includes('Incremental') ? 2 : 6;
      case 'Notebook':     return item.name.includes('Experimental') ? 8 : 4;
      case 'SemanticModel': return 8;
      case 'Lakehouse':    return 12;
      case 'SQLEndpoint':  return 24;
      default: return 6;
    }
  }

  // ── 3. Event Correlations ────────────────────────────────────────
  //
  // Links pipeline events to their child notebook/model events using
  // three relationship types (matching what the correlation engine produces).
  // Also creates multi-hop chains: Pipeline -> Notebook -> SemanticModel.

  generateEventCorrelations() {
    // For each correlation chain definition, find matching events and link them
    for (const chain of CORRELATION_CHAINS) {
      const pipelineItem = this.itemsByName.get(chain.pipelineName);
      if (!pipelineItem) continue;

      const pipelineEvents = this.events.filter(
        e => e.ItemName === chain.pipelineName && e.Status !== 'InProgress'
      );

      for (const pEvent of pipelineEvents) {
        if (!pEvent.StartTimeUtc || !pEvent.EndTimeUtc) continue;

        const pStart = new Date(pEvent.StartTimeUtc).getTime();
        const pEnd = new Date(pEvent.EndTimeUtc).getTime();

        for (const childName of chain.children) {
          // Find the closest child event that falls within or near the pipeline window
          const childEvents = this.events.filter(
            e => e.ItemName === childName && e.StartTimeUtc
          );

          let bestChild = null;
          let bestDist = Infinity;

          for (const cEvent of childEvents) {
            const cStart = new Date(cEvent.StartTimeUtc).getTime();
            // Child must start during or shortly after pipeline window
            // Using a generous window to catch realistic orchestration delays
            if (cStart >= pStart - 120000 && cStart <= pEnd + 300000) {
              const dist = Math.abs(cStart - pStart);
              if (dist < bestDist) {
                bestDist = dist;
                bestChild = cEvent;
              }
            }
          }

          if (bestChild) {
            // Determine relationship type based on how the match was found
            let relType, confidence;
            if (pEvent.RootActivityId === bestChild.RootActivityId) {
              relType = 'rootActivityId';
              confidence = 1.0;
            } else if (bestDist < 60000) {
              relType = 'activityRun';
              confidence = this.rng.float(0.85, 0.98);
            } else {
              relType = 'timeWindow';
              confidence = this.rng.float(0.70, 0.85);
            }

            // Share rootActivityId for some pairs to enable rootActivityId correlation queries
            if (this.rng.next() < 0.4) {
              bestChild.RootActivityId = pEvent.RootActivityId;
              relType = 'rootActivityId';
              confidence = 1.0;
            }

            this.correlations.push({
              UpstreamEventId: pEvent.EventId,
              DownstreamEventId: bestChild.EventId,
              RelationshipType: relType,
              ConfidenceScore: parseFloat(confidence.toFixed(2)),
              DetectedAt: this.now.toISOString(),
            });
          }
        }
      }
    }

    // Add some multi-hop chains: Notebook -> SemanticModel
    // (e.g., NB_TransformGold writes to lakehouse, triggering SM_SalesAnalytics refresh)
    const goldNotebookEvents = this.events.filter(e => e.ItemName === 'NB_TransformGold' && e.Status === 'Completed');
    const salesModelEvents = this.events.filter(e => e.ItemName === 'SM_SalesAnalytics');

    for (const nbEvent of goldNotebookEvents) {
      if (!nbEvent.EndTimeUtc) continue;
      const nbEnd = new Date(nbEvent.EndTimeUtc).getTime();

      // Find a semantic model refresh that starts shortly after notebook completes
      const match = salesModelEvents.find(smEvent => {
        if (!smEvent.StartTimeUtc) return false;
        const smStart = new Date(smEvent.StartTimeUtc).getTime();
        return smStart >= nbEnd - 30000 && smStart <= nbEnd + 300000; // within 5 min after
      });

      if (match) {
        this.correlations.push({
          UpstreamEventId: nbEvent.EventId,
          DownstreamEventId: match.EventId,
          RelationshipType: 'timeWindow',
          ConfidenceScore: parseFloat(this.rng.float(0.72, 0.88).toFixed(2)),
          DetectedAt: this.now.toISOString(),
        });
      }
    }
  }

  // ── 4. SLO Definitions ──────────────────────────────────────────

  generateSloDefinitions() {
    for (const sloDef of SLO_DEFINITIONS) {
      const item = this.itemsByName.get(sloDef.itemName);
      if (!item) continue;

      this.sloDefinitions.push({
        SloId: this.rng.guid(),
        WorkspaceId: item.workspace.id,
        ItemId: item.id,
        ItemName: item.name,
        MetricType: sloDef.metricType,
        TargetValue: sloDef.targetValue,
        WarningThreshold: sloDef.warningThreshold,
        EvaluationWindow: sloDef.evalWindow,
        CreatedAt: new Date(this.now.getTime() - 30 * 86400000).toISOString(),
        IsActive: true,
      });
    }
  }

  // ── 5. SLO Snapshots ────────────────────────────────────────────
  //
  // Generates hourly snapshots for each SLO over the full time range.
  // Each scenario creates different value trajectories:
  //   - healthy:    consistently above target
  //   - warning:    trending down toward warning threshold
  //   - breaching:  below target for the last 24-48h
  //   - recovered:  was breaching early in the window, now healthy

  generateSloSnapshots() {
    const startDate = new Date(this.now.getTime() - this.days * 86400000);
    const hoursInRange = this.days * 24;

    for (let i = 0; i < this.sloDefinitions.length; i++) {
      const sloDef = this.sloDefinitions[i];
      const scenarioDef = SLO_DEFINITIONS[i];

      for (let h = 0; h < hoursInRange; h++) {
        const computedAt = new Date(startDate.getTime() + h * 3600000);

        // Skip some hours randomly to simulate gaps (90% coverage)
        if (this.rng.next() < 0.10) continue;

        const progress = h / hoursInRange; // 0.0 = start of window, 1.0 = now
        const { currentValue, isBreaching, errorBudget } = this.computeSloValue(
          scenarioDef, sloDef, progress
        );

        this.sloSnapshots.push({
          SnapshotId: this.rng.guid(),
          SloId: sloDef.SloId,
          ItemId: sloDef.ItemId,
          MetricType: sloDef.MetricType,
          CurrentValue: parseFloat(currentValue.toFixed(4)),
          TargetValue: sloDef.TargetValue,
          IsBreaching: isBreaching,
          ErrorBudgetRemaining: parseFloat(errorBudget.toFixed(2)),
          ComputedAt: computedAt.toISOString(),
        });
      }
    }
  }

  computeSloValue(scenarioDef, sloDef, progress) {
    const target = sloDef.TargetValue;
    const warning = sloDef.WarningThreshold;
    const noise = this.rng.float(-0.02, 0.02);

    let currentValue;

    switch (scenarioDef.scenario) {
      case 'healthy':
        // Stays comfortably above target with minor fluctuations
        if (sloDef.MetricType === 'SuccessRate') {
          currentValue = target + this.rng.float(0.02, 0.05) + noise;
          currentValue = Math.min(1.0, currentValue);
        } else if (sloDef.MetricType === 'DurationRegression') {
          // Ratio stays below warning (lower is better for duration ratio)
          currentValue = this.rng.float(0.8, 1.3) + noise;
        } else {
          // Freshness: hours since refresh (lower is better)
          currentValue = target * this.rng.float(0.2, 0.6) + noise * target;
          currentValue = Math.max(0.5, currentValue);
        }
        break;

      case 'warning':
        // Trends toward the warning threshold over the time window
        if (sloDef.MetricType === 'SuccessRate') {
          const startVal = target + 0.04;
          const endVal = warning - 0.01;
          currentValue = startVal + (endVal - startVal) * progress + noise * 0.5;
        } else if (sloDef.MetricType === 'DurationRegression') {
          const startRatio = 1.0;
          const endRatio = warning + 0.2;
          currentValue = startRatio + (endRatio - startRatio) * progress + noise;
        } else {
          // Freshness creeping toward warning
          const startFresh = target * 0.3;
          const endFresh = warning + 1.0;
          currentValue = startFresh + (endFresh - startFresh) * progress + noise * 2;
          currentValue = Math.max(0.5, currentValue);
        }
        break;

      case 'breaching':
        // Below target for the later portion of the window
        if (sloDef.MetricType === 'SuccessRate') {
          if (progress < 0.4) {
            currentValue = target + this.rng.float(0.01, 0.04) + noise;
          } else {
            currentValue = target - this.rng.float(0.03, 0.12) + noise * 0.5;
          }
          currentValue = Math.max(0, Math.min(1.0, currentValue));
        } else if (sloDef.MetricType === 'DurationRegression') {
          if (progress < 0.3) {
            currentValue = this.rng.float(1.0, 1.5);
          } else {
            currentValue = target + this.rng.float(0.5, 2.0);
          }
        } else {
          // Freshness exceeds target
          if (progress < 0.3) {
            currentValue = target * this.rng.float(0.3, 0.7);
          } else {
            currentValue = target + this.rng.float(1, 8) + noise * 3;
          }
          currentValue = Math.max(0.5, currentValue);
        }
        break;

      case 'recovered':
        // Breaching early, then recovers
        if (sloDef.MetricType === 'SuccessRate') {
          if (progress < 0.5) {
            currentValue = target - this.rng.float(0.02, 0.10) + noise * 0.5;
          } else {
            currentValue = target + this.rng.float(0.02, 0.06) + noise;
          }
          currentValue = Math.max(0, Math.min(1.0, currentValue));
        } else if (sloDef.MetricType === 'DurationRegression') {
          if (progress < 0.5) {
            currentValue = target + this.rng.float(0.3, 1.5);
          } else {
            currentValue = this.rng.float(0.9, 1.4);
          }
        } else {
          if (progress < 0.4) {
            currentValue = target + this.rng.float(2, 6);
          } else {
            currentValue = target * this.rng.float(0.2, 0.5);
          }
          currentValue = Math.max(0.5, currentValue);
        }
        break;

      default:
        currentValue = target;
    }

    // Determine breach state
    let isBreaching;
    if (sloDef.MetricType === 'SuccessRate') {
      isBreaching = currentValue < target;
    } else if (sloDef.MetricType === 'DurationRegression') {
      isBreaching = currentValue > target;
    } else {
      // Freshness: breaching if value exceeds target hours
      isBreaching = currentValue > target;
    }

    // Error budget remaining (0-100%)
    let errorBudget;
    if (sloDef.MetricType === 'SuccessRate') {
      const budget = 1.0 - target;  // e.g., 0.05 for 95% target
      const consumed = Math.max(0, target - currentValue);
      errorBudget = Math.max(0, Math.min(100, ((budget - consumed) / budget) * 100));
    } else if (sloDef.MetricType === 'DurationRegression') {
      const headroom = target - 1.0;  // e.g., 1.0 for 2x target
      const used = Math.max(0, currentValue - 1.0);
      errorBudget = Math.max(0, Math.min(100, ((headroom - used) / headroom) * 100));
    } else {
      // Freshness
      const headroom = target;
      const used = currentValue;
      errorBudget = Math.max(0, Math.min(100, ((headroom - used) / headroom) * 100));
    }

    return { currentValue, isBreaching, errorBudget };
  }

  // ── 6. Alert Rules ──────────────────────────────────────────────

  generateAlertRules() {
    for (const def of ALERT_RULE_DEFS) {
      // Associate some rules with specific SLOs
      let sloId = '';
      if (def.condition.startsWith('slo_') && this.sloDefinitions.length > 0) {
        sloId = this.rng.pick(this.sloDefinitions).SloId;
      }

      this.alertRules.push({
        RuleId: this.rng.guid(),
        SloId: sloId,
        Condition: def.condition,
        Threshold: def.threshold,
        NotificationType: def.notificationType,
        Target: def.target,
        Cooldown: def.cooldownMin,
        Enabled: def.enabled,
        CreatedAt: new Date(this.now.getTime() - 14 * 86400000).toISOString(),
      });
    }
  }

  // ── 7. Alert Log ────────────────────────────────────────────────
  //
  // Generates realistic alert history:
  //   - Alerts from the "bad day" failure cascade
  //   - SLO breach alerts for breaching SLOs
  //   - Consecutive failure alerts for NB_ExperimentalML
  //   - Freshness alerts for stale items
  //   - Some acknowledged / resolved alerts

  generateAlertLog() {
    const severities = ['info', 'warning', 'critical'];
    const kinds = [
      'success_rate_violation',
      'duration_regression',
      'freshness_violation',
      'consecutive_failures',
      'slo_breach',
      'failure_cascade',
    ];

    // Alert 1: Failure cascade from "bad day" (day 3)
    const cascadeTime = new Date(this.now.getTime() - (this.days - 3) * 86400000 + 2 * 3600000);
    this.alertLog.push({
      AlertId: this.rng.guid(),
      Kind: 'failure_cascade',
      Severity: 'critical',
      WorkspaceId: WORKSPACES[0].id,
      WorkspaceName: WORKSPACES[0].name,
      ItemId: '',
      ItemName: 'Multiple items',
      Message: '5 items failed within 10-minute window — likely capacity throttle on F64',
      Value: 5,
      Threshold: 3,
      NotificationSent: true,
      Timestamp: cascadeTime.toISOString(),
    });

    // Alert 2-6: Consecutive failure alerts for NB_ExperimentalML
    const mlItem = this.itemsByName.get('NB_ExperimentalML');
    for (let i = 0; i < 3; i++) {
      const ts = new Date(this.now.getTime() - (i * 4 + 2) * 3600000);
      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: 'consecutive_failures',
        Severity: i === 0 ? 'critical' : 'warning',
        WorkspaceId: mlItem.workspace.id,
        WorkspaceName: mlItem.workspace.name,
        ItemId: mlItem.id,
        ItemName: mlItem.name,
        Message: `${5 - i} consecutive failures detected — Spark session timeouts`,
        Value: 5 - i,
        Threshold: 3,
        NotificationSent: true,
        Timestamp: ts.toISOString(),
      });
    }

    // Alert 7-10: SLO breach alerts for breaching SLOs
    const breachingSlos = SLO_DEFINITIONS.filter(s => s.scenario === 'breaching');
    for (const sloDef of breachingSlos) {
      const item = this.itemsByName.get(sloDef.itemName);
      if (!item) continue;

      const breachStart = new Date(this.now.getTime() - this.rng.float(6, 48) * 3600000);
      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: 'slo_breach',
        Severity: 'critical',
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        Message: `SLO breach: ${sloDef.metricType} for ${item.name} — target ${sloDef.targetValue}, current value below threshold`,
        Value: sloDef.targetValue * 0.88,
        Threshold: sloDef.targetValue,
        NotificationSent: true,
        Timestamp: breachStart.toISOString(),
      });
    }

    // Alert 11-14: Warning SLO alerts for warning-scenario SLOs
    const warningSlos = SLO_DEFINITIONS.filter(s => s.scenario === 'warning');
    for (const sloDef of warningSlos) {
      const item = this.itemsByName.get(sloDef.itemName);
      if (!item) continue;

      const warnTime = new Date(this.now.getTime() - this.rng.float(12, 72) * 3600000);
      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: 'success_rate_violation',
        Severity: 'warning',
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        Message: `${sloDef.metricType} trending toward breach for ${item.name} — approaching warning threshold`,
        Value: sloDef.warningThreshold * 0.99,
        Threshold: sloDef.warningThreshold,
        NotificationSent: true,
        Timestamp: warnTime.toISOString(),
      });
    }

    // Alert 15-18: Freshness violation alerts
    const staleItems = ['SM_FinanceReporting', 'NB_StagingTransform'];
    for (const name of staleItems) {
      const item = this.itemsByName.get(name);
      if (!item) continue;

      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: 'freshness_violation',
        Severity: 'warning',
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        Message: `Last successful run was over 12 hours ago for ${item.name}`,
        Value: 14.5,
        Threshold: 12.0,
        NotificationSent: true,
        Timestamp: new Date(this.now.getTime() - this.rng.float(2, 24) * 3600000).toISOString(),
      });
    }

    // Alert 19-22: Duration regression alerts
    const regressionItems = ['NB_FeatureEngineering', 'PL_IncrementalRefresh'];
    for (const name of regressionItems) {
      const item = this.itemsByName.get(name);
      if (!item) continue;

      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: 'duration_regression',
        Severity: 'warning',
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        Message: `P95 duration regression: ${item.name} running ${this.rng.float(1.8, 2.5).toFixed(1)}x slower than baseline`,
        Value: item.avgDurationSec * 2.1,
        Threshold: item.avgDurationSec * 2.0,
        NotificationSent: true,
        Timestamp: new Date(this.now.getTime() - this.rng.float(4, 36) * 3600000).toISOString(),
      });
    }

    // Alert 23-30: Scatter some informational and resolved alerts
    const infoAlerts = [
      { kind: 'success_rate_violation', item: 'PL_MasterOrchestrator', msg: 'Success rate dipped to 93.2% during maintenance window', sev: 'info' },
      { kind: 'freshness_violation', item: 'SQL_AnalyticsEndpoint', msg: 'SQL endpoint sync delayed due to upstream lakehouse compaction', sev: 'info' },
      { kind: 'success_rate_violation', item: 'PL_StagingIngest', msg: 'Success rate recovered to 97.5% — SLO breach cleared', sev: 'info' },
      { kind: 'duration_regression', item: 'NB_TransformGold', msg: 'Duration regression resolved — P95 back to 1.1x baseline', sev: 'info' },
      { kind: 'consecutive_failures', item: 'PL_TestPipeline', msg: '4 consecutive failures on PL_TestPipeline — source API down', sev: 'warning' },
      { kind: 'slo_breach', item: 'SM_StagingModel', msg: 'SLO breach: SemanticModel refresh failing consistently in staging', sev: 'warning' },
      { kind: 'freshness_violation', item: 'NB_DataQualityChecks', msg: 'Data quality checks notebook not run in 8 hours', sev: 'info' },
      { kind: 'success_rate_violation', item: 'NB_TransformSilver', msg: 'Transient failure spike on NB_TransformSilver — auto-retry resolved', sev: 'info' },
    ];

    for (const alert of infoAlerts) {
      const item = this.itemsByName.get(alert.item);
      if (!item) continue;

      this.alertLog.push({
        AlertId: this.rng.guid(),
        Kind: alert.kind,
        Severity: alert.sev,
        WorkspaceId: item.workspace.id,
        WorkspaceName: item.workspace.name,
        ItemId: item.id,
        ItemName: item.name,
        Message: alert.msg,
        Value: this.rng.float(0.5, 5.0),
        Threshold: this.rng.float(1.0, 10.0),
        NotificationSent: alert.sev !== 'info',
        Timestamp: new Date(this.now.getTime() - this.rng.float(6, 120) * 3600000).toISOString(),
      });
    }

    // Sort by timestamp descending (most recent first)
    this.alertLog.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  }

  // ── Summary ──────────────────────────────────────────────────────

  printSummary() {
    console.log(`  Generated data summary:`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  FabricEvents:       ${this.events.length} events`);
    console.log(`  EventCorrelations:  ${this.correlations.length} links`);
    console.log(`  SloDefinitions:     ${this.sloDefinitions.length} SLOs`);
    console.log(`  SloSnapshots:       ${this.sloSnapshots.length} snapshots`);
    console.log(`  AlertRules:         ${this.alertRules.length} rules`);
    console.log(`  AlertLog:           ${this.alertLog.length} entries`);
    console.log(`  WorkspaceInventory: ${this.inventoryRows.length} items`);
    console.log(`  ${'─'.repeat(50)}`);

    const totalRows = this.events.length + this.correlations.length + this.sloDefinitions.length
      + this.sloSnapshots.length + this.alertRules.length + this.alertLog.length + this.inventoryRows.length;
    console.log(`  Total rows:         ${totalRows}\n`);

    // Status distribution for events
    const statusCounts = {};
    for (const e of this.events) {
      statusCounts[e.Status] = (statusCounts[e.Status] || 0) + 1;
    }
    console.log(`  Event status distribution:`);
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / this.events.length) * 100).toFixed(1);
      console.log(`    ${status.padEnd(12)} ${String(count).padStart(4)}  (${pct}%)`);
    }

    // Events per workspace
    console.log(`\n  Events per workspace:`);
    for (const ws of WORKSPACES) {
      const count = this.events.filter(e => e.WorkspaceId === ws.id).length;
      console.log(`    ${ws.name.padEnd(25)} ${count}`);
    }

    // Events per item type
    console.log(`\n  Events per item type:`);
    const typeCounts = {};
    for (const e of this.events) {
      typeCounts[e.ItemType] = (typeCounts[e.ItemType] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type.padEnd(16)} ${count}`);
    }

    // Correlation summary
    console.log(`\n  Correlation types:`);
    const relCounts = {};
    for (const c of this.correlations) {
      relCounts[c.RelationshipType] = (relCounts[c.RelationshipType] || 0) + 1;
    }
    for (const [type, count] of Object.entries(relCounts)) {
      console.log(`    ${type.padEnd(18)} ${count}`);
    }

    // SLO scenario summary
    console.log(`\n  SLO scenarios:`);
    const scenarioCounts = {};
    for (const s of SLO_DEFINITIONS) {
      scenarioCounts[s.scenario] = (scenarioCounts[s.scenario] || 0) + 1;
    }
    for (const [scenario, count] of Object.entries(scenarioCounts)) {
      console.log(`    ${scenario.padEnd(12)} ${count} SLOs`);
    }

    if (this.dryRun) {
      console.log(`\n  [DRY RUN] No files written. Remove --dry-run to generate output.\n`);
    }
  }

  // ── File Writing ─────────────────────────────────────────────────

  writeFiles() {
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const sections = [];

    // FabricEvents
    const fabricEventsKql = this.buildIngestCommand('FabricEvents', this.events, [
      'EventId', 'WorkspaceId', 'WorkspaceName', 'ItemId', 'ItemName', 'ItemType',
      'JobType', 'InvokeType', 'Status', 'FailureReason', 'RootActivityId',
      'StartTimeUtc', 'EndTimeUtc', 'DurationSeconds', 'CorrelationGroup', 'IngestedAt',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'FabricEvents.kql'), fabricEventsKql, 'utf-8');
    sections.push(fabricEventsKql);

    // EventCorrelations
    const correlationsKql = this.buildIngestCommand('EventCorrelations', this.correlations, [
      'UpstreamEventId', 'DownstreamEventId', 'RelationshipType', 'ConfidenceScore', 'DetectedAt',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'EventCorrelations.kql'), correlationsKql, 'utf-8');
    sections.push(correlationsKql);

    // SloDefinitions
    const sloDefsKql = this.buildIngestCommand('SloDefinitions', this.sloDefinitions, [
      'SloId', 'WorkspaceId', 'ItemId', 'ItemName', 'MetricType', 'TargetValue',
      'WarningThreshold', 'EvaluationWindow', 'CreatedAt', 'IsActive',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'SloDefinitions.kql'), sloDefsKql, 'utf-8');
    sections.push(sloDefsKql);

    // SloSnapshots
    const sloSnapshotsKql = this.buildIngestCommand('SloSnapshots', this.sloSnapshots, [
      'SnapshotId', 'SloId', 'ItemId', 'MetricType', 'CurrentValue', 'TargetValue',
      'IsBreaching', 'ErrorBudgetRemaining', 'ComputedAt',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'SloSnapshots.kql'), sloSnapshotsKql, 'utf-8');
    sections.push(sloSnapshotsKql);

    // AlertRules
    const alertRulesKql = this.buildIngestCommand('AlertRules', this.alertRules, [
      'RuleId', 'SloId', 'Condition', 'Threshold', 'NotificationType', 'Target',
      'Cooldown', 'Enabled', 'CreatedAt',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'AlertRules.kql'), alertRulesKql, 'utf-8');
    sections.push(alertRulesKql);

    // AlertLog
    const alertLogKql = this.buildIngestCommand('AlertLog', this.alertLog, [
      'AlertId', 'Kind', 'Severity', 'WorkspaceId', 'WorkspaceName', 'ItemId',
      'ItemName', 'Message', 'Value', 'Threshold', 'NotificationSent', 'Timestamp',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'AlertLog.kql'), alertLogKql, 'utf-8');
    sections.push(alertLogKql);

    // WorkspaceInventory
    const inventoryKql = this.buildIngestCommand('WorkspaceInventory', this.inventoryRows, [
      'WorkspaceId', 'WorkspaceName', 'ItemId', 'ItemName', 'ItemType',
      'CapacityId', 'DiscoveredAt', 'LastSeenAt',
    ]);
    writeFileSync(join(OUTPUT_DIR, 'WorkspaceInventory.kql'), inventoryKql, 'utf-8');
    sections.push(inventoryKql);

    // Combined file
    const header = [
      '// ══════════════════════════════════════════════════════════════════',
      '// Observability Workbench — Demo Data',
      `// Generated: ${this.now.toISOString()}`,
      `// Time range: last ${this.days} days`,
      '//',
      '// HOW TO USE:',
      '//   1. Open your EH_Observability KQL database in Fabric',
      '//   2. Paste this entire file into a KQL queryset',
      '//   3. Run each .ingest inline command separately',
      '//      (KQL does not support multiple management commands in one batch)',
      '//',
      '// ALTERNATIVELY: Run individual table files from scripts/demo-data/',
      '//',
      '// WARNING: This will ADD data to existing tables. If you want a clean',
      '// slate, truncate the tables first:',
      '//   .clear table FabricEvents data',
      '//   .clear table EventCorrelations data',
      '//   .clear table SloDefinitions data',
      '//   .clear table SloSnapshots data',
      '//   .clear table AlertRules data',
      '//   .clear table AlertLog data',
      '//   .clear table WorkspaceInventory data',
      '// ══════════════════════════════════════════════════════════════════',
      '',
    ].join('\n');

    const combined = header + sections.join('\n\n');
    writeFileSync(COMBINED_FILE, combined, 'utf-8');

    console.log(`  Files written:`);
    console.log(`    ${COMBINED_FILE}`);
    console.log(`    ${join(OUTPUT_DIR, 'FabricEvents.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'EventCorrelations.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'SloDefinitions.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'SloSnapshots.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'AlertRules.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'AlertLog.kql')}`);
    console.log(`    ${join(OUTPUT_DIR, 'WorkspaceInventory.kql')}`);
    console.log('');
  }

  /**
   * Build a KQL `.ingest inline` command for a table.
   *
   * KQL inline ingestion uses semicolons as column delimiters and newlines
   * as row delimiters. Values containing semicolons or newlines must be escaped.
   *
   * Rows are batched into groups of 100 to stay within KQL command size limits.
   */
  buildIngestCommand(tableName, rows, columns) {
    if (rows.length === 0) return `// ${tableName}: no data generated\n`;

    const lines = [];
    const batchSize = 100;

    // Header comment with scenario descriptions for each table
    lines.push(`// ── ${tableName} (${rows.length} rows) ${'─'.repeat(Math.max(0, 50 - tableName.length - String(rows.length).length))}`);
    lines.push(`// Columns: ${columns.join(', ')}`);

    // Add scenario-specific comments
    if (tableName === 'FabricEvents') {
      lines.push('//');
      lines.push('// Scenarios included:');
      lines.push('//   - Regular scheduled runs across 2 workspaces (production + staging)');
      lines.push('//   - "Bad day" failure cascade on day 3 (capacity throttle simulation)');
      lines.push('//   - Currently in-progress jobs (InProgress status)');
      lines.push('//   - Consecutive failures on NB_ExperimentalML (last 10 hours)');
      lines.push('//   - Higher failure rates in staging workspace');
    } else if (tableName === 'SloSnapshots') {
      lines.push('//');
      lines.push('// Snapshot trajectories:');
      lines.push('//   - healthy:    consistently above target (green)');
      lines.push('//   - warning:    trending toward breach (amber)');
      lines.push('//   - breaching:  below target for 24-48h (red)');
      lines.push('//   - recovered:  was breaching, now healthy (green with history)');
    } else if (tableName === 'EventCorrelations') {
      lines.push('//');
      lines.push('// Chain types:');
      lines.push('//   - Pipeline -> Notebook (orchestrated ETL)');
      lines.push('//   - Pipeline -> SemanticModel (refresh trigger)');
      lines.push('//   - Notebook -> SemanticModel (multi-hop)');
      lines.push('//   - Relationship types: rootActivityId, activityRun, timeWindow');
    }

    lines.push('');

    for (let batchIdx = 0; batchIdx * batchSize < rows.length; batchIdx++) {
      const batch = rows.slice(batchIdx * batchSize, (batchIdx + 1) * batchSize);

      if (rows.length > batchSize) {
        lines.push(`// Batch ${batchIdx + 1} of ${Math.ceil(rows.length / batchSize)}`);
      }

      lines.push(`.ingest inline into table ${tableName} <|`);

      for (const row of batch) {
        const values = columns.map(col => {
          let val = row[col];
          if (val === undefined || val === null) val = '';
          if (typeof val === 'boolean') val = val ? 'true' : 'false';
          val = String(val);
          // Escape semicolons (column delimiter) and newlines (row delimiter)
          return val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
        });
        lines.push(values.join(';'));
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

// ── Main ─────────────────────────────────────────────────────────────

const opts = parseArgs();
const generator = new DemoDataGenerator(opts);
generator.generate();
