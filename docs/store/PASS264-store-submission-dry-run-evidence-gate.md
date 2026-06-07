# PASS264 — Store Submission Dry-Run Evidence Gate

Target version: `2.0.14`

Remaining passes after PASS264: **1**.

PASS264 adds the no-submit dry-run gate that cross-checks PASS260 installed smoke evidence, PASS261 submission packet truth, PASS262 asset evidence, and PASS263 listing copy truth before the final handoff/freeze pass.

## What this pass adds

- Store submission dry-run evidence template.
- Partner Center no-submit dry-run checklist template.
- Required prior-gate matrix fixture.
- Source verifier: `npm run verify:pass-264-store-submission-dry-run-evidence`.
- Final dry-run gate: `npm run gate:pass-264-store-submission-dry-run-evidence`.

## Store posture

This pass does **not** submit to the Microsoft Store. It does **not** claim Microsoft Store approval, Store certification, public GA, signed MSI/EXE status, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

PASS264 is explicitly a no-submit dry run. The gate should remain blocked unless the report proves every prior Store/evidence gate passed and the Partner Center review was completed without clicking final submit.

## Required final evidence path

`release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json`

## Commands

```powershell
Set-Location C:dev\\browserapp
node scripts\\apply-pass264-store-submission-dry-run-evidence-gate.mjs
npm run verify:pass-264-store-submission-dry-run-evidence
```

Optional hard gate when real dry-run evidence exists:

```powershell
npm run gate:pass-264-store-submission-dry-run-evidence
```

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
