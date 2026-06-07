$ErrorActionPreference = "Stop"
$repo = (Get-Location).Path
$verifier = Join-Path $repo "scripts\verify-pass-329-runtime-lifecycle-geometry-sentry.mjs"
if (!(Test-Path $verifier)) {
  throw "Missing verifier after overlay: $verifier"
}
node $verifier
if ($LASTEXITCODE -ne 0) {
  Write-Host "PASS329_ESM_VERIFIER_REPAIR=APPLIED_BUT_RELEASE_BLOCKED"
  exit $LASTEXITCODE
}
Write-Host "PASS329_ESM_VERIFIER_REPAIR=PASS"
