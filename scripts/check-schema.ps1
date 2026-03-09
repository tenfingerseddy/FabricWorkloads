<#
.SYNOPSIS
    Checks Eventhouse table schemas, row counts, and data quality.

.DESCRIPTION
    Connects to the Observability Workbench Eventhouse and inspects table
    schemas for SloSnapshots, EventCorrelations, and all other core tables.
    Reports row counts and null/empty field patterns.

.NOTES
    Required environment variables:
      FABRIC_TENANT_ID
      FABRIC_CLIENT_ID
      FABRIC_CLIENT_SECRET
      EVENTHOUSE_QUERY_ENDPOINT   (User or Process scope)
      KQL_DATABASE                (optional, defaults to EH_Observability)
#>

$ErrorActionPreference = "Stop"

# ── Load environment variables ──────────────────────────────────────

function Get-EnvVarSafe {
    param([string]$Name)
    # Check Process scope first (works in CI, Docker, shells), then User scope
    $val = [System.Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($val) { return $val }
    $val = [System.Environment]::GetEnvironmentVariable($Name, 'User')
    if ($val) { return $val }
    return $null
}

$tid = Get-EnvVarSafe 'FABRIC_TENANT_ID'
$cid = Get-EnvVarSafe 'FABRIC_CLIENT_ID'
$cs  = Get-EnvVarSafe 'FABRIC_CLIENT_SECRET'

if (-not $tid) { throw "Missing required environment variable: FABRIC_TENANT_ID" }
if (-not $cid) { throw "Missing required environment variable: FABRIC_CLIENT_ID" }
if (-not $cs)  { throw "Missing required environment variable: FABRIC_CLIENT_SECRET" }

$kustoBase = Get-EnvVarSafe 'EVENTHOUSE_QUERY_ENDPOINT'
if (-not $kustoBase) {
    $kustoBase = Get-EnvVarSafe 'KQL_QUERY_ENDPOINT'
}
if (-not $kustoBase) {
    throw "Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT (or KQL_QUERY_ENDPOINT)"
}

$database = Get-EnvVarSafe 'KQL_DATABASE'
if (-not $database) { $database = "EH_Observability" }

# ── Authenticate using Eventhouse-specific scope ────────────────────
# Use the Eventhouse endpoint as the token audience. This is more
# reliable for Fabric Eventhouse than the generic kusto.windows.net scope.

Write-Output "============================================================"
Write-Output "  Observability Workbench -- Schema Check"
Write-Output "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | DB: $database"
Write-Output "============================================================"
Write-Output ""

$kustoBody = @{
    grant_type    = 'client_credentials'
    client_id     = $cid
    client_secret = $cs
    scope         = "$kustoBase/.default"
}

try {
    $kustoTokenResp = Invoke-RestMethod `
        -Uri "https://login.microsoftonline.com/$tid/oauth2/v2.0/token" `
        -Method POST `
        -Body $kustoBody
    $kustoToken = $kustoTokenResp.access_token
    Write-Output "  [OK] Kusto token acquired (scope: $kustoBase/.default)"
} catch {
    Write-Output "  [FAIL] Could not acquire Kusto token: $($_.Exception.Message)"
    exit 2
}

$kustoHeaders = @{
    Authorization  = "Bearer $kustoToken"
    'Content-Type' = 'application/json'
}
$kustoQueryUri = "$kustoBase/v1/rest/query"
$kustoMgmtUri  = "$kustoBase/v1/rest/mgmt"

# ── Helper to run a KQL query and return rows ──────────────────────

function Invoke-KqlQuery {
    param([string]$Kql)
    $body = @{ db = $database; csl = $Kql } | ConvertTo-Json
    $result = Invoke-RestMethod -Uri $kustoQueryUri -Headers $kustoHeaders -Method POST -Body $body
    return $result
}

function Invoke-KqlMgmt {
    param([string]$Command)
    $body = @{ db = $database; csl = $Command } | ConvertTo-Json
    $result = Invoke-RestMethod -Uri $kustoMgmtUri -Headers $kustoHeaders -Method POST -Body $body
    return $result
}

# ── Define tables to inspect ────────────────────────────────────────

$tables = @(
    'FabricEvents',
    'SloDefinitions',
    'SloSnapshots',
    'AlertRules',
    'AlertLog',
    'EventCorrelations',
    'WorkspaceInventory'
)

# ── 1. Schema inspection ───────────────────────────────────────────

Write-Output ""
Write-Output "------------------------------------------------------------"
Write-Output "  1. TABLE SCHEMAS"
Write-Output "------------------------------------------------------------"

foreach ($table in $tables) {
    Write-Output ""
    Write-Output "  === $table ==="
    try {
        $schemaResult = Invoke-KqlMgmt ".show table $table schema as json"
        $row = $schemaResult.Tables[0].Rows[0]
        # Schema JSON is typically in index 1 (or 0 for some versions)
        $schemaJson = $null
        foreach ($cell in $row) {
            try {
                $parsed = $cell | ConvertFrom-Json
                if ($parsed.OrderedColumns) {
                    $schemaJson = $parsed
                    break
                }
            } catch { }
        }
        if ($schemaJson -and $schemaJson.OrderedColumns) {
            foreach ($col in $schemaJson.OrderedColumns) {
                $colType = if ($col.CslType) { $col.CslType } else { $col.Type }
                Write-Output "    $($col.Name): $colType"
            }
        } else {
            Write-Output "    (could not parse schema)"
        }
    } catch {
        Write-Output "    [ERROR] $($_.Exception.Message)"
    }
}

# ── 2. Row counts ──────────────────────────────────────────────────

Write-Output ""
Write-Output "------------------------------------------------------------"
Write-Output "  2. ROW COUNTS"
Write-Output "------------------------------------------------------------"
Write-Output ""

foreach ($table in $tables) {
    try {
        $countResult = Invoke-KqlQuery "$table | count"
        $count = $countResult.Tables[0].Rows[0][0]
        $status = if ($count -gt 0) { "  OK  " } else { " WARN " }
        Write-Output "  [$status] $($table.PadRight(25)) $count rows"
    } catch {
        Write-Output "  [ FAIL ] $($table.PadRight(25)) $($_.Exception.Message)"
    }
}

# ── 3. Data quality checks ─────────────────────────────────────────

Write-Output ""
Write-Output "------------------------------------------------------------"
Write-Output "  3. DATA QUALITY CHECKS"
Write-Output "------------------------------------------------------------"

# EventCorrelations null patterns
Write-Output ""
Write-Output "  --- EventCorrelations null/empty check ---"
try {
    $q = "EventCorrelations | summarize TotalRows=count(), NullDownstream=countif(isnull(DownstreamEventId)), NullRelType=countif(RelationshipType == ''), NullConfidence=countif(isnull(ConfidenceScore))"
    $result = Invoke-KqlQuery $q
    $cols = $result.Tables[0].Columns | ForEach-Object { $_.ColumnName }
    $vals = $result.Tables[0].Rows[0]
    for ($i = 0; $i -lt $cols.Count; $i++) {
        $status = if ($cols[$i] -eq 'TotalRows' -or $vals[$i] -eq 0) { "  OK  " } else { " WARN " }
        Write-Output "    [$status] $($cols[$i]): $($vals[$i])"
    }
} catch {
    Write-Output "    [ERROR] $($_.Exception.Message)"
}

# SloSnapshots data check
Write-Output ""
Write-Output "  --- SloSnapshots latest per metric ---"
try {
    $q = "SloSnapshots | summarize arg_max(ComputedAt, *) by SloId | project MetricType, CurrentValue, TargetValue, IsBreaching, ComputedAt | order by IsBreaching desc, MetricType asc"
    $result = Invoke-KqlQuery $q
    $cols = $result.Tables[0].Columns | ForEach-Object { $_.ColumnName }
    foreach ($row in $result.Tables[0].Rows) {
        $obj = @{}
        for ($i = 0; $i -lt $cols.Count; $i++) {
            $obj[$cols[$i]] = $row[$i]
        }
        $breaching = if ($obj['IsBreaching'] -eq $true) { "BREACH" } else { "  ok  " }
        Write-Output "    [$breaching] $($obj['MetricType']): current=$($obj['CurrentValue']) target=$($obj['TargetValue']) @ $($obj['ComputedAt'])"
    }
} catch {
    Write-Output "    [ERROR] $($_.Exception.Message)"
}

# FabricEvents dedup check
Write-Output ""
Write-Output "  --- FabricEvents dedup check ---"
try {
    $q = "FabricEvents | summarize Copies=count() by EventId | where Copies > 1 | count"
    $result = Invoke-KqlQuery $q
    $dupes = $result.Tables[0].Rows[0][0]
    $status = if ($dupes -eq 0) { "  OK  " } else { " WARN " }
    Write-Output "    [$status] Duplicate EventIds: $dupes"
} catch {
    Write-Output "    [ERROR] $($_.Exception.Message)"
}

Write-Output ""
Write-Output "============================================================"
Write-Output "  Schema check complete."
Write-Output "============================================================"
