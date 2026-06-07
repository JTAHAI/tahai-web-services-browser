# PASS255 — Recipe-to-Pane Hydration Hardening

Version target: **2.0.4**

This cumulative patch builds on PASS250–PASS254 and hardens Mission Recipe launches so recipes populate visible Mission panes instead of producing blank/orphaned Quad/Tri/Split workspaces.

## Apply

```powershell
Set-Location C:\dev\browser\app

New-Item -ItemType Directory -Force C:\Users\justi\Downloads\TAHAI-browser-artifacts | Out-Null
Get-ChildItem -Path . -File |
  Where-Object { $_.Name -match '\.(zip|msix|msixupload|msi|exe|pfx|cer)$' } |
  Move-Item -Destination C:\Users\justi\Downloads\TAHAI-browser-artifacts -Force

Expand-Archive -Force C:\Users\justi\Downloads\TAHAI-browser-pass255-recipe-pane-hydration-cumulative-patch-20260514.zip .

node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\apply-pass251-mission-multiview-final-polish.mjs
node scripts\apply-pass252-mission-multiview-state-hardening.mjs
node scripts\apply-pass253-mission-pane-viewport-hardening.mjs
node scripts\apply-pass254-mission-recipe-click-contract.mjs
node scripts\apply-pass255-recipe-pane-hydration.mjs

npm run verify:pass-250-store-submission-evidence-identity-prep
npm run verify:pass-251-mission-multiview-final-polish
npm run verify:pass-252-mission-multiview-state-hardening
npm run verify:pass-253-mission-pane-viewport-hardening
npm run verify:pass-254-mission-recipe-click-contract
npm run verify:pass-255-recipe-pane-hydration
```

## Next pass

PASS256 — Quad View State Machine.
