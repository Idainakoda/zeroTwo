<#
  Checks that this machine can reach the other CyberCup machines configured in .env.

    powershell -ExecutionPolicy Bypass -File .\scripts\check-connection.ps1
#>
param([string]$EnvFile = "")
$Root = Split-Path $PSScriptRoot
if (-not $EnvFile) { $EnvFile = "$Root\.env" }
. "$PSScriptRoot\common.ps1"
Import-DotEnv $EnvFile

function Show($ok, $label, $hint) {
    if ($ok) {
        Write-Host "  [OK]   $label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        if ($hint) { Write-Host "         $hint" -ForegroundColor Yellow }
    }
}

Write-Step "This machine"
$ip = Get-LanAddress
Write-Host "  LAN address: $(if ($ip) { $ip } else { 'not found (are you connected to Wi-Fi/LAN?)' })"

if ($env:DB_PROFILE -eq "mysql" -and $env:DB_URL -match 'jdbc:mysql://([^:/?]+)(?::(\d+))?') {
    $dbHost = $Matches[1]
    $dbPort = if ($Matches[2]) { [int]$Matches[2] } else { 3306 }
    Write-Step "MySQL ($dbHost`:$dbPort)"
    Show (Test-Remote $dbHost $dbPort) "TCP connection to MySQL" `
        "On the database machine: MySQL service running, scripts\open-firewall.ps1 -MySQL, same network / Tailscale."
    if (-not $env:DB_USERNAME -or -not $env:DB_PASSWORD) {
        Write-Host "  [WARN] DB_USERNAME / DB_PASSWORD are not set in .env" -ForegroundColor Yellow
    }
}

if ($env:AI_ENGINE_BASE_URL) {
    Write-Step "Security engine ($($env:AI_ENGINE_BASE_URL))"
    try {
        $h = Invoke-RestMethod "$($env:AI_ENGINE_BASE_URL.TrimEnd('/'))/health" -TimeoutSec 5
        Show ($h.status -eq "ok") "Engine health: semantic=$($h.ml_injection.semantic) classifier=$($h.ml_injection.classifier) documents=$($h.rag_documents)"
    } catch {
        Show $false "Engine /health" "On the engine machine: SHARE_ON_NETWORK=true in .env, start.ps1, open-firewall.ps1."
    }
}

if ($env:BACKEND_URL) {
    Write-Step "Backend ($($env:BACKEND_URL))"
    try {
        Invoke-WebRequest "$($env:BACKEND_URL.TrimEnd('/'))/api/auth/me" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Show $true "Backend reachable"
    } catch {
        # 401 = backend is up and correctly asking for a login
        $code = $_.Exception.Response.StatusCode.value__
        Show ($code -eq 401) "Backend reachable (HTTP $code)" `
            "On the backend machine: SHARE_ON_NETWORK=true in .env, start.ps1, open-firewall.ps1."
    }
}
Write-Host ""
