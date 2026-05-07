# PASS65 — Tri View DOM typing repair

PASS65 repairs the TypeScript strict DOM build error introduced by the PASS64 pane drag handle.

## Fix

- Converts the pane drag handle query from generic `HTMLElement` to `HTMLButtonElement` where present.
- Replaces direct `handle.type = 'button'` assignment with `handle.setAttribute('type', 'button')`.
- Patches the PASS64 apply script so re-running PASS64 cannot reintroduce the same build failure.
- Adds a PASS65 verifier and registers it in `verify:release-blockers` after the first apply.

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts/apply-pass65-triview-tsdom-repair.mjs
npm run verify:pass-65-triview-tsdom-repair
npm run verify:pass-64-triview-repair-hardening
npm run verify:pass-63-triview-pane-reorder
npm run build
```
