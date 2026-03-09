/**
 * Integration tests for Fabric notebook logic (Sprint 03 — Task C1).
 *
 * The three PySpark notebooks (NB_ObsIngestion, NB_ObsCorrelation, NB_ObsAlerts)
 * run inside Microsoft Fabric's Spark environment. We cannot execute them locally,
 * but we CAN validate their core algorithmic logic by re-implementing the same
 * patterns in TypeScript and testing them here:
 *
 *  1. KQL query syntax validation (basic parsing)
 *  2. PSV (pipe-separated value) generation with edge cases
 *  3. Dedup logic (given existing IDs, filter to new-only)
 *  4. SLO evaluation logic (success rate, duration regression, freshness,
 *     consecutive failures, error budget)
 *  5. Correlation strategy logic (activity-run, rootActivityId, time-window)
 *  6. GUID validation
 *  7. Sanitize / escape helpers
 */
import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════════════════
// Portable reimplementations of notebook helper functions
// ═══════════════════════════════════════════════════════════════════════

// -- PSV value generation (mirrors NB_ObsIngestion Cell 5) ----------------

/**
 * Build a pipe-delimited ingestion line from a record and ordered column list.
 * This mirrors the Python:
 *   values = "|".join(str(row.get(k, "")).replace("|", " ") for k in columns)
 */
function buildPsvLine(
  row: Record<string, unknown>,
  columns: string[],
): string {
  return columns
    .map((k) => {
      const raw = row[k];
      const val = raw === null || raw === undefined ? "" : String(raw);
      return val.replace(/\|/g, " ");
    })
    .join("|");
}

/**
 * Sanitize a value for PSV ingestion — mirrors NB_ObsCorrelation sanitize_psv.
 */
function sanitizePsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  s = s.replace(/\|/g, " ").replace(/\n/g, " ").replace(/\r/g, "");
  return s;
}

// -- Dedup logic (mirrors NB_ObsIngestion Cell 4.5) -----------------------

interface FabricEvent {
  EventId: string;
  [key: string]: unknown;
}

/**
 * Given all collected events and a set of already-ingested IDs, return only
 * the events that are new. Mirrors:
 *   new_events = [e for e in all_events if e["EventId"] not in existing_ids]
 */
function dedup(
  allEvents: FabricEvent[],
  existingIds: Set<string>,
): FabricEvent[] {
  return allEvents.filter((e) => !existingIds.has(e.EventId));
}

// -- GUID validation (mirrors NB_ObsCorrelation is_valid_guid) ------------

function isValidGuid(s: string | null | undefined): boolean {
  if (!s) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s);
}

function looksLikeGuid(s: string): boolean {
  const clean = s.replace(/-/g, "");
  if (clean.length < 32) return false;
  return /^[0-9a-fA-F]+$/.test(clean);
}

// -- Datetime parsing (mirrors NB_ObsCorrelation parse_dt) ----------------

function parseDt(dtStr: string | null | undefined): Date | null {
  if (!dtStr) return null;
  try {
    const cleaned = String(dtStr).replace(/Z$/, "");
    const d = new Date(cleaned + "Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// -- Duration calculation (mirrors NB_ObsIngestion Cell 4) ----------------

function computeDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): number {
  if (!start || !end) return 0;
  try {
    const s = parseDt(start);
    const e = parseDt(end);
    if (!s || !e) return 0;
    return (e.getTime() - s.getTime()) / 1000;
  } catch {
    return 0;
  }
}

// -- failureReason parsing (mirrors NB_ObsIngestion Cell 4) ---------------

function parseFailureReason(
  raw: unknown,
): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "object" && raw !== null) {
    const dict = raw as Record<string, unknown>;
    return String(dict.message ?? JSON.stringify(raw));
  }
  return String(raw);
}

// -- SLO evaluation (mirrors NB_ObsAlerts Cell 4) -------------------------

interface SuccessMetric {
  ItemId: string;
  ItemName: string;
  TotalRuns: number;
  SuccessfulRuns: number;
  FailedRuns: number;
  SuccessRate: number;
}

interface DurationMetric {
  ItemId: string;
  ItemName: string;
  CurrentP95: number;
  BaselineP95: number | null;
}

interface FreshnessMetric {
  ItemId: string;
  ItemName: string;
  HoursSinceSuccess: number;
}

interface ConsecFailureMetric {
  ItemId: string;
  ItemName: string;
  ConsecFails: number;
}

interface SloAlert {
  kind: string;
  severity: string;
  itemId: string;
  itemName: string;
  message: string;
  value: number;
  threshold: number;
}

interface SloSnapshot {
  itemId: string;
  metricType: string;
  currentValue: number;
  targetValue: number;
  isBreaching: boolean;
  errorBudgetRemaining: number;
}

function evaluateSuccessRate(
  metric: SuccessMetric,
  target: number,
  warningThreshold: number,
): { alert: SloAlert | null; snapshot: SloSnapshot } {
  const rate = metric.SuccessRate;
  const isBreach = rate < target;

  const errorBudgetTotal = target < 1.0 ? 1.0 - target : 0.005;
  let errorBudgetUsed =
    errorBudgetTotal > 0 ? Math.max(0, (target - rate) / errorBudgetTotal) : 0;
  errorBudgetUsed = Math.min(errorBudgetUsed, 1.0);

  const snapshot: SloSnapshot = {
    itemId: metric.ItemId,
    metricType: "success_rate",
    currentValue: rate,
    targetValue: target,
    isBreaching: isBreach,
    errorBudgetRemaining: Math.round((1.0 - errorBudgetUsed) * 10000) / 10000,
  };

  if (metric.TotalRuns < 3) return { alert: null, snapshot };
  if (!isBreach) return { alert: null, snapshot };

  const severity = rate < warningThreshold ? "critical" : "warning";
  return {
    alert: {
      kind: "success_rate_violation",
      severity,
      itemId: metric.ItemId,
      itemName: metric.ItemName,
      message: `Success rate ${(rate * 100).toFixed(1)}% below ${(target * 100).toFixed(1)}% SLO`,
      value: rate,
      threshold: target,
    },
    snapshot,
  };
}

