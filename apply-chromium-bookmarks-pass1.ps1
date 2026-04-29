param(
  [string]$RepoRoot = "C:\dev\browser\app",
  [string]$TargetVersion = ""
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-NoBom {
  param([string]$Path, [string]$Text)
  $Parent = Split-Path -Parent $Path
  if ($Parent) { New-Item -ItemType Directory -Force -Path $Parent | Out-Null }
  [System.IO.File]::WriteAllText((Resolve-Path $Path -ErrorAction SilentlyContinue), $Text.TrimStart([char]0xFEFF), $Utf8NoBom)
}

function Write-NewNoBom {
  param([string]$Path, [string]$Text)
  $Parent = Split-Path -Parent $Path
  if ($Parent) { New-Item -ItemType Directory -Force -Path $Parent | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Path), $Text.TrimStart([char]0xFEFF), $Utf8NoBom)
}

# Source files are already unfolded by Expand-Archive. Normalize encodings.
foreach ($Path in @(
  ".\src\renderer\chromium-bookmarks.ts",
  ".\src\renderer\styles\chromium-bookmarks.css",
  ".\scripts\verify-chromium-bookmarks.mjs",
  ".\docs\chromium-bookmarks-menu.md"
)) {
  if (-not (Test-Path $Path)) { throw "Missing patch file: $Path" }
  $Text = Get-Content -Raw $Path
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Text.TrimStart([char]0xFEFF), $Utf8NoBom)
}

$IndexPath = ".\src\renderer\index.html"
$Index = Get-Content -Raw $IndexPath
$Index = $Index.TrimStart([char]0xFEFF)

if ($Index -notmatch 'chromium-bookmarks\.js') {
  if ($Index -match '<script[^>]+site-view-mission-rail\.js[^>]*>\s*</script>') {
    $Index = $Index -replace '(<script[^>]+site-view-mission-rail\.js[^>]*>\s*</script>)', "`$1`r`n  <script src=`"./chromium-bookmarks.js`"></script>"
  } elseif ($Index -match '<script[^>]+app\.js[^>]*>\s*</script>') {
    $Index = $Index -replace '(<script[^>]+app\.js[^>]*>\s*</script>)', "`$1`r`n  <script src=`"./chromium-bookmarks.js`"></script>"
  } else {
    $Index = $Index -replace '</body>', "  <script src=`"./chromium-bookmarks.js`"></script>`r`n</body>"
  }
  [System.IO.File]::WriteAllText((Resolve-Path $IndexPath), $Index, $Utf8NoBom)
}

$PkgPath = ".\package.json"
$Pkg = Get-Content -Raw $PkgPath | ForEach-Object { $_.TrimStart([char]0xFEFF) } | ConvertFrom-Json

if (-not $Pkg.scripts) {
  $Pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([ordered]@{})
}
if ($Pkg.scripts.PSObject.Properties.Name -contains "verify:chromium-bookmarks") {
  $Pkg.scripts.'verify:chromium-bookmarks' = "node scripts/verify-chromium-bookmarks.mjs"
} else {
  $Pkg.scripts | Add-Member -MemberType NoteProperty -Name "verify:chromium-bookmarks" -Value "node scripts/verify-chromium-bookmarks.mjs"
}
if ($Pkg.scripts.'verify:release-blockers' -and $Pkg.scripts.'verify:release-blockers' -notmatch 'verify:chromium-bookmarks') {
  $Pkg.scripts.'verify:release-blockers' = $Pkg.scripts.'verify:release-blockers' -replace 'npm run build', 'npm run verify:chromium-bookmarks && npm run build'
}
if ($TargetVersion.Trim()) {
  $OldVersion = [string]$Pkg.version
  $Pkg.version = $TargetVersion.Trim()
  $Verifier = ".\scripts\verify-enterprise-release.mjs"
  if (Test-Path $Verifier) {
    $ReleaseVerifier = Get-Content -Raw $Verifier
    $ReleaseVerifier = $ReleaseVerifier.TrimStart([char]0xFEFF)
    $ReleaseVerifier = $ReleaseVerifier -replace [regex]::Escape($OldVersion), $Pkg.version
    [System.IO.File]::WriteAllText((Resolve-Path $Verifier), $ReleaseVerifier, $Utf8NoBom)
  }
}

$PkgJson = $Pkg | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText((Resolve-Path $PkgPath), $PkgJson, $Utf8NoBom)

Write-Host "TAHAI_BROWSER_CHROMIUM_BOOKMARKS_PASS1_APPLIED=1"
Write-Host ""
Write-Host "Next local validation:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run verify:chromium-bookmarks"
Write-Host "npm run verify:release-blockers"
