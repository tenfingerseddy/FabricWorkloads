$ErrorActionPreference = "Stop"

$tid = [System.Environment]::GetEnvironmentVariable('FABRIC_TENANT_ID', 'User')
$cid = [System.Environment]::GetEnvironmentVariable('FABRIC_CLIENT_ID', 'User')
$cs  = [System.Environment]::GetEnvironmentVariable('FABRIC_CLIENT_SECRET', 'User')

# Get Fabric API token
$body = @{
    grant_type    = 'client_credentials'
    client_id     = $cid
    client_secret = $cs
    scope         = 'https://api.fabric.microsoft.com/.default'
}
$tokenResp = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tid/oauth2/v2.0/token" -Method POST -Body $body
$fabricToken = $tokenResp.access_token
Write-Output "=== Fabric token acquired ==="

# Get Kusto token
$kustoBody = @{
    grant_type    = 'client_credentials'
    client_id     = $cid
    client_secret = $cs
    scope         = 'https://kusto.kusto.windows.net/.default'
}
$kustoTokenResp = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tid/oauth2/v2.0/token" -Method POST -Body $kustoBody
$kustoToken = $kustoTokenResp.access_token
Write-Output "=== Kusto token acquired ==="

# 1. Query Jobs API
$wsId = '910a8092-09f6-4498-984d-52b174715f67'
$itemId = 'd0899650-f680-419b-95eb-e7784bd5e05b'
$headers = @{ Authorization = "Bearer $fabricToken" }

Write-Output ""
Write-Output "=========================================="
Write-Output "1. JOBS API - NB_ObsAlerts Recent Instances"
Write-Output "=========================================="
try {
    $jobsResp = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$wsId/items/$itemId/jobs/instances?limit=10" -Headers $headers -Method GET
    $jobsResp | ConvertTo-Json -Depth 10
} catch {
    Write-Output "Jobs API error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $reader.ReadToEnd()
    }
}

# 2. Query FabricEvents for failures
$kustoHeaders = @{
    Authorization  = "Bearer $kustoToken"
    'Content-Type' = 'application/json'
}
$kustoUri = "https://trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com/v1/rest/query"

Write-Output ""
Write-Output "=========================================="
Write-Output "2. FABRIC EVENTS - NB_ObsAlerts Failures"
Write-Output "=========================================="
$query1 = @{
    db  = "EH_Observability"
    csl = "FabricEvents | where ItemName == 'NB_ObsAlerts' and Status == 'Failed' | project StartTimeUtc, EndTimeUtc, DurationSeconds, FailureReason, IngestedAt | order by IngestedAt desc | take 5"
} | ConvertTo-Json
try {
    $result1 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $query1
    $result1 | ConvertTo-Json -Depth 10
} catch {
    Write-Output "KQL query error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $reader.ReadToEnd()
    }
}

# 3. Query SloSnapshots
Write-Output ""
Write-Output "=========================================="
Write-Output "3. SLO SNAPSHOTS"
Write-Output "=========================================="
$query2 = @{
    db  = "EH_Observability"
    csl = "SloSnapshots | take 20"
} | ConvertTo-Json
try {
    $result2 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $query2
    $result2 | ConvertTo-Json -Depth 10
} catch {
    Write-Output "KQL query error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $reader.ReadToEnd()
    }
}

# 4. Query EventCorrelations
Write-Output ""
Write-Output "=========================================="
Write-Output "4. EVENT CORRELATIONS"
Write-Output "=========================================="
$query3 = @{
    db  = "EH_Observability"
    csl = "EventCorrelations | project UpstreamEventId, DownstreamEventId, RelationshipType, ConfidenceScore, DetectedAt | take 20"
} | ConvertTo-Json
try {
    $result3 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $query3
    $result3 | ConvertTo-Json -Depth 10
} catch {
    Write-Output "KQL query error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $reader.ReadToEnd()
    }
}

# 5. Also get ALL NB_ObsAlerts events (not just failures)
Write-Output ""
Write-Output "=========================================="
Write-Output "5. ALL NB_ObsAlerts EVENTS (last 10)"
Write-Output "=========================================="
$query4 = @{
    db  = "EH_Observability"
    csl = "FabricEvents | where ItemName == 'NB_ObsAlerts' | project StartTimeUtc, EndTimeUtc, DurationSeconds, Status, FailureReason, IngestedAt | order by IngestedAt desc | take 10"
} | ConvertTo-Json
try {
    $result4 = Invoke-RestMethod -Uri $kustoUri -Headers $kustoHeaders -Method POST -Body $query4
    $result4 | ConvertTo-Json -Depth 10
} catch {
    Write-Output "KQL query error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $reader.ReadToEnd()
    }
}
