# PASS253 — Mission Pane Viewport Hardening

Purpose: harden Mission multi-view panes so 1-Up, 2-Up, 3-Up, Quad, and Focus views show the website surface inside each visible pane instead of a large black/dead area with only the bottom of the site visible.

Version: bumps the 2.0.x lane to 2.0.2 idempotently.

Apply from repo root:

```powershell
Set-Location C:\dev\browser\app

node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\apply-pass251-mission-multiview-final-polish.mjs
node scripts\apply-pass252-mission-multiview-state-hardening.mjs
node scripts\apply-pass253-mission-pane-viewport-hardening.mjs

npm run verify:pass-250-store-submission-evidence-identity-prep
npm run verify:pass-251-mission-multiview-final-polish
npm run verify:pass-252-mission-multiview-state-hardening
npm run verify:pass-253-mission-pane-viewport-hardening
```

If verification reports generated ZIP/MSI/MSIX/EXE artifacts in the repo root, move them outside `C:\dev\browser\app` and rerun verification.
