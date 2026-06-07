# PASS251 — Mission Multi-View Final Polish

Repo-shaped overlay for TAHAI Web Services Browser 2.0.0.

## Apply

```powershell
Set-Location C:\dev\browser\app
Expand-Archive -Force .\TAHAI-browser-pass251-mission-multiview-final-polish-cumulative-patch-20260513.zip .
node scripts\apply-pass251-mission-multiview-final-polish.mjs
npm run verify:pass-251-mission-multiview-final-polish
```

## What it changes

- Adds a source-side Mission Control CSS hardening block to the existing renderer stylesheet selected by the apply script.
- Adds a PASS251 verifier and package script.
- Keeps Store submission blocked until installed Windows smoke is repeated.

## Important

The uploaded PASS250 ZIP contained Store-readiness docs/scripts, not the full app source tree. PASS251 is therefore delivered as an apply-script overlay that patches your actual local repo at `C:\dev\browser\app`.
