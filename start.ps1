<#
  Starts the CyberCup AI Security Gateway: security engine (:8000), backend (:8080), frontend (:5173).
  Each service opens in its own window; close a window to stop that service.

  Run from the repository folder:   powershell -ExecutionPolicy Bypass -File .\start.ps1

  Split across devices (see docs/02_REMOTE_SETUP.md) with these .env settings:
    START_ENGINE / START_BACKEND / START_FRONTEND = true|false   which services run on THIS machine
    SHARE_ON_NETWORK=true      let other devices reach the services started here
    BACKEND_URL=http://<ip>:8080      where the frontend finds the backend (when it runs elsewhere)
    AI_ENGINE_BASE_URL=http://<ip>:8000   where the backend finds the engine (when it runs elsewhere)
#>
param([string]$EnvFile = "")
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if (-not $EnvFile) { $EnvFile = "$Root\.env" }
. "$Root\scripts\common.ps1"

Import-DotEnv $EnvFile

function Flag($name) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    return -not ($value -and $value.Trim().ToLower() -in @("false", "0", "no", "off"))
}
$startEngine = Flag "START_ENGINE"
$startBackend = Flag "START_BACKEND"
$startFrontend = Flag "START_FRONTEND"
$share = [bool]($env:SHARE_ON_NETWORK -and $env:SHARE_ON_NETWORK.Trim().ToLower() -eq "true")
$bindHost = if ($share) { "0.0.0.0" } else { "127.0.0.1" }

if ($startBackend -and -not $env:JWT_SECRET) { throw "JWT_SECRET is missing. Run setup.ps1 first." }

$java = Find-Java
$node = Find-Node
$venvPython = "$Root\security-engine\.venv\Scripts\python.exe"
if (($startBackend -and -not $java) -or ($startFrontend -and -not $node) -or ($startEngine -and -not (Test-Path $venvPython))) {
    throw "Tools are missing for the services you asked to start. Run setup.ps1 first."
}

$ip = Get-LanAddress
$waitFor = @()

if ($startEngine) {
    Write-Step "Starting the security engine on port 8000$(if ($share) { " (shared: http://${ip}:8000)" })"
    Start-Process "$PSHOME\powershell.exe" -WorkingDirectory "$Root\security-engine" -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle='CyberCup security engine'; & '$venvPython' -m uvicorn app.main:app --host $bindHost --port 8000")
    $waitFor += @{Name = "security engine"; Port = 8000}
}

if ($startBackend) {
    $env:JAVA_HOME = Split-Path (Split-Path $java)
    $dbProfile = if ($env:DB_PROFILE) { $env:DB_PROFILE } else { "local" }
    $springProfile = if ($dbProfile -eq "mysql") { "default" } else { "local" }
    if ($springProfile -eq "default") {
        Write-Host "  Database: MySQL at $($env:DB_URL -replace '\?.*$', '')"
    }
    # Allow the frontend to call this backend from other devices too.
    $origins = @("http://localhost:5173", "http://localhost:4173", "https://idainakoda.github.io")
    if ($share -and $ip) { $origins += "http://${ip}:5173" }
    if ($env:EXTRA_CORS_ORIGINS) { $origins += $env:EXTRA_CORS_ORIGINS -split "," }
    $env:CORS_ORIGINS = ($origins | Where-Object { $_ } | ForEach-Object { $_.Trim() }) -join ","
    Write-Step "Starting the backend on port 8080 (database profile: $springProfile)$(if ($share) { " (shared: http://${ip}:8080)" })"
    Start-Process "$PSHOME\powershell.exe" -WorkingDirectory $Root -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle='CyberCup backend'; & '$Root\mvnw.cmd' -q spring-boot:run '-Dspring-boot.run.profiles=$springProfile'")
    $waitFor += @{Name = "backend"; Port = 8080}
}

if ($startFrontend) {
    $env:VITE_API_BASE_URL = if ($env:BACKEND_URL) { $env:BACKEND_URL.TrimEnd("/") } else { "http://localhost:8080" }
    $viteHost = if ($share) { "--host 0.0.0.0" } else { "" }
    Write-Step "Starting the frontend on http://localhost:5173/zeroTwo/ (backend: $($env:VITE_API_BASE_URL))"
    Start-Process "$PSHOME\powershell.exe" -WorkingDirectory "$Root\frontend" -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle='CyberCup frontend'; & '$node' node_modules\vite\bin\vite.js --port 5173 $viteHost")
    $waitFor += @{Name = "frontend"; Port = 5173}
}

Write-Step "Waiting for the services"
foreach ($svc in $waitFor) {
    if (Wait-Port $svc.Port 180) {
        Write-Host "  $($svc.Name) is up on port $($svc.Port)" -ForegroundColor Green
    } else {
        Write-Host "  $($svc.Name) did not start on port $($svc.Port) - check its window" -ForegroundColor Yellow
    }
}

if ($startFrontend) {
    Start-Process "http://localhost:5173/zeroTwo/"
}
if ($share -and $ip) {
    Write-Step "Other devices on your network can use this machine at $ip"
    Write-Host "  If they cannot connect, run once as administrator:  scripts\open-firewall.ps1"
}
Write-Step "Ready. Demo accounts are listed on the login page."
