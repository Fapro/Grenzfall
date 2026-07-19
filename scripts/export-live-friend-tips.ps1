param(
  [string]$BaseUrl = "https://grenzfall.net",
  [string]$TeamScope = "all-matches",
  [string]$OutDir = "./exports"
)

$ErrorActionPreference = "Stop"

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Read-Required([string]$Prompt) {
  while ($true) {
    $value = Read-Host $Prompt
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
    Write-Host "Value is required." -ForegroundColor Yellow
  }
}

function Normalize-TenantSlug([string]$Value) {
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return ""
  }

  $trimmed = $raw.Trim()
  $lower = $trimmed.ToLowerInvariant()
  if ($lower.StartsWith("win2026%") -or $lower.StartsWith("wm2026%")) {
    $parts = $trimmed.Split('%', 2)
    if ($parts.Count -eq 2 -and -not [string]::IsNullOrWhiteSpace($parts[1])) {
      return $parts[1].Trim().ToLowerInvariant()
    }
  }

  return $trimmed.ToLowerInvariant()
}

function Get-PlainPassword([securestring]$SecurePassword) {
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Ensure-Directory -Path $OutDir

Write-Host "=== Grenzfall Live Friend Tips Export ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Team scope: $TeamScope"

$tenantSlugInput = Read-Required "Tenant slug (workspace slug)"
$tenantSlug = Normalize-TenantSlug -Value $tenantSlugInput
$loginIdentifier = Read-Required "Login username or email"
$securePassword = Read-Host "Password (input hidden)" -AsSecureString
$password = Get-PlainPassword -SecurePassword $securePassword

$loginBody = @{
  email    = $loginIdentifier
  username = $loginIdentifier
  password = $password
} | ConvertTo-Json -Depth 5

$loginUrl = "$BaseUrl/api/auth/login"
$meUrl = "$BaseUrl/api/auth/me"
$friendsUrl = "$BaseUrl/api/friends/$([uri]::EscapeDataString($TeamScope))"

Write-Host "Logging in..." -ForegroundColor DarkCyan
try {
  $loginResponse = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType "application/json" -Body $loginBody
}
catch {
  $message = $_.Exception.Message
  if ($message -match "\(401\)") {
    throw "Login failed (401). Use your workspace login (for example 'win2026%$tenantSlug' or '<slug>@win2026.local') and the matching workspace password. Do not use a friend display name."
  }
  throw
}

if (-not $loginResponse.token) {
  throw "Login succeeded but no token was returned."
}

$headers = @{
  Authorization = "Bearer $($loginResponse.token)"
  "X-Tenant-Slug" = $tenantSlug
}

Write-Host "Loading profile..." -ForegroundColor DarkCyan
$meResponse = Invoke-RestMethod -Method Get -Uri $meUrl -Headers $headers

$tenantId = $null
if ($meResponse.memberships -is [System.Collections.IEnumerable]) {
  foreach ($member in $meResponse.memberships) {
    $slug = [string]($member.tenant.slug)
    if ($slug.Trim().ToLowerInvariant() -eq $tenantSlug.ToLowerInvariant()) {
      $tenantId = [string]$member.tenant.id
      break
    }
  }
}

if (-not $tenantId) {
  throw "Could not resolve tenant ID for slug '$tenantSlug'."
}

Write-Host "Loading friend tips..." -ForegroundColor DarkCyan
$friendsResponse = Invoke-RestMethod -Method Get -Uri $friendsUrl -Headers $headers
$friendRows = @()
if ($friendsResponse -is [System.Collections.IEnumerable]) {
  $friendRows = @($friendsResponse)
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$snapshotPath = Join-Path $OutDir "friend-tips-snapshot-$tenantSlug-$timestamp.json"
$rawPath = Join-Path $OutDir "friend-tips-raw-$tenantSlug-$timestamp.json"

$snapshot = [ordered]@{
  exportedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  source = $BaseUrl
  tenantSlug = $tenantSlug
  tenantId = $tenantId
  teamScope = $TeamScope
  friends = $friendRows
}

$tipCount = 0
foreach ($friend in $friendRows) {
  if ($friend.tips -and $friend.tips.PSObject -and $friend.tips.PSObject.Properties) {
    $tipCount += @($friend.tips.PSObject.Properties).Count
  }
}

$snapshot | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $snapshotPath -Encoding UTF8
$friendRows | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $rawPath -Encoding UTF8

Write-Host "Export complete." -ForegroundColor Green
Write-Host "Snapshot: $snapshotPath"
Write-Host "Raw list: $rawPath"
Write-Host "Friends: $($friendRows.Count), Tips: $tipCount"