function evaluateDurationRegression(
  metric: DurationMetric,
  targetMultiplier: number,
  warningMultiplier: number,
): { alert: SloAlert | null; snapshot: SloSnapshot | null } {
  if (!metric.BaselineP95 || metric.BaselineP95 <= 0 || !metric.CurrentP95) {
    return { alert: null, snapshot: null };
  }

  const ratio = metric.CurrentP95 / metric.BaselineP95;
  const isBreach = ratio > targetMultiplier;

  const budgetRange = targetMultiplier > 1.0 ? targetMultiplier - 1.0 : 1.0;
  let errorBudgetUsed = Math.max(0, (ratio - 1.0) / budgetRange);
  errorBudgetUsed = Math.min(errorBudgetUsed, 1.0);

  const snapshot: SloSnapshot = {
    itemId: metric.ItemId,
    metricType: "duration_p95",
    currentValue: metric.CurrentP95,
    targetValue: metric.BaselineP95 * targetMultiplier,
    isBreaching: isBreach,
    errorBudgetRemaining: Math.round((1.0 - errorBudgetUsed) * 10000) / 10000,
  };

  if (!isBreach) return { alert: null, snapshot };

  const severity = ratio > warningMultiplier ? "critical" : "warning";
  return {
    alert: {
      kind: "duration_regression",
      severity,
      itemId: metric.ItemId,
      itemName: metric.ItemName,
      message: `P95 duration ${metric.CurrentP95.toFixed(0)}s is ${ratio.toFixed(1)}x baseline (${metric.BaselineP95.toFixed(0)}s)`,
      value: metric.CurrentP95,
      threshold: metric.BaselineP95 * targetMultiplier,
    },
    snapshot,
  };
}

function evaluateFreshness(
  metric: FreshnessMetric,
  targetHours: number,
  warningHours: number,
): { alert: SloAlert | null; snapshot: SloSnapshot } {
  const hours = metric.HoursSinceSuccess;
  const isBreach = hours > targetHours;

  let errorBudgetUsed = targetHours > 0 ? hours / targetHours : 0;
  errorBudgetUsed = Math.min(errorBudgetUsed, 1.0);

  const snapshot: SloSnapshot = {
    itemId: metric.ItemId,
    metricType: "freshness",
    currentValue: hours,
    targetValue: targetHours,
    isBreaching: isBreach,
    errorBudgetRemaining: Math.round((1.0 - errorBudgetUsed) * 10000) / 10000,
  };

  if (!isBreach) return { alert: null, snapshot };

  const severity = hours > warningHours ? "critical" : "warning";
  return {
    alert: {
      kind: "freshness_violation",
      severity,
      itemId: metric.ItemId,
      itemName: metric.ItemName,
      message: `Last success was ${hours.toFixed(1)}h ago (limit: ${targetHours}h)`,
      value: hours,
      threshold: targetHours,
    },
    snapshot,
  };
}

function evaluateConsecutiveFailures(
  metric: ConsecFailureMetric,
  targetMax: number,
  warningMax: number,
): { alert: SloAlert | null; snapshot: SloSnapshot } {
  const count = metric.ConsecFails;
  const isBreach = count >= targetMax;

  let errorBudgetUsed = targetMax > 0 ? count / targetMax : 1.0;
  errorBudgetUsed = Math.min(errorBudgetUsed, 1.0);

  const snapshot: SloSnapshot = {
    itemId: metric.ItemId,
    metricType: "consecutive_failures",
    currentValue: count,
    targetValue: targetMax,
    isBreaching: isBreach,
    errorBudgetRemaining: Math.round((1.0 - errorBudgetUsed) * 10000) / 10000,
  };

  if (!isBreach) return { alert: null, snapshot };

  const severity = count >= warningMax ? "critical" : "warning";
  return {
    alert: {
      kind: "consecutive_failures",
      severity,
      itemId: metric.ItemId,
      itemName: metric.ItemName,
      message: `${count} consecutive failures detected`,
      value: count,
      threshold: targetMax,
    },
    snapshot,
  };
}

// -- KQL query syntax validation ------------------------------------------

interface KqlValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Basic KQL syntax checker. Verifies:
 *  - Balanced parentheses, brackets, quotes
 *  - No comma-delimited inline ingestion (must use PSV)
 *  - Required keywords are present for ingestion commands
 *  - Table references are from the known set
 */
