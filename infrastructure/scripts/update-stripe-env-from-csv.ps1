param(
  [string]$PricesCsvPath = "",
  [string]$ProductsCsvPath = "",
  [string]$EnvPath = ".env",
  [string]$PublicWebUrl = "https://worksidehomeadvisor.netlify.app",
  [string]$CloudRunService = "workside-api",
  [string]$CloudRunRegion = "us-central1",
  [switch]$PrintCloudRunCommand
)

$ErrorActionPreference = 'Stop'

function Normalize-Url {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "PublicWebUrl is required."
  }

  return $Value.TrimEnd('/')
}

function Resolve-LatestCsvPath {
  param(
    [string]$PreferredPath,
    [string]$Pattern
  )

  if (-not [string]::IsNullOrWhiteSpace($PreferredPath)) {
    if (-not (Test-Path -LiteralPath $PreferredPath)) {
      throw "CSV file not found: $PreferredPath"
    }

    return $PreferredPath
  }

  $downloadsPath = Join-Path $HOME 'Downloads'
  $match = Get-ChildItem -LiteralPath $downloadsPath -Filter $Pattern -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $match) {
    throw "Could not find a file matching '$Pattern' in $downloadsPath"
  }

  return $match.FullName
}

function Set-Or-AppendEnvVar {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $lines = @()
  if (Test-Path -LiteralPath $Path) {
    $lines = Get-Content -LiteralPath $Path
  }

  $pattern = "^{0}=" -f [regex]::Escape($Key)
  $replacement = "{0}={1}" -f $Key, $Value
  $updated = $false

  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index] -match $pattern) {
      $lines[$index] = $replacement
      $updated = $true
    }
  }

  if (-not $updated) {
    $lines += $replacement
  }

  Set-Content -LiteralPath $Path -Value $lines
}

function Get-RequiredCsvRow {
  param(
    [object[]]$Rows,
    [string]$Column,
    [string[]]$ExpectedValues
  )

  foreach ($expectedValue in $ExpectedValues) {
    $row = $Rows | Where-Object { $_.$Column -eq $expectedValue } | Select-Object -First 1
    if ($row) {
      return $row
    }
  }

  $joinedValues = $ExpectedValues -join "', '"
  if (-not $row) {
    throw "Could not find any of '$joinedValues' in column '$Column'."
  }
}

$PricesCsvPath = Resolve-LatestCsvPath -PreferredPath $PricesCsvPath -Pattern 'prices*.csv'
$ProductsCsvPath = Resolve-LatestCsvPath -PreferredPath $ProductsCsvPath -Pattern 'products*.csv'

$normalizedWebUrl = Normalize-Url -Value $PublicWebUrl
$prices = Import-Csv -LiteralPath $PricesCsvPath
$products = Import-Csv -LiteralPath $ProductsCsvPath

$requiredProducts = @(
  'Seller Unlock',
  'Seller Pro',
  'Agent Starter',
  'Agent Pro',
  'Agent Team',
  'Sample Onboarding Fee',
  'Sample Monthly Fee'
)

foreach ($name in $requiredProducts) {
  $aliases = @($name)
  if ($name -eq 'Sample Onboarding Fee') {
    $aliases += 'Sample Onboarding'
  }
  if ($name -eq 'Sample Monthly Fee') {
    $aliases += 'Sample Monthly'
  }

  $null = Get-RequiredCsvRow -Rows $products -Column 'Name' -ExpectedValues $aliases
}

$envUpdates = [ordered]@{
  STRIPE_BILLING_SUCCESS_URL    = "$normalizedWebUrl/dashboard?billing=success"
  STRIPE_BILLING_CANCEL_URL     = "$normalizedWebUrl/dashboard?billing=cancelled"
  STRIPE_PRICE_ID_SELLER_UNLOCK = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Seller Unlock')).'Price ID'
  STRIPE_PRICE_ID_SELLER_PRO    = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Seller Pro')).'Price ID'
  STRIPE_PRICE_ID_AGENT_STARTER = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Agent Starter')).'Price ID'
  STRIPE_PRICE_ID_AGENT_PRO     = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Agent Pro')).'Price ID'
  STRIPE_PRICE_ID_AGENT_TEAM    = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Agent Team')).'Price ID'
  STRIPE_PRICE_ID_SAMPLE_ONBOARDING = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Sample Onboarding Fee', 'Sample Onboarding')).'Price ID'
  STRIPE_PRICE_ID_SAMPLE_MONTHLY    = (Get-RequiredCsvRow -Rows $prices -Column 'Product Name' -ExpectedValues @('Sample Monthly Fee', 'Sample Monthly')).'Price ID'
}

foreach ($entry in $envUpdates.GetEnumerator()) {
  Set-Or-AppendEnvVar -Path $EnvPath -Key $entry.Key -Value $entry.Value
}

Write-Host "Updated Stripe billing env vars in $EnvPath" -ForegroundColor Green
Write-Host "Using prices export: $PricesCsvPath" -ForegroundColor DarkGray
Write-Host "Using products export: $ProductsCsvPath" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Applied values:" -ForegroundColor Cyan
foreach ($entry in $envUpdates.GetEnumerator()) {
  Write-Host ("- {0}={1}" -f $entry.Key, $entry.Value)
}

if ($PrintCloudRunCommand) {
  $cloudRunVars = ($envUpdates.GetEnumerator() | ForEach-Object {
      "{0}={1}" -f $_.Key, $_.Value
    }) -join ','

  Write-Host ""
  Write-Host "Cloud Run update command:" -ForegroundColor Yellow
  Write-Host "gcloud run services update $CloudRunService ``"
  Write-Host "  --region $CloudRunRegion ``"
  Write-Host "  --update-env-vars `"$cloudRunVars`""
}
