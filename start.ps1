<#
  Starts the CyberCup AI Security Gateway: security engine (:8000), backend (:8080), frontend (:5173).
  Each service opens in its own window; close a window to stop that service.

  Run from the repository folder:   powershell -ExecutionPolicy Bypass -File .\start.ps1
#>
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
. "$Root\scripts\common.ps1"

Import-DotEnv "$Root\.env"
if (-not $env:JWT_SECRET) { throw "JWT_SECRET is missing. Run setup.ps1 first." }

$java = Find-Java
$node = Find-Node
$venvPython = "$Root\security-engine\.venv\Scripts\python.exe"
if (-not $java -or -not $node -or -not (Test-Path $venvPython)) {
    throw "Tools are missing. Run setup.ps1 first."
}
$env:JAVA_HOME = Split-Path (Split-Path $java)
$dbProfile = if ($env:DB_PROFILE) { $env:DB_PROFILE } else { "local" }
$springProfile = if ($dbProfile -eq "mysql") { "default" } else { "local" }

Write-Step "Starting the security engine on http://localhost:8000 (loads ML models, about 30 s)"
Start-Process "$PSHOME\powershell.exe" -WorkingDirectory "$Root\security-engine" -ArgumentList @(
    "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='CyberCup security engine'; & '$venvPython' -m uvicorn app.main:app --port 8000")

Write-Step "Starting the backend on http://localhost:8080 (database profile: $springProfile)"
Start-Process "$PSHOME\powershell.exe" -WorkingDirectory $Root -ArgumentList @(
    "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='CyberCup backend'; & '$Root\mvnw.cmd' -q spring-boot:run '-Dspring-boot.run.profiles=$springProfile'")

Write-Step "Starting the frontend on http://localhost:5173/zeroTwo/"
$env:VITE_API_BASE_URL = "http://localhost:8080"
Start-Process "$PSHOME\powershell.exe" -WorkingDirectory "$Root\frontend" -ArgumentList @(
    "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='CyberCup frontend'; & '$node' node_modules\vite\bin\vite.js --port 5173")

Write-Step "Waiting for the services"
foreach ($svc in @(@{Name = "security engine"; Port = 8000}, @{Name = "backend"; Port = 8080}, @{Name = "frontend"; Port = 5173})) {
    if (Wait-Port $svc.Port 180) {
        Write-Host "  $($svc.Name) is up on port $($svc.Port)" -ForegroundColor Green
    } else {
        Write-Host "  $($svc.Name) did not start on port $($svc.Port) - check its window" -ForegroundColor Yellow
    }
}

Start-Process "http://localhost:5173/zeroTwo/"
Write-Step "Ready. Demo accounts are listed on the login page."