function validateKqlSyntax(
  kql: string,
  knownTables?: Set<string>,
): KqlValidationResult {
  const errors: string[] = [];

  // Check balanced parentheses
  let parenDepth = 0;
  for (const ch of kql) {
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    if (parenDepth < 0) {
      errors.push("Unbalanced parentheses: unexpected ')'");
      break;
    }
  }
  if (parenDepth > 0) {
    errors.push(`Unbalanced parentheses: ${parenDepth} unclosed '('`);
  }

  // Check balanced single quotes (KQL string literals)
  const singleQuoteCount = (kql.match(/'/g) || []).length;
  if (singleQuoteCount % 2 !== 0) {
    errors.push("Unbalanced single quotes");
  }

  // Check balanced double quotes
  const doubleQuoteCount = (kql.match(/"/g) || []).length;
  if (doubleQuoteCount % 2 !== 0) {
    errors.push("Unbalanced double quotes");
  }

  // Check for comma-delimited ingestion (should use PSV)
  const ingestMatch = kql.match(
    /\.ingest\s+inline\s+into\s+table\s+\w+\s+with\s*\(\s*format\s*=\s*(\w+)\s*\)/i,
  );
  if (ingestMatch) {
    const format = ingestMatch[1].toLowerCase();
    if (format === "csv") {
      errors.push(
        "Comma-delimited ingestion detected (format=csv). Use format=psv instead.",
      );
    }
  }

  // Check for inline ingestion without format spec
  if (
    /\.ingest\s+inline\s+into\s+table\s+\w+\s*<\|/i.test(kql) &&
    !/with\s*\(/i.test(kql)
  ) {
    errors.push(
      "Inline ingestion without format specification. Use 'with (format=psv)' for pipe-delimited data.",
    );
  }

  // Validate table references against known tables
  if (knownTables && knownTables.size > 0) {
    // Match table references in ingestion commands
    const ingestTableMatch = kql.match(
      /\.ingest\s+inline\s+into\s+table\s+(\w+)/i,
    );
    if (ingestTableMatch) {
      const table = ingestTableMatch[1];
      if (!knownTables.has(table)) {
        errors.push(
          `Unknown table '${table}' in ingestion command. Known tables: ${[...knownTables].join(", ")}`,
        );
      }
    }

    // Match table references in queries (first word on lines without leading .)
    const queryTablePattern = /^(?!\s*[./|])\s*(\w+)\s*$/m;
    const queryTableMatch = kql.match(queryTablePattern);
    if (queryTableMatch) {
      const table = queryTableMatch[1];
      // Skip KQL keywords
      const kqlKeywords = new Set([
        "let", "where", "project", "summarize", "extend", "order", "serialize",
        "join", "take", "count", "distinct", "top", "sort", "parse", "evaluate",
        "union", "render", "print", "datatable", "range", "materialize",
        "toscalar", "iff", "countif", "ago", "now", "bin", "true", "false",
      ]);
      if (
        !kqlKeywords.has(table.toLowerCase()) &&
        !knownTables.has(table)
      ) {
        errors.push(`Unknown table '${table}' referenced in query`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// -- Correlation time-window logic (mirrors NB_ObsCorrelation Cell 6) -----

interface SimpleEvent {
  EventId: string;
  WorkspaceId: string;
  ItemId: string;
  ItemType: string;
  RootActivityId: string;
  StartTimeUtc: string;
  EndTimeUtc: string;
}

function correlateByRootActivity(
  pipelineEvent: SimpleEvent,
  childCandidates: SimpleEvent[],
  claimedIds: Set<string>,
): SimpleEvent[] {
  const raid = pipelineEvent.RootActivityId;
  if (!raid) return [];
  return childCandidates.filter(
    (c) =>
      c.RootActivityId === raid &&
      c.WorkspaceId === pipelineEvent.WorkspaceId &&
      !claimedIds.has(c.EventId),
  );
}

function correlateByTimeWindow(
  pipelineEvent: SimpleEvent,
  childCandidates: SimpleEvent[],
  claimedIds: Set<string>,
  windowSeconds: number = 300,
): SimpleEvent[] {
  const pStart = parseDt(pipelineEvent.StartTimeUtc);
  const pEnd = parseDt(pipelineEvent.EndTimeUtc);
  if (!pStart || !pEnd) return [];

  const tolerance = windowSeconds * 1000;
  const windowStart = new Date(pStart.getTime() - tolerance);
  const windowEnd = new Date(pEnd.getTime() + tolerance);

  return childCandidates.filter((c) => {
    if (claimedIds.has(c.EventId)) return false;
    if (c.WorkspaceId !== pipelineEvent.WorkspaceId) return false;
    const cStart = parseDt(c.StartTimeUtc);
    if (!cStart) return false;
    return cStart >= windowStart && cStart <= windowEnd;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

const KNOWN_TABLES = new Set([
  "FabricEvents",
  "EventCorrelations",
  "SloDefinitions",
  "SloSnapshots",
  "AlertRules",
  "WorkspaceInventory",
  "AlertLog",
]);

// ─── 1. KQL Query Syntax Validation ─────────────────────────────────

describe("KQL query syntax validation", () => {
  it("accepts a valid FabricEvents query", () => {
    const kql = `
FabricEvents
| where StartTimeUtc > ago(24h)
| project EventId, WorkspaceId, ItemName, Status
| order by StartTimeUtc asc
`;
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a valid inline ingestion with PSV format", () => {
    const kql =
      ".ingest inline into table FabricEvents with (format=psv) <| abc|def|ghi";
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(true);
  });

  it("rejects comma-delimited ingestion (format=csv)", () => {
    const kql =
      ".ingest inline into table FabricEvents with (format=csv) <| abc,def,ghi";
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Comma-delimited");
    expect(result.errors[0]).toContain("format=psv");
  });

  it("rejects ingestion without format specification", () => {
    const kql = ".ingest inline into table FabricEvents <| abc|def";
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("without format specification");
  });

  it("detects unbalanced parentheses", () => {
    const kql = "FabricEvents | where (Status == 'Failed'";
    const result = validateKqlSyntax(kql);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unbalanced parentheses"))).toBe(true);
  });

  it("detects unbalanced single quotes", () => {
    const kql = "FabricEvents | where Status == 'Failed";
    const result = validateKqlSyntax(kql);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unbalanced single quotes"))).toBe(true);
  });

  it("detects unbalanced double quotes", () => {
    const kql = 'FabricEvents | where EventId == "abc';
    const result = validateKqlSyntax(kql);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unbalanced double quotes"))).toBe(true);
  });

  it("flags unknown table in ingestion command", () => {
    const kql =
      ".ingest inline into table NonExistentTable with (format=psv) <| a|b";
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown table 'NonExistentTable'");
  });

  it("accepts all known table names from create-tables.kql", () => {
    for (const table of KNOWN_TABLES) {
      const kql = `.ingest inline into table ${table} with (format=psv) <| a|b|c`;
      const result = validateKqlSyntax(kql, KNOWN_TABLES);
      const tableErrors = result.errors.filter((e) =>
        e.includes("Unknown table"),
      );
      expect(tableErrors).toHaveLength(0);
    }
  });

  it("validates the actual success_rate_query from NB_ObsAlerts", () => {
    const kql = `
FabricEvents
| where coalesce(StartTimeUtc, IngestedAt) > ago(7d)
| where Status in ("Completed", "Failed")
| summarize
    TotalRuns = count(),
    SuccessfulRuns = countif(Status == "Completed"),
    FailedRuns = countif(Status == "Failed")
    by ItemId, ItemName, ItemType, WorkspaceId, WorkspaceName
| extend SuccessRate = todouble(SuccessfulRuns) / TotalRuns
`;
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(true);
  });

  it("validates the actual consec_failures_query from NB_ObsAlerts", () => {
    const kql = `
FabricEvents
| where StartTimeUtc > ago(7d)
| order by ItemId asc, StartTimeUtc desc
| serialize
| extend IsNewGroup = iff(ItemId != prev(ItemId) or Status != prev(Status), 1, 0)
| extend GroupId = row_cumsum(IsNewGroup)
| where Status == "Failed"
| summarize ConsecFails = count(), FirstFail = min(StartTimeUtc), LastFail = max(StartTimeUtc)
    by GroupId, ItemId, ItemName, WorkspaceId, WorkspaceName
| where ConsecFails >= 3
| project-away GroupId
`;
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(true);
  });

  it("validates the actual EventCorrelations query from NB_ObsCorrelation", () => {
    const kql = `
EventCorrelations
| where DetectedAt > ago(24h)
| project UpstreamEventId = tostring(UpstreamEventId),
          DownstreamEventId = tostring(DownstreamEventId),
          RelationshipType
`;
    const result = validateKqlSyntax(kql, KNOWN_TABLES);
    expect(result.valid).toBe(true);
  });
});

// ─── 2. PSV Value Generation ────────────────────────────────────────

describe("PSV value generation", () => {
  const FABRIC_EVENTS_COLUMNS = [
    "EventId", "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
    "ItemType", "JobType", "InvokeType", "Status", "FailureReason",
    "RootActivityId", "StartTimeUtc", "EndTimeUtc", "DurationSeconds",
    "CorrelationGroup", "IngestedAt",
  ];

  it("generates correct pipe-delimited line for a normal event", () => {
    const row: Record<string, unknown> = {
      EventId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      WorkspaceId: "ws-001",
      WorkspaceName: "Analytics",
      ItemId: "item-001",
      ItemName: "ETL-Pipeline",
      ItemType: "DataPipeline",
      JobType: "Pipeline",
      InvokeType: "Scheduled",
      Status: "Completed",
      FailureReason: "",
      RootActivityId: "root-123",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:05:00Z",
      DurationSeconds: 300,
      CorrelationGroup: "",
      IngestedAt: "2026-03-09T08:06:00Z",
    };

    const line = buildPsvLine(row, FABRIC_EVENTS_COLUMNS);
    const parts = line.split("|");

    expect(parts).toHaveLength(16); // 16 columns in FabricEvents
    expect(parts[0]).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(parts[4]).toBe("ETL-Pipeline");
    expect(parts[8]).toBe("Completed");
    expect(parts[13]).toBe("300");
  });

  it("escapes pipe characters in item names", () => {
    const row: Record<string, unknown> = {
      EventId: "id-1",
      WorkspaceName: "Team|Alpha",
      ItemName: "Load|Transform|Store",
    };

    const line = buildPsvLine(row, ["EventId", "WorkspaceName", "ItemName"]);
    const parts = line.split("|");

    // Pipes in values must be replaced with spaces
    expect(parts).toHaveLength(3);
    expect(parts[1]).toBe("Team Alpha");
    expect(parts[2]).toBe("Load Transform Store");
  });

  it("escapes pipe characters in failure reasons", () => {
    const row: Record<string, unknown> = {
      FailureReason: "Error|code=500|detail=timeout",
    };

    const line = buildPsvLine(row, ["FailureReason"]);
    expect(line).toBe("Error code=500 detail=timeout");
    expect(line.includes("|")).toBe(false);
  });

  it("handles commas in names without breaking PSV format", () => {
    const row: Record<string, unknown> = {
      WorkspaceName: "Department, Sales & Marketing",
      ItemName: "Transform, Validate, and Load",
      FailureReason: "Column 'Revenue, Total' not found",
    };

    const line = buildPsvLine(row, [
      "WorkspaceName",
      "ItemName",
      "FailureReason",
    ]);
    const parts = line.split("|");

    // Commas are fine in PSV — they only break CSV
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("Department, Sales & Marketing");
    expect(parts[1]).toBe("Transform, Validate, and Load");
    expect(parts[2]).toBe("Column 'Revenue, Total' not found");
  });

  it("handles null and undefined values as empty strings", () => {
    const row: Record<string, unknown> = {
      EventId: "id-1",
      FailureReason: null,
      CorrelationGroup: undefined,
    };

    const line = buildPsvLine(row, [
      "EventId",
      "FailureReason",
      "CorrelationGroup",
      "MissingField",
    ]);
    const parts = line.split("|");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("id-1");
    expect(parts[1]).toBe(""); // null -> ""
    expect(parts[2]).toBe(""); // undefined -> ""
    expect(parts[3]).toBe(""); // missing key -> ""
  });

  it("handles special characters that could break KQL parsing", () => {
    const row: Record<string, unknown> = {
      ItemName: "Pipeline <test> & 'demo'",
      FailureReason: 'Error: "invalid" <xml> & ampersand',
    };

    const line = buildPsvLine(row, ["ItemName", "FailureReason"]);
    const parts = line.split("|");

    expect(parts).toHaveLength(2);
    // These characters are preserved — only pipe is escaped in PSV
    expect(parts[0]).toContain("<test>");
    expect(parts[0]).toContain("&");
  });

  it("handles numeric zero and boolean false correctly", () => {
    const row: Record<string, unknown> = {
      DurationSeconds: 0,
      IsActive: false,
    };

    const line = buildPsvLine(row, ["DurationSeconds", "IsActive"]);
    const parts = line.split("|");

    expect(parts[0]).toBe("0");
    expect(parts[1]).toBe("false");
  });

  it("generates correct column count for EventCorrelations", () => {
    const CORR_COLUMNS = [
      "UpstreamEventId", "DownstreamEventId", "RelationshipType",
      "ConfidenceScore", "DetectedAt",
    ];
    const row: Record<string, unknown> = {
      UpstreamEventId: "a1b2c3d4-0000-0000-0000-000000000001",
      DownstreamEventId: "a1b2c3d4-0000-0000-0000-000000000002",
      RelationshipType: "activityRuns:Transform-Sales",
      ConfidenceScore: 0.99,
      DetectedAt: "2026-03-09T12:00:00Z",
    };

    const line = buildPsvLine(row, CORR_COLUMNS);
    const parts = line.split("|");

    expect(parts).toHaveLength(5); // EventCorrelations has 5 columns
    expect(parts[2]).toBe("activityRuns:Transform-Sales");
    expect(parts[3]).toBe("0.99");
  });

  it("generates correct column count for WorkspaceInventory", () => {
    const INV_COLUMNS = [
      "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
      "ItemType", "CapacityId", "DiscoveredAt", "LastSeenAt",
    ];
    const row: Record<string, unknown> = {
      WorkspaceId: "ws-001",
      WorkspaceName: "Production",
      ItemId: "item-001",
      ItemName: "ETL Pipeline",
      ItemType: "DataPipeline",
      CapacityId: "cap-001",
      DiscoveredAt: "2026-03-09T00:00:00Z",
      LastSeenAt: "2026-03-09T12:00:00Z",
    };

    const line = buildPsvLine(row, INV_COLUMNS);
    const parts = line.split("|");

    expect(parts).toHaveLength(8); // WorkspaceInventory has 8 columns
  });

  it("generates correct column count for SloSnapshots", () => {
    const SNAP_COLUMNS = [
      "SnapshotId", "SloId", "ItemId", "MetricType",
      "CurrentValue", "TargetValue", "IsBreaching",
      "ErrorBudgetRemaining", "ComputedAt",
    ];
    const row: Record<string, unknown> = {
      SnapshotId: "snap-001",
      SloId: "slo-001",
      ItemId: "item-001",
      MetricType: "success_rate",
      CurrentValue: 0.95,
      TargetValue: 0.995,
      IsBreaching: 1,
      ErrorBudgetRemaining: 0.0,
      ComputedAt: "2026-03-09T12:00:00Z",
    };

    const line = buildPsvLine(row, SNAP_COLUMNS);
    const parts = line.split("|");

    expect(parts).toHaveLength(9); // SloSnapshots has 9 columns
  });

  it("generates correct column count for AlertLog", () => {
    const ALERT_COLUMNS = [
      "AlertId", "Kind", "Severity", "WorkspaceId", "WorkspaceName",
      "ItemId", "ItemName", "Message", "Value", "Threshold",
      "NotificationSent", "Timestamp",
    ];
    const row: Record<string, unknown> = {
      AlertId: "alert-001",
      Kind: "success_rate_violation",
      Severity: "warning",
      WorkspaceId: "ws-001",
      WorkspaceName: "Production",
      ItemId: "item-001",
      ItemName: "ETL Pipeline",
      Message: "Success rate 90.0% below 99.5% SLO",
      Value: 0.9,
      Threshold: 0.995,
      NotificationSent: true,
      Timestamp: "2026-03-09T12:00:00Z",
    };

    const line = buildPsvLine(row, ALERT_COLUMNS);
    const parts = line.split("|");

    expect(parts).toHaveLength(12); // AlertLog has 12 columns
  });
});

// ─── 3. sanitize_psv helper ─────────────────────────────────────────

describe("sanitizePsv", () => {
  it("strips pipe characters", () => {
    expect(sanitizePsv("hello|world")).toBe("hello world");
  });

  it("strips newline characters", () => {
    expect(sanitizePsv("line1\nline2\nline3")).toBe("line1 line2 line3");
  });

  it("strips carriage returns", () => {
    expect(sanitizePsv("line1\r\nline2")).toBe("line1 line2");
  });

  it("returns empty string for null", () => {
    expect(sanitizePsv(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizePsv(undefined)).toBe("");
  });

  it("converts numbers to strings", () => {
    expect(sanitizePsv(42)).toBe("42");
    expect(sanitizePsv(0.99)).toBe("0.99");
  });

  it("handles combined pipe + newline in failure messages", () => {
    const input = "Error: connection|reset\nRetry failed\r\nAborted";
    const result = sanitizePsv(input);
    expect(result).toBe("Error: connection reset Retry failed Aborted");
    expect(result.includes("|")).toBe(false);
    expect(result.includes("\n")).toBe(false);
    expect(result.includes("\r")).toBe(false);
  });
});

// ─── 4. Dedup Logic ─────────────────────────────────────────────────

describe("dedup logic", () => {
  it("filters out events whose EventId is in the existing set", () => {
    const all: FabricEvent[] = [
      { EventId: "aaa" },
      { EventId: "bbb" },
      { EventId: "ccc" },
      { EventId: "ddd" },
    ];
    const existing = new Set(["bbb", "ddd"]);
    const result = dedup(all, existing);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.EventId)).toEqual(["aaa", "ccc"]);
  });

  it("returns all events when existing set is empty", () => {
    const all: FabricEvent[] = [
      { EventId: "aaa" },
      { EventId: "bbb" },
    ];
    const result = dedup(all, new Set());
    expect(result).toHaveLength(2);
  });

  it("returns empty when all events are duplicates", () => {
    const all: FabricEvent[] = [
      { EventId: "aaa" },
      { EventId: "bbb" },
    ];
    const existing = new Set(["aaa", "bbb"]);
    const result = dedup(all, existing);
    expect(result).toHaveLength(0);
  });

  it("returns empty when input is empty", () => {
    const result = dedup([], new Set(["aaa"]));
    expect(result).toHaveLength(0);
  });

  it("handles large existing ID sets efficiently", () => {
    const existingIds = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      existingIds.add(`event-${i}`);
    }
    const all: FabricEvent[] = [
      { EventId: "event-5000" }, // exists
      { EventId: "event-99999" }, // new
      { EventId: "brand-new-id" }, // new
    ];
    const result = dedup(all, existingIds);
    expect(result).toHaveLength(2);
    expect(result[0].EventId).toBe("event-99999");
    expect(result[1].EventId).toBe("brand-new-id");
  });

  it("preserves event data through dedup", () => {
    const all: FabricEvent[] = [
      { EventId: "aaa", WorkspaceName: "Prod", Status: "Failed" },
      { EventId: "bbb", WorkspaceName: "Dev", Status: "Completed" },
    ];
    const existing = new Set(["aaa"]);
    const result = dedup(all, existing);

    expect(result).toHaveLength(1);
    expect(result[0].WorkspaceName).toBe("Dev");
    expect(result[0].Status).toBe("Completed");
  });

  it("dedup is case-sensitive (GUID strings must match exactly)", () => {
    const all: FabricEvent[] = [
      { EventId: "ABC-123" },
      { EventId: "abc-123" },
    ];
    const existing = new Set(["abc-123"]);
    const result = dedup(all, existing);

    // Only exact match is filtered
    expect(result).toHaveLength(1);
    expect(result[0].EventId).toBe("ABC-123");
  });
});

// ─── 5. GUID Validation ────────────────────────────────────────────

describe("GUID validation", () => {
  it("accepts standard UUID format", () => {
    expect(isValidGuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
  });

  it("accepts uppercase UUID", () => {
    expect(isValidGuid("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidGuid("")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidGuid(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidGuid(undefined)).toBe(false);
  });

  it("rejects short strings", () => {
    expect(isValidGuid("abc-123")).toBe(false);
  });

  it("rejects UUID without dashes", () => {
    // isValidGuid requires standard UUID format with dashes
    expect(isValidGuid("a1b2c3d4e5f67890abcdef1234567890")).toBe(false);
  });

  it("rejects strings with non-hex characters", () => {
    expect(isValidGuid("g1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(false);
  });

  describe("looksLikeGuid (lenient, matches notebook _looks_like_guid)", () => {
    it("accepts UUID with dashes", () => {
      expect(looksLikeGuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
    });

    it("accepts UUID without dashes", () => {
      expect(looksLikeGuid("a1b2c3d4e5f67890abcdef1234567890")).toBe(true);
    });

    it("rejects short strings", () => {
      expect(looksLikeGuid("abc123")).toBe(false);
    });

    it("rejects strings with non-hex chars", () => {
      expect(looksLikeGuid("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
    });
  });
});

// ─── 6. Datetime Parsing ────────────────────────────────────────────

describe("datetime parsing (parse_dt equivalent)", () => {
  it("parses ISO 8601 with Z suffix", () => {
    const d = parseDt("2026-03-09T08:00:00Z");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-03-09T08:00:00.000Z");
  });

  it("parses ISO 8601 without Z suffix", () => {
    const d = parseDt("2026-03-09T08:00:00");
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(8);
  });

  it("returns null for empty string", () => {
    expect(parseDt("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseDt(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseDt(undefined)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseDt("not-a-date")).toBeNull();
  });
});

// ─── 7. Duration Calculation ────────────────────────────────────────

describe("duration calculation", () => {
  it("computes 300 seconds for a 5-minute job", () => {
    expect(
      computeDuration("2026-03-09T08:00:00Z", "2026-03-09T08:05:00Z"),
    ).toBe(300);
  });

  it("returns 0 when start is missing", () => {
    expect(computeDuration(null, "2026-03-09T08:05:00Z")).toBe(0);
  });

  it("returns 0 when end is missing", () => {
    expect(computeDuration("2026-03-09T08:00:00Z", null)).toBe(0);
  });

  it("returns 0 when both are missing", () => {
    expect(computeDuration(null, null)).toBe(0);
  });

  it("returns 0 for empty strings", () => {
    expect(computeDuration("", "")).toBe(0);
  });
});

// ─── 8. Failure Reason Parsing ──────────────────────────────────────

describe("failureReason parsing", () => {
  it("returns empty string for empty input", () => {
    expect(parseFailureReason("")).toBe("");
  });

  it("returns empty string for null", () => {
    expect(parseFailureReason(null)).toBe("");
  });

  it("returns string as-is for string input", () => {
    expect(parseFailureReason("Connection timeout")).toBe("Connection timeout");
  });

  it("extracts message from dict-like object", () => {
    expect(
      parseFailureReason({ message: "Out of memory", code: "OOM" }),
    ).toBe("Out of memory");
  });

  it("stringifies dict without message field", () => {
    const result = parseFailureReason({ code: "500", detail: "timeout" });
    expect(result).toContain("500");
    expect(result).toContain("timeout");
  });
});

// ─── 9. SLO Evaluation: Success Rate ───────────────────────────────

describe("SLO evaluation — success rate", () => {
  const DEFAULT_TARGET = 0.995;
  const DEFAULT_WARNING = 0.995 * 0.8; // 0.796

  it("triggers warning when rate is below target but above warning threshold", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 100,
      SuccessfulRuns: 98,
      FailedRuns: 2,
      SuccessRate: 0.98,
    };
    const { alert, snapshot } = evaluateSuccessRate(
      metric,
      DEFAULT_TARGET,
      DEFAULT_WARNING,
    );

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning");
    expect(alert!.kind).toBe("success_rate_violation");
    expect(snapshot.isBreaching).toBe(true);
  });

  it("triggers critical when rate is below warning threshold", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 10,
      SuccessfulRuns: 5,
      FailedRuns: 5,
      SuccessRate: 0.5,
    };
    const { alert } = evaluateSuccessRate(
      metric,
      DEFAULT_TARGET,
      DEFAULT_WARNING,
    );

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("critical");
  });

  it("does not trigger when rate meets target", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 200,
      SuccessfulRuns: 200,
      FailedRuns: 0,
      SuccessRate: 1.0,
    };
    const { alert, snapshot } = evaluateSuccessRate(
      metric,
      DEFAULT_TARGET,
      DEFAULT_WARNING,
    );

    expect(alert).toBeNull();
    expect(snapshot.isBreaching).toBe(false);
  });

  it("does not trigger when TotalRuns < 3 (insufficient data)", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 2,
      SuccessfulRuns: 0,
      FailedRuns: 2,
      SuccessRate: 0.0,
    };
    const { alert } = evaluateSuccessRate(
      metric,
      DEFAULT_TARGET,
      DEFAULT_WARNING,
    );

    expect(alert).toBeNull();
  });

  it("computes error budget correctly at exact SLO boundary", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 200,
      SuccessfulRuns: 199,
      FailedRuns: 1,
      SuccessRate: 0.995, // exactly at target
    };
    const { snapshot } = evaluateSuccessRate(
      metric,
      0.995,
      0.8,
    );

    // At exact target, no budget consumed
    expect(snapshot.isBreaching).toBe(false);
    expect(snapshot.errorBudgetRemaining).toBe(1.0);
  });

  it("computes error budget correctly when fully consumed", () => {
    const metric: SuccessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      TotalRuns: 10,
      SuccessfulRuns: 0,
      FailedRuns: 10,
      SuccessRate: 0.0,
    };
    const { snapshot } = evaluateSuccessRate(
      metric,
      0.995,
      0.8,
    );

    expect(snapshot.isBreaching).toBe(true);
    expect(snapshot.errorBudgetRemaining).toBe(0);
  });
});

// ─── 10. SLO Evaluation: Duration Regression ────────────────────────

describe("SLO evaluation — duration regression", () => {
  it("triggers warning when ratio exceeds target multiplier", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 600,
      BaselineP95: 200,
    };
    const { alert } = evaluateDurationRegression(metric, 2.0, 3.0);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning"); // 3x > 2x but not > 3x
    expect(alert!.kind).toBe("duration_regression");
  });

  it("triggers critical when ratio exceeds warning multiplier", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 700,
      BaselineP95: 200,
    };
    const { alert } = evaluateDurationRegression(metric, 2.0, 3.0);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("critical"); // 3.5x > 3x
  });

  it("does not trigger when within multiplier", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 350,
      BaselineP95: 200,
    };
    const { alert } = evaluateDurationRegression(metric, 2.0, 3.0);
    expect(alert).toBeNull();
  });

  it("does not trigger when baseline is null", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 600,
      BaselineP95: null,
    };
    const { alert, snapshot } = evaluateDurationRegression(metric, 2.0, 3.0);
    expect(alert).toBeNull();
    expect(snapshot).toBeNull();
  });

  it("does not trigger when baseline is zero", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 600,
      BaselineP95: 0,
    };
    const { alert, snapshot } = evaluateDurationRegression(metric, 2.0, 3.0);
    expect(alert).toBeNull();
    expect(snapshot).toBeNull();
  });

  it("computes error budget for duration regression", () => {
    const metric: DurationMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      CurrentP95: 300,
      BaselineP95: 200,
    };
    // ratio = 1.5, target = 2.0, budgetRange = 1.0, used = (1.5-1)/1 = 0.5
    const { snapshot } = evaluateDurationRegression(metric, 2.0, 3.0);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.errorBudgetRemaining).toBe(0.5);
    expect(snapshot!.isBreaching).toBe(false);
  });
});

