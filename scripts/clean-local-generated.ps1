$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")
Set-Location $AppRoot

$Targets = @(
  "dist",
  "release",
  "out",
  "build-output",
  "artifacts",
  "coverage",
  "npm-debug.log"
)

foreach ($Target in $Targets) {
  $Path = Join-Path $AppRoot $Target
  if (Test-Path $Path) {
    Remove-Item $Path -Recurse -Force -ErrorAction Stop
  }
}

Write-Host "TAHAI_BROWSER_CLEAN_GENERATED=OK"
