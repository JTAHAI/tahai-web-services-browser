param(
  [string]$RepoRoot = "C:\dev\browser\app"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoRoot)) {
  throw "Repo root not found: $RepoRoot"
}

$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Copy-DeltaFile {
  param([string]$RelativePath)
  $Source = Join-Path $SourceRoot $RelativePath
  $Destination = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path $Source)) {
    throw "Missing delta file: $Source"
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  $ResolvedSource = (Resolve-Path -LiteralPath $Source).Path
  $ResolvedDestination = $null
  if (Test-Path $Destination) {
    $ResolvedDestination = (Resolve-Path -LiteralPath $Destination).Path
  }
  if ($ResolvedDestination -and $ResolvedSource -eq $ResolvedDestination) {
    return
  }
  Copy-Item -Force $Source $Destination
}

Copy-DeltaFile "src\renderer\site-view-mission-rail.ts"
Copy-DeltaFile "src\renderer\styles\site-view-mission-rail.css"
Copy-DeltaFile "scripts\verify-site-view-mission-rail.mjs"
Copy-DeltaFile "docs\site-view-mission-rail.md"

$IndexPath = ".\src\renderer\index.html"
$Index = Get-Content -Raw $IndexPath
if ($Index -notmatch 'site-view-mission-rail\.js') {
  if ($Index -match '<script[^>]+app\.js[^>]*>\s*</script>') {
    $Index = $Index -replace '(<script[^>]+app\.js[^>]*>\s*</script>)', "`$1`r`n  <script src=`"./site-view-mission-rail.js`"></script>"
  } else {
    $Index = $Index -replace '</body>', "  <script src=`"./site-view-mission-rail.js`"></script>`r`n</body>"
  }
  Set-Content -Encoding UTF8 $IndexPath $Index
}

$PackagePath = ".\package.json"
$Package = Get-Content -Raw $PackagePath | ConvertFrom-Json
if (-not $Package.scripts.PSObject.Properties.Name.Contains('verify:site-view-rail')) {
  $Package.scripts | Add-Member -MemberType NoteProperty -Name 'verify:site-view-rail' -Value 'node scripts/verify-site-view-mission-rail.mjs'
}
$currentReleaseBlockers = [string]$Package.scripts.'verify:release-blockers'
if ($currentReleaseBlockers -and $currentReleaseBlockers -notmatch 'verify:site-view-rail') {
  $Package.scripts.'verify:release-blockers' = $currentReleaseBlockers -replace 'npm run verify:mission-tabs-security', 'npm run verify:mission-tabs-security && npm run verify:site-view-rail'
}
$Package | ConvertTo-Json -Depth 100 | Set-Content -Encoding UTF8 $PackagePath

Write-Host "SITE_VIEW_MISSION_RAIL_PASS3_APPLIED=1"
Write-Host "Next local validation:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run verify:site-view-rail"
Write-Host "npm run verify:release-blockers"
