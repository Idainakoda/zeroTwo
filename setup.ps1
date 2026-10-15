<#
  One-time setup for the ZeroTwo AI security gateway on Windows.
  - Uses Java 21 / Node 22 from PATH, or downloads portable copies into .\tools (no admin rights needed)
  - Creates the Python environment for the security engine and downloads its models
  - Installs the frontend packages
  - Creates .env with a random JWT secret

  Run from the repository folder:   powershell -ExecutionPolicy Bypass -File .\setup.ps1

  On a machine that runs only some services, set START_ENGINE / START_BACKEND / START_FRONTEND
  in .env first (see docs/02_REMOTE_SETUP.md); setup then installs only what that machine needs.
#>
param([string]$EnvFile = "")
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if (-not $EnvFile) { $EnvFile = "$Root\.env" }
# Some terminals start without PowerShell or System32 on PATH; the Maven wrapper needs both.
foreach ($dir in @($PSHOME, "$env:SystemRoot\System32")) {
    if (($env:Path -split ";") -notcontains $dir) { $env:Path = "$dir;$env:Path" }
}
. "$Root\scripts\common.ps1"

if (-not (Test-Path $EnvFile)) {
    Copy-Item "$Root\.env.example" $EnvFile
}
Import-DotEnv $EnvFile

function Flag($name) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    return -not ($value -and $value.Trim().ToLower() -in @("false", "0", "no", "off"))
}
$needEngine = Flag "START_ENGINE"
$needBackend = Flag "START_BACKEND"
$needFrontend = Flag "START_FRONTEND"
Write-Host "Installing for this machine: engine=$needEngine backend=$needBackend frontend=$needFrontend"

Write-Step "Checking tools"
$java = $null
if ($needBackend) {
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
}

$node = $null
if ($needFrontend) {
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
}

if ($needEngine) {
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
}

if ($needFrontend) {
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
}

if ($needBackend) {
    Write-Step "Backend (Maven downloads dependencies on first build)"
    $env:JAVA_HOME = Split-Path (Split-Path $java)
    Push-Location $Root
    try {
        & "$Root\mvnw.cmd" -q -DskipTests compile
    } finally {
        Pop-Location
    }
}

Write-Step "Configuration (.env)"
$envText = Get-Content $EnvFile -Raw
if ($needBackend -and $envText -notmatch "(?m)^JWT_SECRET=\S+") {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    if ($envText -match "(?m)^JWT_SECRET=") {
        $envText = $envText -replace "(?m)^JWT_SECRET=.*$", "JWT_SECRET=$secret"
    } else {
        $envText = $envText.TrimEnd() + "`r`nJWT_SECRET=$secret`r`n"
    }
    Set-Content $EnvFile $envText -Encoding ascii -NoNewline
    Write-Host "  Generated a random JWT secret in .env"
}
if ($envText -notmatch "(?m)^ENGINE_API_KEY=\S+") {
    # Shared secret the backend sends to the engine; the engine refuses requests without it.
    # Two-laptop setup: copy the same value into the other laptop's .env.
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = ([Convert]::ToBase64String($bytes)) -replace '[+/=]', ''
    if ($envText -match "(?m)^ENGINE_API_KEY=") {
        $envText = $envText -replace "(?m)^ENGINE_API_KEY=.*$", "ENGINE_API_KEY=$key"
    } else {
        $envText = $envText.TrimEnd() + "`r`nENGINE_API_KEY=$key`r`n"
    }
    Set-Content $EnvFile $envText -Encoding ascii -NoNewline
    Write-Host "  Generated the engine key (ENGINE_API_KEY) in .env"
}
if ($needBackend -and $envText -notmatch "(?m)^SEED_DEMO_ACCOUNTS=") {
    # Local demo only: creates the four demo accounts shown on the sign-in pages. Set to false elsewhere.
    $envText = $envText.TrimEnd() + "`r`nSEED_DEMO_ACCOUNTS=true`r`n"
    Set-Content $EnvFile $envText -Encoding ascii -NoNewline
    Write-Host "  Demo accounts enabled for this local setup (SEED_DEMO_ACCOUNTS=true in .env)"
}
if ($needBackend -and $envText -notmatch "(?m)^GEMINI_API_KEY=\S+") {
    Write-Host "  Optional: paste your Gemini API key into .env (GEMINI_API_KEY=...) to get AI answers."
}

Write-Step "Done. Start with:  powershell -ExecutionPolicy Bypass -File .\start.ps1"
