# PASS186 — Installed Mouse Navigation Proof Harness

Completed: 2026-05-11
Version remains `2.0.14`.
Remaining enterprise hardening passes after this pass: 39.

## Hardened

- Added a typed installed-app proof contract for Mouse Button 4/5, toolbar Back/Forward, Alt+Left/Alt+Right, menu navigation, address-bar navigation, and active Mission pane routing.
- Added a PowerShell proof runner: `npm run proof:pass-186-installed-mouse-navigation`.
- Added a PASS186 verifier that fails if the proof harness, PASS185 routing tokens, package script exposure, or release-blocker chain drift.
- Preserved the PASS185 source fix while blocking false installed-app claims.

## Verification

- `npm run verify:pass-186-installed-mouse-navigation-proof`
- `npm run verify:pass-185-mouse-history-button-parity`
- `npm run build`

## Installed-app proof rule

The generated proof checklist is evidence scaffolding only. Enterprise readiness still requires the installed Windows app to be tested and every generated proof case to be marked PASS with operator initials.
