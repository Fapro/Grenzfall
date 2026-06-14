param(
    [int]$Port = 3001,
    [ValidateSet('dev', 'start')]
    [string]$Script = 'dev'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PortProcessIds {
    param([int]$LocalPort)

    $result = @()

    try {
        $result = Get-NetTCPConnection -LocalPort $LocalPort -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique
    } catch {
        # Fallback fuer Umgebungen ohne Get-NetTCPConnection.
        $result = netstat -ano | Select-String ":$LocalPort" | ForEach-Object {
            $parts = ($_ -split '\s+') | Where-Object { $_ -ne '' }
            if ($parts.Length -ge 5) { $parts[-1] }
        } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ } | Sort-Object -Unique
    }

    return @($result | Where-Object { $_ -gt 0 })
}

Write-Host "Suche Prozesse auf Port $Port..."
$pids = @(Get-PortProcessIds -LocalPort $Port)

if ($pids.Count -eq 0) {
    Write-Host "Keine Prozesse auf Port $Port gefunden."
} else {
    foreach ($procId in $pids) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "Beende PID $procId ($($proc.ProcessName)) auf Port $Port..."
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Host "Konnte PID $procId nicht beenden: $($_.Exception.Message)"
        }
    }
}

Push-Location $PSScriptRoot
try {
    $env:PORT = "$Port"
    Write-Host "Starte Backend mit 'npm run $Script' auf Port $Port..."
    npm run $Script
} finally {
    Pop-Location
}
