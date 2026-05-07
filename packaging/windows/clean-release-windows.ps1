$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $AppRoot

$ReleaseDir = Join-Path $AppRoot "release"
$DistDir = Join-Path $AppRoot "dist"

if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }

New-Item -ItemType Directory -Path $ReleaseDir | Out-Null
Write-Host "TAHAI_BROWSER_WINDOWS_RELEASE_CLEAN=OK path=$ReleaseDir"
