<#
  Opens the CyberCup ports in Windows Firewall so other devices on the SAME network can connect.
  Run once, as administrator, on the machine that hosts the service:

    powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1            # engine, backend, frontend
    powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1 -MySQL     # also MySQL (3306)

  Rules apply to Private networks and the local subnet only. Make sure your Wi-Fi is set to
  "Private" (Settings > Network & internet > Wi-Fi > your network > Private network).
  Remove later with:  Remove-NetFirewallRule -DisplayName "CyberCup*"
#>
param(
    [switch]$MySQL,
    # Also allow devices connected through Tailscale (100.64.0.0/10), for teammates on other networks
    [switch]$Tailscale,
    [int[]]$Ports = @(8000, 8080, 5173)
)

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from a PowerShell window opened with 'Run as administrator'."
}

$names = @{ 8000 = "security engine"; 8080 = "backend"; 5173 = "frontend"; 3306 = "MySQL" }
if ($MySQL) { $Ports += 3306 }

foreach ($port in ($Ports | Sort-Object -Unique)) {
    $display = "CyberCup $($names[$port]) ($port)"
    Get-NetFirewallRule -DisplayName $display -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $display -Direction Inbound -Protocol TCP -LocalPort $port `
        -Action Allow -Profile Private -RemoteAddress LocalSubnet | Out-Null
    Write-Host "Opened TCP $port for $($names[$port]) (private network, local subnet only)" -ForegroundColor Green
    if ($Tailscale) {
        $tsDisplay = "$display via Tailscale"
        Get-NetFirewallRule -DisplayName $tsDisplay -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -DisplayName $tsDisplay -Direction Inbound -Protocol TCP -LocalPort $port `
            -Action Allow -RemoteAddress "100.64.0.0/10" | Out-Null
        Write-Host "Opened TCP $port for Tailscale devices (100.64.0.0/10)" -ForegroundColor Green
    }
}