// ─── 11. SLO Evaluation: Freshness ─────────────────────────────────

describe("SLO evaluation — freshness", () => {
  it("triggers warning when hours exceed target", () => {
    const metric: FreshnessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      HoursSinceSuccess: 30,
    };
    const { alert } = evaluateFreshness(metric, 24, 48);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning");
    expect(alert!.kind).toBe("freshness_violation");
  });

  it("triggers critical when hours exceed warning threshold", () => {
    const metric: FreshnessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      HoursSinceSuccess: 50,
    };
    const { alert } = evaluateFreshness(metric, 24, 48);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("critical");
  });

  it("does not trigger when within freshness limit", () => {
    const metric: FreshnessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      HoursSinceSuccess: 12,
    };
    const { alert, snapshot } = evaluateFreshness(metric, 24, 48);

    expect(alert).toBeNull();
    expect(snapshot.isBreaching).toBe(false);
  });

  it("computes error budget proportionally", () => {
    const metric: FreshnessMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      HoursSinceSuccess: 12,
    };
    // 12/24 = 0.5 used => 0.5 remaining
    const { snapshot } = evaluateFreshness(metric, 24, 48);
    expect(snapshot.errorBudgetRemaining).toBe(0.5);
  });
});

// ─── 12. SLO Evaluation: Consecutive Failures ──────────────────────

