# PASS266 — Final Version Truth + Store Gate Chain Repair

Target final package version: `2.0.18`

Remaining release-confidence hardening passes after PASS266: **5**.

PASS266 repairs the Store evidence chain so PASS260 through PASS265 prove one installed package version instead of a stale ladder of pass-version targets.

## What this pass repairs

- PASS260 installed Recipe + Quad smoke gate now requires final package version `2.0.18`.
- PASS261 Store submission packet gate now requires final package version `2.0.18`.
- PASS262 Store asset evidence gate now requires final package version `2.0.18`.
- PASS263 Store listing copy truth gate now requires final package version `2.0.18`.
- PASS264 Store dry-run evidence gate now requires final package version `2.0.18`.
- PASS265 handoff freeze gate remains on final package version `2.0.18`.
- PASS260-PASS264 verifiers and templates are aligned to the same final package version.
- A new PASS266 fail-closed version-truth gate blocks release confidence unless the operator records the repair review.

## What this pass does not do

- It does **not** submit to Microsoft Store.
- It does **not** claim Microsoft Store approval.
- It does **not** claim public GA.
- It does **not** claim signed MSI/EXE status.
- It does **not** add IT Docs backend code, PSA connector code, direct PSA API calls, or provider secrets.

## Commands

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass266-final-version-truth-store-gate-chain-repair.mjs
npm run verify:pass-266-final-version-truth-store-gate-chain-repair
npm run gate:pass-266-final-version-truth-store-gate-chain
```

The PASS266 gate expects real evidence at:

`release-candidate/store-submission/pass266-final-version-truth-gate-chain-repair.json`

Use the template at:

`docs/store/pass266-final-version-truth-gate-chain-repair.template.json`

## Next pass

PASS267 — Installed Mission Control Brutal Runtime Harness.
