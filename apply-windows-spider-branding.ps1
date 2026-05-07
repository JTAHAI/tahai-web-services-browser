$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

if (-not (Test-Path ".\package.json")) {
  throw "package.json not found. Extract this delta zip directly into C:\dev\browser\app and run this script from that folder."
}

$RequiredAssets = @(
  ".\build\icon.ico",
  ".\build\icon.png",
  ".\assets\brand\tahai-spider-icon.ico",
  ".\assets\brand\tahai-spider-icon.png",
  ".\scripts\patch-windows-spider-branding.mjs"
)

foreach ($Asset in $RequiredAssets) {
  if (-not (Test-Path $Asset)) {
    throw "Missing required branding patch file: $Asset"
  }
}

node .\scripts\patch-windows-spider-branding.mjs

Write-Host ""
Write-Host "TAHAI_BROWSER_WINDOWS_SPIDER_BRANDING_APPLIED=OK"
Write-Host ""
Write-Host "Recommended clean release build:"
Write-Host '  Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue'
Write-Host '  npm run package:win:unpacked-zip'
Write-Host '  npm run package:win:release'
Write-Host ""
Write-Host "If Windows still shows the old Electron icon/name, unpin the old taskbar icon, uninstall the old preview build, install the new one, launch from Start, then pin the running TAHAI icon."
