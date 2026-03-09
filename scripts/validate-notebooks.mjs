#!/usr/bin/env node
/**
 * validate-notebooks.mjs — Static validator for Fabric PySpark notebooks.
 *
 * Checks each .py notebook file for:
 *  1. Required cell markers (# Cell N:)
 *  2. All KQL table references match create-tables.kql
 *  3. Common errors: comma-delimited ingestion flagged, must use PSV
 *  4. Column counts in ingestion lines match table schemas
 *
 * Usage:
 *   node scripts/validate-notebooks.mjs
 *
 * Exit code 0 = all checks pass, non-zero = failures found.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Configuration ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const NOTEBOOKS_DIR = resolve(ROOT, "notebooks");
const KQL_FILE = resolve(ROOT, "kql", "create-tables.kql");

const NOTEBOOK_FILES = [
  "NB_ObsIngestion.py",
  "NB_ObsCorrelation.py",
  "NB_ObsAlerts.py",
];

// Table schemas (column counts) derived from create-tables.kql
// These are maintained in sync with the actual KQL file.
const TABLE_SCHEMAS = {
  FabricEvents: {
    columns: [
      "EventId", "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
      "ItemType", "JobType", "InvokeType", "Status", "FailureReason",
      "RootActivityId", "StartTimeUtc", "EndTimeUtc", "DurationSeconds",
      "CorrelationGroup", "IngestedAt",
    ],
  },
  EventCorrelations: {
    columns: [
      "UpstreamEventId", "DownstreamEventId", "RelationshipType",
      "ConfidenceScore", "DetectedAt",
    ],
  },
  SloDefinitions: {
    columns: [
      "SloId", "WorkspaceId", "ItemId", "ItemName", "MetricType",
      "TargetValue", "WarningThreshold", "EvaluationWindow", "CreatedAt", "IsActive",
    ],
  },
  SloSnapshots: {
    columns: [
      "SnapshotId", "SloId", "ItemId", "MetricType",
      "CurrentValue", "TargetValue", "IsBreaching",
      "ErrorBudgetRemaining", "ComputedAt",
    ],
  },
  AlertRules: {
    columns: [
      "RuleId", "SloId", "Condition", "Threshold",
      "NotificationType", "Target", "Cooldown", "Enabled", "CreatedAt",
    ],
  },
  WorkspaceInventory: {
    columns: [
      "WorkspaceId", "WorkspaceName", "ItemId", "ItemName",
      "ItemType", "CapacityId", "DiscoveredAt", "LastSeenAt",
    ],
  },
  AlertLog: {
    columns: [
      "AlertId", "Kind", "Severity", "WorkspaceId", "WorkspaceName",
      "ItemId", "ItemName", "Message", "Value", "Threshold",
      "NotificationSent", "Timestamp",
    ],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;

function error(file, msg) {
  totalErrors++;
  console.error(`  ERROR   ${file}: ${msg}`);
}

function warn(file, msg) {
  totalWarnings++;
  console.warn(`  WARN    ${file}: ${msg}`);
}

function ok(file, msg) {
  console.log(`  OK      ${file}: ${msg}`);
}

// ─── Step 0: Parse known tables from create-tables.kql ──────────────

function parseKnownTables() {
  const knownTables = new Set(Object.keys(TABLE_SCHEMAS));

  if (existsSync(KQL_FILE)) {
    const kqlContent = readFileSync(KQL_FILE, "utf-8");
    // Extract table names from .create-merge table <Name> (
    const tablePattern = /\.create-merge\s+table\s+(\w+)\s*\(/g;
    let match;
    while ((match = tablePattern.exec(kqlContent)) !== null) {
      knownTables.add(match[1]);
    }
    // Extract materialized view names
    const viewPattern = /\.create-or-alter\s+materialized-view\s+(\w+)/g;
    while ((match = viewPattern.exec(kqlContent)) !== null) {
      knownTables.add(match[1]);
    }
    ok("create-tables.kql", `Parsed ${knownTables.size} table/view definitions`);
  } else {
    warn("create-tables.kql", `File not found at ${KQL_FILE}, using built-in schema list`);
  }

  return knownTables;
}

// ─── Step 1: Check cell markers ─────────────────────────────────────

function checkCellMarkers(filename, content) {
  // Required pattern: lines starting with "# Cell" followed by a number or number.number
  const cellPattern = /^# Cell (\d+(?:\.\d+)?)/gm;
  const cells = [];
  let match;
  while ((match = cellPattern.exec(content)) !== null) {
    cells.push(match[1]);
  }

  if (cells.length === 0) {
    error(filename, "No cell markers found (expected '# Cell N:' pattern)");
    return;
  }

  // Check that Cell 1 exists
  if (!cells.includes("1")) {
    error(filename, "Missing Cell 1 marker");
  }

  // Check sequential numbering (allowing .5 cells like Cell 4.5)
  const intCells = cells.map((c) => Math.floor(parseFloat(c)));
  const maxCell = Math.max(...intCells);
  for (let i = 1; i <= maxCell; i++) {
    if (!intCells.includes(i)) {
      warn(filename, `Gap in cell numbering: Cell ${i} missing (have cells: ${cells.join(", ")})`);
    }
  }

  ok(filename, `Found ${cells.length} cell markers: ${cells.join(", ")}`);
}

// ─── Step 2: Validate KQL table references ──────────────────────────

function checkTableReferences(filename, content, knownTables) {
  const referencedTables = new Set();

  // Pattern 1: .ingest inline into table <TableName>
  const ingestPattern = /\.ingest\s+inline\s+into\s+table\s+(\w+)/g;
  let match;
  while ((match = ingestPattern.exec(content)) !== null) {
    referencedTables.add(match[1]);
  }

  // Pattern 2: KQL queries — table name at start of query string
  // Look for table names in KQL query strings (inside triple-quoted or regular strings)
  // Match lines that start with a table-like identifier followed by KQL pipe or newline
  const kqlTablePattern = /["']{1,3}\s*\n?\s*(\w+)\s*\n?\s*\|/g;
  while ((match = kqlTablePattern.exec(content)) !== null) {
    const candidate = match[1];
    // Only flag if it's not a Python/KQL keyword
    const pyKeywords = new Set([
      "if", "else", "for", "while", "def", "class", "return", "import",
      "from", "try", "except", "with", "as", "in", "not", "and", "or",
      "let", "where", "project", "summarize", "extend", "order", "join",
    ]);
    if (!pyKeywords.has(candidate.toLowerCase())) {
      referencedTables.add(candidate);
    }
  }

  // Pattern 3: .create-merge table <TableName>
  const createPattern = /\.create-merge\s+table\s+(\w+)/g;
  while ((match = createPattern.exec(content)) !== null) {
    referencedTables.add(match[1]);
  }

  // Validate each referenced table
  let unknownCount = 0;
  for (const table of referencedTables) {
    if (!knownTables.has(table)) {
      error(filename, `Unknown table reference: '${table}' (not in create-tables.kql)`);
      unknownCount++;
    }
  }

  if (unknownCount === 0 && referencedTables.size > 0) {
    ok(filename, `All ${referencedTables.size} table references are valid: ${[...referencedTables].join(", ")}`);
  }
}

// ─── Step 3: Check for common ingestion errors ──────────────────────

function checkIngestionFormat(filename, content) {
  const lines = content.split("\n");
  let hasIngestion = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for CSV format ingestion (should be PSV)
    if (/format\s*=\s*csv/i.test(line)) {
      error(filename, `Line ${lineNum}: Comma-delimited ingestion detected (format=csv). Use format=psv.`);
    }

    // Check for inline ingestion without format spec
    if (/\.ingest\s+inline\s+into\s+table\s+\w+\s*<\|/i.test(line) && !/with\s*\(/i.test(line)) {
      error(filename, `Line ${lineNum}: Inline ingestion without format specification. Use 'with (format=psv)'.`);
    }

    // Detect ingestion lines and validate format
    if (/\.ingest\s+inline\s+into\s+table/i.test(line)) {
      hasIngestion = true;

      // Verify PSV format is specified
      if (/format\s*=\s*psv/i.test(line)) {
        // Good — PSV format
      } else if (/with\s*\(/i.test(line) && !/format\s*=/i.test(line)) {
        warn(filename, `Line ${lineNum}: Ingestion with() clause but no format specified. Recommend format=psv.`);
      }
    }

    // Check for comma-based join in Python that constructs ingestion values
    // This catches: '",".join(...)' patterns that should use '"|".join(...)'
    if (/['"],'["]\s*\.join\s*\(/.test(line) && /ingest|values|csl/i.test(lines.slice(Math.max(0, i - 5), i + 5).join(" "))) {
      warn(filename, `Line ${lineNum}: Comma-based join near ingestion code. Verify this is not building PSV values with commas.`);
    }
  }

  if (hasIngestion) {
    ok(filename, "Ingestion commands found and format checked");
  }
}

// ─── Step 4: Validate column counts in PSV generation ───────────────

function checkColumnCounts(filename, content) {
  // Find Python code that builds PSV values for ingestion
  // Pattern: look for column lists followed by join operations
  // We match explicit column lists like:
  //   columns = ["Col1", "Col2", ...]
  //   or inline: "|".join([row["A"], row["B"], ...])

  // Strategy: find .ingest references and the associated value-building code

  // Match lines like: values = "|".join([...])
  const joinPattern = /['"]?\|['"]?\s*\.\s*join\s*\(\s*\[([^\]]+)\]/g;
  let match;
  while ((match = joinPattern.exec(content)) !== null) {
    const joinBody = match[1];
    // Count the comma-separated elements (approximate)
    const elements = joinBody.split(",").map((s) => s.trim()).filter(Boolean);
    const elementCount = elements.length;

    // Try to find which table this is for by scanning nearby lines
    const pos = match.index;
    const nearbyStart = Math.max(0, pos - 500);
    const nearbyEnd = Math.min(content.length, pos + 200);
    const nearbyText = content.substring(nearbyStart, nearbyEnd);

    const tableMatch = nearbyText.match(/into\s+table\s+(\w+)/);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const schema = TABLE_SCHEMAS[tableName];
      if (schema) {
        if (elementCount !== schema.columns.length) {
          error(
            filename,
            `Column count mismatch for table '${tableName}': ` +
            `PSV join has ${elementCount} elements but schema has ${schema.columns.length} columns ` +
            `(${schema.columns.join(", ")})`
          );
        } else {
          ok(filename, `Table '${tableName}': PSV column count (${elementCount}) matches schema`);
        }
      }
    }
  }

  // Also check column lists defined as Python arrays
  // Pattern: columns = ["Col1", "Col2", ...]
  const colListPattern = /(?:columns|inv_columns)\s*=\s*\[\s*([^\]]+)\]/g;
  while ((match = colListPattern.exec(content)) !== null) {
    const listBody = match[1];
    const colNames = listBody.match(/"([^"]+)"/g);
    if (!colNames) continue;

    const colCount = colNames.length;

    // Find associated table reference nearby
    const pos = match.index;
    const afterText = content.substring(pos, Math.min(content.length, pos + 1000));
    const tableMatch = afterText.match(/into\s+table\s+(\w+)/);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const schema = TABLE_SCHEMAS[tableName];
      if (schema) {
        if (colCount !== schema.columns.length) {
          error(
            filename,
            `Column list mismatch for table '${tableName}': ` +
            `Python list has ${colCount} columns but schema has ${schema.columns.length} columns`
          );
        } else {
          ok(filename, `Table '${tableName}': Column list (${colCount}) matches schema`);
        }
      }
    }
  }
}

// ─── Step 5: Additional checks ──────────────────────────────────────

function checkAdditionalPatterns(filename, content) {
  // Check that notebooks have proper auth section
  if (!/def\s+get_kusto_token/.test(content)) {
    warn(filename, "Missing get_kusto_token() function definition");
  }

  // Check for hardcoded credentials (should use notebookutils or spark.conf)
  const credPatterns = [
    { pattern: /CLIENT_SECRET\s*=\s*["'][^"']+["']/, msg: "Hardcoded CLIENT_SECRET detected" },
    { pattern: /Bearer\s+[a-zA-Z0-9_\-.]{50,}/, msg: "Hardcoded bearer token detected" },
  ];
  for (const { pattern, msg } of credPatterns) {
    if (pattern.test(content)) {
      error(filename, msg);
    }
  }

  // Check that ingestion uses the mgmt endpoint (v1/rest/mgmt), not query endpoint
  if (/\.ingest\s+inline/.test(content) && !/v1\/rest\/mgmt/.test(content)) {
    warn(filename, "Ingestion commands found but no reference to v1/rest/mgmt endpoint");
  }

  // Check for proper error handling around API calls
  const apiCallCount = (content.match(/requests\.(post|get)\(/g) || []).length;
  const tryExceptCount = (content.match(/try:/g) || []).length;
  if (apiCallCount > 0 && tryExceptCount === 0) {
    warn(filename, `${apiCallCount} API calls found but no try/except error handling`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  console.log("=".repeat(70));
  console.log("Fabric Notebook Validation");
  console.log("=".repeat(70));
  console.log();

  const knownTables = parseKnownTables();
  console.log();

  for (const nbFile of NOTEBOOK_FILES) {
    const filePath = resolve(NOTEBOOKS_DIR, nbFile);
    console.log(`--- ${nbFile} ---`);

    if (!existsSync(filePath)) {
      error(nbFile, `File not found: ${filePath}`);
      console.log();
      continue;
    }

    const content = readFileSync(filePath, "utf-8");

    checkCellMarkers(nbFile, content);
    checkTableReferences(nbFile, content, knownTables);
    checkIngestionFormat(nbFile, content);
    checkColumnCounts(nbFile, content);
    checkAdditionalPatterns(nbFile, content);
    console.log();
  }

  // Summary
  console.log("=".repeat(70));
  console.log(`Validation complete: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
  console.log("=".repeat(70));

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
