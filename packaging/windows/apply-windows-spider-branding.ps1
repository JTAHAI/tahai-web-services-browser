$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
Set-Location $RepoRoot

if (-not (Test-Path ".\apply-windows-spider-branding.ps1")) {
  throw "Root apply-windows-spider-branding.ps1 not found. Extract the full delta zip into the repo root first."
}

powershell -NoProfile -ExecutionPolicy Bypass -File .\apply-windows-spider-branding.ps1