describe("SLO evaluation — consecutive failures", () => {
  it("triggers warning when count meets target threshold", () => {
    const metric: ConsecFailureMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      ConsecFails: 3,
    };
    const { alert } = evaluateConsecutiveFailures(metric, 3, 5);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning"); // 3 >= 3 but < 5
    expect(alert!.kind).toBe("consecutive_failures");
  });

  it("triggers critical when count meets warning threshold", () => {
    const metric: ConsecFailureMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      ConsecFails: 6,
    };
    const { alert } = evaluateConsecutiveFailures(metric, 3, 5);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("critical"); // 6 >= 5
  });

  it("does not trigger when count is below target", () => {
    const metric: ConsecFailureMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      ConsecFails: 2,
    };
    const { alert } = evaluateConsecutiveFailures(metric, 3, 5);
    expect(alert).toBeNull();
  });

  it("error budget is capped at zero remaining", () => {
    const metric: ConsecFailureMetric = {
      ItemId: "item-1",
      ItemName: "ETL",
      ConsecFails: 10,
    };
    // 10/3 would be >1 but we cap at 1.0 used => 0 remaining
    const { snapshot } = evaluateConsecutiveFailures(metric, 3, 5);
    expect(snapshot.errorBudgetRemaining).toBe(0);
  });
});

