# PASS258 — Recipe + Quad Runtime E2E Harness

Version target: 2.0.7

PASS258 adds a browser-side runtime contract harness for the flagship recipe + Quad View path.

## Acceptance covered

- Adds fixtures for the flagship recipes:
  - DNS Migration
  - Cloudflare Cutover
  - GitHub Actions Release
  - Production Deployment
  - Certificate Renewal
  - M365 User Offboarding
  - Incident Triage
  - Vendor Support Handoff
- Models click card → select recipe → start mission.
- Verifies mission fields, runbook, evidence prompts, timeline recipe-start event, pane count, runtime tab hydration, all layout switches, and export preview.
- Fails if unsafe URL protocols, secret-like query strings, direct PSA/API fetches, generated artifacts, or missing prior PASS254-PASS257 runtime markers are detected.

## Verify

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass258-recipe-quad-runtime-e2e-harness.mjs
npm run verify:pass-258-recipe-quad-runtime-contract
```

## Store posture

Microsoft Store submission remains blocked until installed Windows smoke proves this same recipe + Quad path in the packaged app.
