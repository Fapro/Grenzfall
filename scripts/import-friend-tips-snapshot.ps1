param(
  [Parameter(Mandatory = $true)]
  [string]$SnapshotFile,
  [string]$LocalDbFile = "./backend/.data/multitenant.json",
  [switch]$BackupLocalDb
)

$ErrorActionPreference = "Stop"

function Ensure-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }
}

Ensure-File -Path $SnapshotFile
Ensure-File -Path $LocalDbFile

$snapshot = Get-Content -LiteralPath $SnapshotFile -Raw | ConvertFrom-Json
$db = Get-Content -LiteralPath $LocalDbFile -Raw | ConvertFrom-Json

if (-not $snapshot.tenantSlug) {
  throw "Snapshot has no tenantSlug."
}
if (-not $snapshot.friends) {
  throw "Snapshot has no friends array."
}
if (-not $db.friendsByTenantTeam) {
  $db | Add-Member -MemberType NoteProperty -Name friendsByTenantTeam -Value (@{})
}

$targetTenantId = $null
if ($db.tenants -is [System.Collections.IEnumerable]) {
  foreach ($tenant in $db.tenants) {
    if ([string]$tenant.slug -and [string]$tenant.slug -eq [string]$snapshot.tenantSlug) {
      $targetTenantId = [string]$tenant.id
      break
    }
  }
}

if (-not $targetTenantId) {
  if ($snapshot.tenantId) {
    $targetTenantId = [string]$snapshot.tenantId
  } else {
    throw "Could not resolve target tenant ID in local DB for slug '$($snapshot.tenantSlug)'."
  }
}

$teamScope = if ($snapshot.teamScope) { [string]$snapshot.teamScope } else { "all-matches" }
$key = "$targetTenantId`:$teamScope"

if ($BackupLocalDb) {
  $backupPath = "$LocalDbFile.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $LocalDbFile -Destination $backupPath
  Write-Host "Backup created: $backupPath" -ForegroundColor Yellow
}

$db.friendsByTenantTeam.$key = $snapshot.friends

$json = $db | ConvertTo-Json -Depth 30
Set-Content -LiteralPath $LocalDbFile -Value $json -Encoding UTF8

$tipsCount = 0
foreach ($friend in $snapshot.friends) {
  if ($friend.tips -and $friend.tips.PSObject -and $friend.tips.PSObject.Properties) {
    $tipsCount += @($friend.tips.PSObject.Properties).Count
  }
}

Write-Host "Import complete." -ForegroundColor Green
Write-Host "Target key: $key"
Write-Host "Friends: $(@($snapshot.friends).Count), Tips: $tipsCount"
Write-Host "Local DB: $LocalDbFile"
