$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $AppRoot

npm run verify:builder-truth
npm run build
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
electron-builder --win msi --x64 --config electron-builder.yml

Write-Host "TAHAI_BROWSER_WINDOWS_MSI_PACKAGE=OK"