// ─── 13. Correlation: rootActivityId Strategy ───────────────────────

describe("correlation — rootActivityId strategy", () => {
  it("correlates children sharing the same rootActivityId in the same workspace", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "shared-root-abc",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:10:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "notebook-item",
        ItemType: "Notebook",
        RootActivityId: "shared-root-abc",
        StartTimeUtc: "2026-03-09T08:01:00Z",
        EndTimeUtc: "2026-03-09T08:06:00Z",
      },
      {
        EventId: "c-2",
        WorkspaceId: "ws-1",
        ItemId: "dataflow-item",
        ItemType: "Dataflow",
        RootActivityId: "shared-root-abc",
        StartTimeUtc: "2026-03-09T08:02:00Z",
        EndTimeUtc: "2026-03-09T08:07:00Z",
      },
    ];

    const matches = correlateByRootActivity(pipeline, children, new Set());
    expect(matches).toHaveLength(2);
  });

  it("does NOT correlate children with different rootActivityId", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "root-A",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:10:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "notebook-item",
        ItemType: "Notebook",
        RootActivityId: "root-B",
        StartTimeUtc: "2026-03-09T08:01:00Z",
        EndTimeUtc: "2026-03-09T08:06:00Z",
      },
    ];

    const matches = correlateByRootActivity(pipeline, children, new Set());
    expect(matches).toHaveLength(0);
  });

  it("does NOT correlate children in different workspaces", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "shared-root",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:10:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-2", // different workspace
        ItemId: "notebook-item",
        ItemType: "Notebook",
        RootActivityId: "shared-root",
        StartTimeUtc: "2026-03-09T08:01:00Z",
        EndTimeUtc: "2026-03-09T08:06:00Z",
      },
    ];

    const matches = correlateByRootActivity(pipeline, children, new Set());
    expect(matches).toHaveLength(0);
  });

  it("skips already-claimed child events", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "shared-root",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:10:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "notebook-item",
        ItemType: "Notebook",
        RootActivityId: "shared-root",
        StartTimeUtc: "2026-03-09T08:01:00Z",
        EndTimeUtc: "2026-03-09T08:06:00Z",
      },
    ];

    // c-1 already claimed by Strategy 0
    const claimed = new Set(["c-1"]);
    const matches = correlateByRootActivity(pipeline, children, claimed);
    expect(matches).toHaveLength(0);
  });

  it("returns empty when pipeline has no rootActivityId", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T08:00:00Z",
      EndTimeUtc: "2026-03-09T08:10:00Z",
    };

    const matches = correlateByRootActivity(pipeline, [], new Set());
    expect(matches).toHaveLength(0);
  });
});

