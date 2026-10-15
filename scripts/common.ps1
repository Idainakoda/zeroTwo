# Shared helpers for setup.ps1 and start.ps1 (Windows PowerShell 5.1 compatible).

# mvnw.cmd calls "powershell" by name; make sure it resolves even with a trimmed PATH.
if (($env:Path -split ";") -notcontains $PSHOME) { $env:Path = "$PSHOME;$env:Path" }

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

# Looks in .\tools, ..\tools, then PATH / JAVA_HOME.
function Find-Java {
    foreach ($dir in @("$Root\tools", "$Root\..\tools")) {
        $hit = Get-ChildItem -Path $dir -Filter "jdk-21*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit -and (Test-Path "$($hit.FullName)\bin\java.exe")) { return "$($hit.FullName)\bin\java.exe" }
    }
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { return "$env:JAVA_HOME\bin\java.exe" }
    $cmd = Get-Command java -ErrorAction SilentlyContinue
    if ($cmd) {
        $version = (& $cmd.Source -version 2>&1 | Select-Object -First 1) -as [string]
        if ($version -match '"(\d+)') { if ([int]$Matches[1] -ge 21) { return $cmd.Source } }
    }
    return $null
}

function Find-Node {
    foreach ($dir in @("$Root\tools", "$Root\..\tools")) {
        $hit = Get-ChildItem -Path $dir -Filter "node-v22*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit -and (Test-Path "$($hit.FullName)\node.exe")) { return "$($hit.FullName)\node.exe" }
    }
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Find-Python {
    foreach ($name in @("python", "py")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -notlike "*WindowsApps*") { return $cmd.Source }
    }
    return $null
}

# Loads KEY=VALUE lines from .env into this process (child windows inherit them).
function Import-DotEnv($path) {
    if (-not (Test-Path $path)) { return }
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if ($value -ne "") { [Environment]::SetEnvironmentVariable($name, $value, "Process") }
        }
    }
}

# This machine's address on the local network (the adapter that has a default gateway).
function Get-LanAddress {
    try {
        $cfg = Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
            Select-Object -First 1
        if ($cfg) { return $cfg.IPv4Address.IPAddress | Select-Object -First 1 }
    } catch {
        # fall through
    }
    return $null
}

# TCP reachability check for another device (host may be a name or an IP).
function Test-Remote($hostName, $port, $timeoutMs = 3000) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($hostName, $port)
        return ($task.Wait($timeoutMs) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-Port($port, $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        # Vite listens on ::1 (IPv6) on Windows, the other services on IPv4: try both.
        foreach ($address in @("127.0.0.1", "::1")) {
            $client = New-Object System.Net.Sockets.TcpClient([System.Net.Sockets.AddressFamily]::InterNetworkV6)
            if ($address -eq "127.0.0.1") {
                $client.Dispose()
                $client = New-Object System.Net.Sockets.TcpClient
            }
            try {
                $client.Connect([System.Net.IPAddress]::Parse($address), $port)
                return $true
            } catch {
                # not listening on this address yet
            } finally {
                $client.Dispose()
            }
        }
        Start-Sleep -Milliseconds 800
    }
    return $false
}
