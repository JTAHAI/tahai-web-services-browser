param(
  [string]$RepoRoot = "C:\dev\browser\app"
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-NoBom {
  param([string]$Path, [string]$Text)
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Text.TrimStart([char]0xFEFF), $Utf8NoBom)
}
function Upsert-NpmScript {
  param([object]$Package, [string]$Name, [string]$Value)
  if (-not $Package.scripts) { $Package | Add-Member -MemberType NoteProperty -Name scripts -Value ([ordered]@{}) }
  if ($Package.scripts.PSObject.Properties.Name -contains $Name) { $Package.scripts.$Name = $Value }
  else { $Package.scripts | Add-Member -MemberType NoteProperty -Name $Name -Value $Value }
}
$PkgPath = ".\package.json"
$Pkg = Get-Content -Raw $PkgPath | ForEach-Object { $_.TrimStart([char]0xFEFF) } | ConvertFrom-Json
Upsert-NpmScript $Pkg "package:linux:rpm" "npm run build && electron-builder --linux rpm --x64 --config electron-builder.yml"
Upsert-NpmScript $Pkg "package:linux:fedora" "npm run verify:fedora-linux-build && npm run build && electron-builder --linux AppImage rpm --x64 --config electron-builder.yml"
Upsert-NpmScript $Pkg "verify:fedora-linux-build" "node scripts/verify-fedora-linux-build.mjs"
if ($Pkg.scripts.'verify:release-blockers' -and $Pkg.scripts.'verify:release-blockers' -notmatch 'verify:fedora-linux-build') {
  $Pkg.scripts.'verify:release-blockers' = $Pkg.scripts.'verify:release-blockers' -replace 'npm run build', 'npm run verify:fedora-linux-build && npm run build'
}
$PkgJson = $Pkg | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText((Resolve-Path $PkgPath), $PkgJson, $Utf8NoBom)
$BuilderPath = ".\electron-builder.yml"
$Builder = Get-Content -Raw $BuilderPath
$Builder = $Builder.TrimStart([char]0xFEFF)
if ($Builder -notmatch '(?m)^\s*-\s*rpm\s*$') {
  $Builder = $Builder -replace '(?m)^(\s*-\s*deb\s*)$', "`$1`r`n    - rpm"
}
Write-NoBom $BuilderPath $Builder
Write-Host "TAHAI_BROWSER_FEDORA_LINUX_QUADVIEW_BUILD_DELTA_APPLIED=1"
Write-Host ""
Write-Host "Next:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run verify:fedora-linux-build"
Write-Host "npm run verify:release-blockers"
Write-Host "npm run package:linux:fedora"
