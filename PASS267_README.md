# PASS267 — Installed Mission Control Brutal Runtime Harness

Target version: `2.0.14`

Remaining release-confidence hardening passes after this pass: **4**.

Run after overlay:

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass267-installed-mission-control-brutal-runtime-harness.mjs
npm run verify:pass-267-installed-mission-control-brutal-runtime-harness
```

This pass repairs the PASS255/PASS259/PASS260/PASS264 source-verification blockers discovered during the PASS266 local run and adds the fail-closed installed Mission Control runtime evidence harness.

Store posture remains: **not-submitted, not-approved, no GA claim**.