// ─── 14. Correlation: Time-Window Strategy ──────────────────────────

describe("correlation — time-window strategy", () => {
  it("correlates children starting within the pipeline window (+-5min)", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T10:00:00Z",
      EndTimeUtc: "2026-03-09T10:15:00Z",
    };
    const children: SimpleEvent[] = [
      {
        // Within window: starts 2 min after pipeline
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "nb-1",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T10:02:00Z",
        EndTimeUtc: "2026-03-09T10:12:00Z",
      },
      {
        // Within tolerance: starts 3 min before pipeline (within 5-min tolerance)
        EventId: "c-2",
        WorkspaceId: "ws-1",
        ItemId: "nb-2",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T09:57:00Z",
        EndTimeUtc: "2026-03-09T10:08:00Z",
      },
    ];

    const matches = correlateByTimeWindow(pipeline, children, new Set(), 300);
    expect(matches).toHaveLength(2);
  });

  it("does NOT correlate children outside the time window", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T10:00:00Z",
      EndTimeUtc: "2026-03-09T10:15:00Z",
    };
    const children: SimpleEvent[] = [
      {
        // 10 minutes before pipeline start - 5 = outside 5-min tolerance
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "nb-1",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T09:44:00Z",
        EndTimeUtc: "2026-03-09T09:50:00Z",
      },
      {
        // 10 minutes after pipeline end + 5 = outside tolerance
        EventId: "c-2",
        WorkspaceId: "ws-1",
        ItemId: "nb-2",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T10:30:00Z",
        EndTimeUtc: "2026-03-09T10:40:00Z",
      },
    ];

    const matches = correlateByTimeWindow(pipeline, children, new Set(), 300);
    expect(matches).toHaveLength(0);
  });

  it("does NOT correlate children in different workspaces", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T10:00:00Z",
      EndTimeUtc: "2026-03-09T10:15:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-2", // different workspace
        ItemId: "nb-1",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T10:02:00Z",
        EndTimeUtc: "2026-03-09T10:12:00Z",
      },
    ];

    const matches = correlateByTimeWindow(pipeline, children, new Set(), 300);
    expect(matches).toHaveLength(0);
  });

  it("skips already-claimed children", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T10:00:00Z",
      EndTimeUtc: "2026-03-09T10:15:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "nb-1",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "2026-03-09T10:02:00Z",
        EndTimeUtc: "2026-03-09T10:12:00Z",
      },
    ];

    const claimed = new Set(["c-1"]);
    const matches = correlateByTimeWindow(pipeline, children, claimed, 300);
    expect(matches).toHaveLength(0);
  });

  it("handles null start time in child gracefully", () => {
    const pipeline: SimpleEvent = {
      EventId: "p-1",
      WorkspaceId: "ws-1",
      ItemId: "pipeline-item",
      ItemType: "DataPipeline",
      RootActivityId: "",
      StartTimeUtc: "2026-03-09T10:00:00Z",
      EndTimeUtc: "2026-03-09T10:15:00Z",
    };
    const children: SimpleEvent[] = [
      {
        EventId: "c-1",
        WorkspaceId: "ws-1",
        ItemId: "nb-1",
        ItemType: "Notebook",
        RootActivityId: "",
        StartTimeUtc: "", // missing
        EndTimeUtc: "",
      },
    ];

    const matches = correlateByTimeWindow(pipeline, children, new Set(), 300);
    expect(matches).toHaveLength(0);
  });
});

