param(
    [int]$Port = 3001
)

# Beendet alle Prozesse, die auf dem Ziel-Port lauschen, und startet dann das Backend.
$pids = netstat -ano | Select-String ":$Port" | ForEach-Object {
    $parts = ($_ -split '\s+') | Where-Object { $_ -ne '' }
    if ($parts.Length -ge 5 -and $parts[0] -match 'TCP|UDP') {
        $parts[-1]
    }
} | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique

$pids = $pids | Where-Object { [int]$_ -gt 0 }

foreach ($procId in $pids) {
    try {
        Write-Host "Beende Prozess mit PID $procId auf Port $Port..."
        Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop
    } catch {
        Write-Host "Konnte PID $procId nicht beenden: $($_.Exception.Message)"
    }
}

Write-Host "Starte Backend auf Port $Port..."
Push-Location $PSScriptRoot
try {
    $env:PORT = "$Port"
    npm start
} finally {
    Pop-Location
}
