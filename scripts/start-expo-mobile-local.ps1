param(
    [int]$BackendPort = 3001,
    [ValidateSet('lan', 'tunnel')]
    [string]$Mode = 'lan'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-LanIpv4 {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.IPAddress -ne '0.0.0.0'
        } |
        Select-Object -First 1 -ExpandProperty IPAddress

    if (-not $ip) {
        throw 'Keine passende LAN-IPv4 gefunden. Verbinde den Rechner mit WLAN/LAN und versuche es erneut.'
    }

    return $ip
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$lanIp = Get-LanIpv4
$backendUrl = ('http' + '://' + $lanIp + ':' + $BackendPort)

Set-Item -Path Env:EXPO_PUBLIC_BACKEND_URL -Value $backendUrl
Set-Item -Path Env:EXPO_NO_TELEMETRY -Value '1'

Write-Host "[expo-mobile-local] EXPO_PUBLIC_BACKEND_URL=$backendUrl"
Write-Host "[expo-mobile-local] Starte Expo im Modus '$Mode'..."
Write-Host "[expo-mobile-local] Wichtig: Backend muss auf Port $BackendPort laufen (z. B. in einem zweiten Terminal: cd backend; npm run dev)."

Push-Location $projectRoot
try {
    if ($Mode -eq 'tunnel') {
        npx expo start --tunnel -c
    } else {
        npx expo start --lan -c
    }
} finally {
    Pop-Location
}
