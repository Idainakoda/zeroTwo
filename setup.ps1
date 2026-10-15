<#
  One-time setup for the CyberCup AI Security Gateway on Windows.
  - Uses Java 21 / Node 22 from PATH, or downloads portable copies into .\tools (no admin rights needed)
  - Creates the Python environment for the security engine and downloads its models
  - Installs the frontend packages
  - Creates .env with a random JWT secret

  Run from the repository folder:   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
. "$Root\scripts\common.ps1"

Write-Step "Checking tools"
$java = Find-Java
if (-not $java) {
    Write-Host "  Java 21 not found - downloading a portable Temurin JDK 21 into .\tools ..."
    New-Item -ItemType Directory -Force "$Root\tools" | Out-Null
    $zip = "$Root\tools\jdk.zip"
    Invoke-WebRequest -UseBasicParsing "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" -OutFile $zip
    Expand-Archive $zip -DestinationPath "$Root\tools" -Force
    Remove-Item $zip
    $java = Find-Java
}
Write-Host "  Java: $java"

$node = Find-Node
if (-not $node) {
    Write-Host "  Node.js not found - downloading portable Node 22 LTS into .\tools ..."
    New-Item -ItemType Directory -Force "$Root\tools" | Out-Null
    $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
    $ver = ($index | Where-Object { $_.version -like "v22.*" -and $_.lts } | Select-Object -First 1).version
    $zip = "$Root\tools\node.zip"
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath "$Root\tools" -Force
    Remove-Item $zip
    $node = Find-Node
}
Write-Host "  Node: $node"

$python = Find-Python
if (-not $python) {
    throw "Python 3.11 or 3.12 is required: install it from https://www.python.org (tick 'Add to PATH') and run setup again."
}
Write-Host "  Python: $python"

Write-Step "Security engine (Python) - first run downloads about 2 GB"
$venvPython = "$Root\security-engine\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    & $python -m venv "$Root\security-engine\.venv"
}
& $venvPython -m pip install --quiet --upgrade pip
& $venvPython -m pip install --quiet torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
& $venvPython -m pip install --quiet -r "$Root\security-engine\requirements.txt"
& $venvPython -m spacy download en_core_web_sm --quiet
Write-Host "  Downloading the ML models (once)..."
& $venvPython -c "from sentence_transformers import SentenceTransformer; from transformers import pipeline; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'); pipeline('text-classification', model='protectai/deberta-v3-base-prompt-injection-v2'); print('  models ready')"

Write-Step "Frontend packages"
if (Test-Path "$Root\frontend\node_modules\vite") {
    Write-Host "  Already installed"
} else {
    Push-Location "$Root\frontend"
    try {
        & $node (Join-Path (Split-Path $node) "node_modules\npm\bin\npm-cli.js") ci --no-audit --no-fund
    } finally {
        Pop-Location
    }
}

Write-Step "Backend (Maven downloads dependencies on first build)"
$env:JAVA_HOME = Split-Path (Split-Path $java)
Push-Location $Root
try {
    & "$Root\mvnw.cmd" -q -DskipTests compile
} finally {
    Pop-Location
}

Write-Step "Configuration (.env)"
if (-not (Test-Path "$Root\.env")) {
    Copy-Item "$Root\.env.example" "$Root\.env"
}
$envText = Get-Content "$Root\.env" -Raw
if ($envText -notmatch "(?m)^JWT_SECRET=\S+") {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    if ($envText -match "(?m)^JWT_SECRET=") {
        $envText = $envText -replace "(?m)^JWT_SECRET=.*$", "JWT_SECRET=$secret"
    } else {
        $envText = $envText.TrimEnd() + "`r`nJWT_SECRET=$secret`r`n"
    }
    Set-Content "$Root\.env" $envText -Encoding ascii -NoNewline
    Write-Host "  Generated a random JWT secret in .env"
}
if ($envText -notmatch "(?m)^GEMINI_API_KEY=\S+") {
    Write-Host "  Optional: paste your Gemini API key into .env (GEMINI_API_KEY=...) to get AI answers."
}

Write-Step "Done. Start everything with:  powershell -ExecutionPolicy Bypass -File .\start.ps1"
