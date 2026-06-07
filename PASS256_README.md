# PASS256 — Quad View State Machine

Version target: **2.0.5**

This cumulative patch builds on PASS250–PASS255 and adds a deterministic Mission View state-machine contract for 1-Up, 2-Up, 3-Up variants, Quad, Focus, and restore.

## What changed

- Adds `scripts/apply-pass256-quad-view-state-machine.mjs`.
- Adds `scripts/verify-pass256-quad-view-state-machine.mjs`.
- Adds renderer-side PASS256 state-machine source block after PASS255 hydration.
- Adds CSS health/containment attributes for PASS256 pane visibility, active pane, geometry, and placeholder behavior.
- Updates package truth to **2.0.5** when applied.
- Keeps Microsoft Store submission blocked until installed Recipe + Quad/Tri/Split smoke confirms no blank panes, bottom-only rendering, orphaned active pane state, or layout switching failures.

## Apply

```powershell
Set-Location C:\dev\browser\app

New-Item -ItemType Directory -Force C:\Users\justi\Downloads\TAHAI-browser-artifacts | Out-Null
Get-ChildItem -Path . -File |
  Where-Object { $_.Name -match '\.(zip|msix|msixupload|msi|exe|pfx|cer)$' } |
  Move-Item -Destination C:\Users\justi\Downloads\TAHAI-browser-artifacts -Force

Expand-Archive -Force C:\Users\justi\Downloads\TAHAI-browser-pass256-quad-view-state-machine-cumulative-patch-20260514.zip .

node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\apply-pass251-mission-multiview-final-polish.mjs
node scripts\apply-pass252-mission-multiview-state-hardening.mjs
node scripts\apply-pass253-mission-pane-viewport-hardening.mjs
node scripts\apply-pass254-mission-recipe-click-contract.mjs
node scripts\apply-pass255-recipe-pane-hydration.mjs
node scripts\apply-pass256-quad-view-state-machine.mjs

npm run verify:pass-250-store-submission-evidence-identity-prep
npm run verify:pass-251-mission-multiview-final-polish
npm run verify:pass-252-mission-multiview-state-hardening
npm run verify:pass-253-mission-pane-viewport-hardening
npm run verify:pass-254-mission-recipe-click-contract
npm run verify:pass-255-recipe-pane-hydration
npm run verify:pass-256-quad-view-state-machine
```

## PASS256 acceptance covered

- State-machine phases: preflight, commit, render, geometry settle, post-assert, recover, rollback.
- Static verifier stress model covers 50 cycles of: 1 → 2 → 3-top → 3-bottom → 3-left → 3-right → 4 → focus → 4 → 1.
- Active pane is repaired if hidden.
- Runtime tab mappings are recreated if orphaned.
- Blank pane URLs are repaired with local-safe browser defaults.
- Empty visible panes get a useful placeholder instead of a dead black pane.

## Next pass

PASS257 — Mission Pane Geometry Engine.
