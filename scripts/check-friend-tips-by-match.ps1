param(
  [string]$BaseUrl = "https://grenzfall.net",
  [string]$TeamScope = "all-matches",
  [string]$TenantSlug = "",
  [string]$LoginIdentifier = "",
  [securestring]$SecurePassword,
  [string]$AuthToken = "",
  [string[]]$Matches = @(
    "France vs Morocco",
    "Spain vs Belgium",
    "Norway vs England",
    "Argentina vs Switzerland"
  )
)

$ErrorActionPreference = "Stop"

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

function Get-PlainPassword([securestring]$PasswordValue) {
  if ($null -eq $PasswordValue) {
    return ""
  }

  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PasswordValue)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Resolve-AuthHeaders {
  param(
    [string]$ApiBase,
    [string]$Slug,
    [string]$Token,
    [string]$Identifier,
    [securestring]$PasswordValue
  )

  $tokenToUse = $Token
  if ([string]::IsNullOrWhiteSpace($tokenToUse)) {
    $identifierToUse = $Identifier
    if ([string]::IsNullOrWhiteSpace($identifierToUse)) {
      $identifierToUse = Read-Required "Login username or email"
    }

    $passwordPlain = Get-PlainPassword -PasswordValue $PasswordValue
    if ([string]::IsNullOrWhiteSpace($passwordPlain)) {
      $passwordPlain = Get-PlainPassword -PasswordValue (Read-Host "Password (input hidden)" -AsSecureString)
    }

    $loginBody = @{
      email    = $identifierToUse
      username = $identifierToUse
      password = $passwordPlain
    } | ConvertTo-Json -Depth 5

    $loginUrl = "$ApiBase/api/auth/login"
    $loginResponse = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType "application/json" -Body $loginBody
    if (-not $loginResponse.token) {
      throw "Login succeeded but no token was returned."
    }
    $tokenToUse = [string]$loginResponse.token
  }

  return @{
    Authorization = "Bearer $tokenToUse"
    "X-Tenant-Slug" = $Slug
  }
}

function Parse-MatchPair([string]$Entry) {
  $parts = $Entry -split '\s+vs\s+', 2
  if ($parts.Count -ne 2) {
    throw "Invalid match format '$Entry'. Use 'Home vs Away'."
  }

  return @{
    Home = $parts[0].Trim()
    Away = $parts[1].Trim()
  }
}

function Find-Fixture([object[]]$Fixtures, [string]$HomeTeamName, [string]$AwayTeamName) {
  $direct = $Fixtures | Where-Object {
    $_.homeTeam.name -eq $HomeTeamName -and $_.awayTeam.name -eq $AwayTeamName
  } | Select-Object -First 1

  if ($null -ne $direct) {
    return $direct
  }

  $reverse = $Fixtures | Where-Object {
    $_.homeTeam.name -eq $AwayTeamName -and $_.awayTeam.name -eq $HomeTeamName
  } | Select-Object -First 1

  return $reverse
}

$tenant = Normalize-TenantSlug -Value $TenantSlug
if ([string]::IsNullOrWhiteSpace($tenant)) {
  $tenant = Normalize-TenantSlug -Value (Read-Required "Tenant slug (workspace slug)")
}

Write-Host "=== Grenzfall Friend Tips Check ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Tenant slug: $tenant"
Write-Host "Team scope: $TeamScope"

$headers = Resolve-AuthHeaders -ApiBase $BaseUrl -Slug $tenant -Token $AuthToken -Identifier $LoginIdentifier -PasswordValue $SecurePassword

$allFixturesUrl = "$BaseUrl/api/fixtures/all"
$friendsUrl = "$BaseUrl/api/friends/$([uri]::EscapeDataString($TeamScope))"

$fixtureResponse = Invoke-RestMethod -Method Get -Uri $allFixturesUrl
$allFixtures = @($fixtureResponse.data)

if ($allFixtures.Count -eq 0) {
  throw "No fixtures received from /api/fixtures/all."
}

$friendsResponse = Invoke-RestMethod -Method Get -Uri $friendsUrl -Headers $headers
$friendRows = @($friendsResponse)

if ($friendRows.Count -eq 0) {
  Write-Host "No friends returned by API for this scope." -ForegroundColor Yellow
}

$results = @()

foreach ($entry in $Matches) {
  $pair = Parse-MatchPair -Entry $entry
  $fixture = Find-Fixture -Fixtures $allFixtures -HomeTeamName $pair.Home -AwayTeamName $pair.Away

  if ($null -eq $fixture) {
    $results += [pscustomobject]@{
      Match = "$($pair.Home) vs $($pair.Away)"
      FixtureId = "NOT_FOUND"
      Result = "-"
      FriendTips = "Match not found in /api/fixtures/all"
    }
    continue
  }

  $fixtureId = [string]$fixture.id
  $tipsForFixture = @()
  foreach ($friend in $friendRows) {
    if ($friend.tips -and $friend.tips.PSObject -and $friend.tips.PSObject.Properties.Name -contains $fixtureId) {
      $tip = $friend.tips.$fixtureId
      $tipsForFixture += [pscustomobject]@{
        Name = [string]$friend.name
        Home = [string]$tip.home
        Away = [string]$tip.away
      }
    }
  }

  if ($tipsForFixture.Count -eq 0) {
    $tipSummary = "Keine Friend-Tipps"
  } else {
    $tipSummary = ($tipsForFixture | ForEach-Object { "$($_.Name): $($_.Home):$($_.Away)" }) -join " | "
  }

  $results += [pscustomobject]@{
    Match = "$($fixture.homeTeam.name) vs $($fixture.awayTeam.name)"
    FixtureId = $fixtureId
    Result = "$($fixture.homeScore) : $($fixture.awayScore)"
    FriendTips = $tipSummary
  }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Green
$results | Format-Table -AutoSize
