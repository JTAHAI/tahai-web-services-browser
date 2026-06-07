# PASS252 — Mission Multi-View State Hardening + 2.0.x Version Increment

This cumulative repo-shaped patch includes PASS250, PASS251, and PASS252.

PASS252 increments the 2.0.x package version to at least `2.0.1` and hardens Mission multi-view state so repeated switching between 1-Up, 2-Up, 3-Up, Quad, and Focus Pane does not leave the UI stuck in stale transition/hidden/broken pane state.

## Apply

```powershell
Set-Location C:\dev\browser\app
Expand-Archive -Force .\TAHAI-browser-pass252-mission-multiview-state-hardening-cumulative-patch-20260513.zip .

node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\apply-pass251-mission-multiview-final-polish.mjs
node scripts\apply-pass252-mission-multiview-state-hardening.mjs

npm run verify:pass-250-store-submission-evidence-identity-prep
npm run verify:pass-251-mission-multiview-final-polish
npm run verify:pass-252-mission-multiview-state-hardening
```

## Rebuild

```powershell
npm run verify:store:git
npm run package:win:release
npm run package:win:msix
```

## Manual installed-app smoke

Do not submit to Microsoft Store until installed MSI/MSIX visual smoke passes Mission switching across 1/2/3/4/focus at restored, maximized, and ultrawide sizes.