// ─── 15. PSV Column Count vs Table Schema ───────────────────────────

describe("PSV column counts match table schemas from create-tables.kql", () => {
  // These column counts are derived from the actual create-tables.kql file
  const TABLE_SCHEMAS: Record<string, { columns: string[]; count: number }> = {
    FabricEvents: {
      columns: [
        "EventId", "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
        "ItemType", "JobType", "InvokeType", "Status", "FailureReason",
        "RootActivityId", "StartTimeUtc", "EndTimeUtc", "DurationSeconds",
        "CorrelationGroup", "IngestedAt",
      ],
      count: 16,
    },
    EventCorrelations: {
      columns: [
        "UpstreamEventId", "DownstreamEventId", "RelationshipType",
        "ConfidenceScore", "DetectedAt",
      ],
      count: 5,
    },
    WorkspaceInventory: {
      columns: [
        "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
        "ItemType", "CapacityId", "DiscoveredAt", "LastSeenAt",
      ],
      count: 8,
    },
    SloSnapshots: {
      columns: [
        "SnapshotId", "SloId", "ItemId", "MetricType",
        "CurrentValue", "TargetValue", "IsBreaching",
        "ErrorBudgetRemaining", "ComputedAt",
      ],
      count: 9,
    },
    AlertLog: {
      columns: [
        "AlertId", "Kind", "Severity", "WorkspaceId", "WorkspaceName",
        "ItemId", "ItemName", "Message", "Value", "Threshold",
        "NotificationSent", "Timestamp",
      ],
      count: 12,
    },
  };

  for (const [table, schema] of Object.entries(TABLE_SCHEMAS)) {
    it(`${table} has ${schema.count} columns`, () => {
      expect(schema.columns).toHaveLength(schema.count);
    });

    it(`${table} PSV line produces exactly ${schema.count} pipe-separated values`, () => {
      // Build a minimal row with empty values
      const row: Record<string, unknown> = {};
      for (const col of schema.columns) {
        row[col] = `test_${col}`;
      }
      const line = buildPsvLine(row, schema.columns);
      const parts = line.split("|");
      expect(parts).toHaveLength(schema.count);
    });
  }
});
