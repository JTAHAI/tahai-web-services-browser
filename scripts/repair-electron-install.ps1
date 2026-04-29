<#
.SYNOPSIS
  Repairs the local Electron package when npm build succeeds but npm run dev fails with:
  "Electron failed to install correctly, please delete node_modules/electron and try installing again".

.DESCRIPTION
  This is a local developer-machine repair only. It does not change source files, package-lock.json,
  app runtime behavior, or release artifacts. It removes the broken Electron package folder and reinstalls
  dependencies from the lockfile so Electron's postinstall downloads the correct binary.
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [switch]$SkipDevAfterRepair
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_START=1'
Write-Host ("TAHAI_BROWSER_ELECTRON_REPAIR_REPO={0}" -f (Get-Location).Path)

if (-not (Test-Path '.\package.json')) {
  throw 'package.json not found. Run from C:\dev\browser\app or pass -RepoRoot C:\dev\browser\app.'
}

if (Test-Path '.\node_modules\electron') {
  Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_REMOVE_BROKEN_ELECTRON=1'
  Remove-Item '.\node_modules\electron' -Recurse -Force
}

# Remove Electron cache metadata only when present; keep the broader npm cache intact.
$electronCacheRoots = @(
  Join-Path $env:LOCALAPPDATA 'electron',
  Join-Path $env:LOCALAPPDATA 'electron-builder\cache\electron'
)
foreach ($cacheRoot in $electronCacheRoots) {
  if ($cacheRoot -and (Test-Path $cacheRoot)) {
    Write-Host ("TAHAI_BROWSER_ELECTRON_REPAIR_CLEAR_CACHE={0}" -f $cacheRoot)
    Remove-Item $cacheRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_NPM_CI=1'
npm ci

Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_BUILD=1'
npm run build

Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_RELEASE_BLOCKERS=1'
npm run verify:release-blockers

if (-not $SkipDevAfterRepair) {
  Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_DEV=1'
  npm run dev
}

Write-Host 'TAHAI_BROWSER_ELECTRON_REPAIR_OK=1'
