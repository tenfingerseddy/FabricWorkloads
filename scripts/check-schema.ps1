$ErrorActionPreference = "Stop"

$tid = [System.Environment]::GetEnvironmentVariable('FABRIC_TENANT_ID', 'User')
$cid = [System.Environment]::GetEnvironmentVariable('FABRIC_CLIENT_ID', 'User')
$cs  = [System.Environment]::GetEnvironmentVariable('FABRIC_CLIENT_SECRET', 'User')

$kustoBody = @{
    grant_type    = 'client_credentials'
    client_id     = $cid
    client_secret = $cs
    scope         = 'https://kusto.kusto.windows.net/.default'
}
$kustoTokenResp = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tid/oauth2/v2.0/token" -Method POST -Body $kustoBody
$kustoToken = $kustoTokenResp.access_token

$kustoHeaders = @{
    Authorization  = "Bearer $kustoToken"
    'Content-Type' = 'application/json'
}
$kustoBase = [System.Environment]::GetEnvironmentVariable('EVENTHOUSE_QUERY_ENDPOINT', 'User')
if (-not $kustoBase) { $kustoBase = [System.Environment]::GetEnvironmentVariable('EVENTHOUSE_QUERY_ENDPOINT', 'Process') }
if (-not $kustoBase) { throw "Missing required environment variable: EVENTHOUSE_QUERY_ENDPOINT" }
$kustoUri = "$kustoBase/v1/rest/query"

# Check SloSnapshots schema
Write-Output "=== SloSnapshots Schema ==="
$q1 = @{ db = "EH_Observability"; csl = ".show table SloSnapshots schema as json" } | ConvertTo-Json
$r1 = Invoke-RestMethod -Uri "$kustoBase/v1/rest/mgmt" -Headers $kustoHeaders -Method POST -Body $q1
$r1 | ConvertTo-Json -Depth 10

# Check EventCorrelations schema
Write-Output ""
Write-Output "=== EventCorrelations Schema ==="
$q2 = @{ db = "EH_Observability"; csl = ".show table EventCorrelations schema as json" } | ConvertTo-Json
$r2 = Invoke-RestMethod -Uri "$kustoBase/v1/rest/mgmt" -Headers $kustoHeaders -Method POST -Body $q2
$r2 | ConvertTo-Json -Depth 10

# Count rows in each table
Write-Output ""
Write-Output "=== Row Counts ==="
$q3 = @{ db = "EH_Observability"; csl = "SloSnapshots | count" } | ConvertTo-Json
$r3 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $q3
$r3.Tables[0].Rows | ConvertTo-Json

$q4 = @{ db = "EH_Observability"; csl = "EventCorrelations | count" } | ConvertTo-Json
$r4 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $q4
Write-Output "EventCorrelations count:"
$r4.Tables[0].Rows | ConvertTo-Json

# Check EventCorrelations for null patterns
Write-Output ""
Write-Output "=== EventCorrelations null check ==="
$q5 = @{ db = "EH_Observability"; csl = "EventCorrelations | summarize TotalRows=count(), NullDownstream=countif(isnull(DownstreamEventId)), NullRelType=countif(RelationshipType == ''), NullConfidence=countif(isnull(ConfidenceScore))" } | ConvertTo-Json
$r5 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $q5
Write-Output "Columns:"
$r5.Tables[0].Columns | ForEach-Object { Write-Output "  $($_.ColumnName)" }
Write-Output "Values:"
$r5.Tables[0].Rows | ConvertTo-Json
