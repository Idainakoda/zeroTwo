<#
  Sends the demo prompt set through the running gateway (needs start.ps1 running).
    powershell -ExecutionPolicy Bypass -File .\scripts\send-demo-prompts.ps1
#>
param([string]$Backend = "http://localhost:8080")
$Root = Split-Path $PSScriptRoot
$python = "$Root\security-engine\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Run setup.ps1 first (the engine's Python environment is needed)." }
& $python "$Root\scripts\send_demo_prompts.py" $Backend
