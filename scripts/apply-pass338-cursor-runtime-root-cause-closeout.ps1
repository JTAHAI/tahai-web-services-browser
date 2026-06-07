# PASS338 - Cursor Runtime Root-Cause Remediation Closeout
# ASCII-safe compatibility wrapper.
# The PASS338 ZIP carries direct source files. Expanding the ZIP at repo root applies
# the source changes. This script only verifies that the expanded source contains
# the expected PASS338 markers and then runs the PASS338 verifier when available.

$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$RequiredFiles = @(
  "src\renderer\app.ts",
  "src\renderer\styles\browser.css",
  "src\main\main.ts",
  "scripts\verify-pass-338-cursor-runtime-root-cause-closeout.mjs",
  "package.json"
)

foreach ($Rel in $RequiredFiles) {
  $Full = Join-Path $Root $Rel
  if (-not (Test-Path $Full)) {
    throw "PASS338 required file missing: $Rel"
  }
}

$App = Get-Content -Raw -Path (Join-Path $Root "src\renderer\app.ts")
$Css = Get-Content -Raw -Path (Join-Path $Root "src\renderer\styles\browser.css")
$Pkg = Get-Content -Raw -Path (Join-Path $Root "package.json")

if ($App.IndexOf("TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR") -lt 0) {
  throw "PASS338 source not applied: PASS271_R4 env gate is missing."
}
if ($App.IndexOf("PASS338_NORMAL_WEBVIEW_REPAIR_OFF") -lt 0) {
  throw "PASS338 source not applied: PASS271_R4 fail-closed marker is missing."
}
if ($App.IndexOf("TAHAI_BROWSER_ENABLE_PASS271_R9_WHITE_SCREEN_CLOSEOUT_DATASET") -lt 0) {
  throw "PASS338 source not applied: PASS271_R9 dataset gate is missing."
}
if ($Css.IndexOf("PASS338_CURSOR_RUNTIME_ROOT_CAUSE_CLOSEOUT") -lt 0) {
  throw "PASS338 source not applied: loaded CSS contract is missing."
}
if ($Pkg.IndexOf("verify:pass-338-cursor-runtime-root-cause-closeout") -lt 0) {
  throw "PASS338 source not applied: package.json verify script is missing."
}

Write-Host "PASS338_SOURCE_MARKERS=PASS"

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
  node .\scripts\verify-pass-338-cursor-runtime-root-cause-closeout.mjs
} else {
  Write-Host "PASS338_VERIFY_SKIPPED=node-not-found"
}
