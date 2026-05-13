# PASS199 — Admin Console Profiles v2

PASS199 turns the existing Admin Console Profiles catalog into richer enterprise profile launchers while preserving the local-only browser boundary.

## Changed

- Added `src/shared/admin-console-profiles-v2-contract.ts`.
- Added v2 provider intent, mission layout defaults, pane defaults, local-only guardrails, and operator diagnostics.
- Rewired Admin Console launch recipes through the v2 mapping while preserving the PASS155 profile IDs.
- Added PASS199 renderer dataset attributes for Ops Panel and Mission Control cards.
- Added Command Center labeling for Admin Console Profile and Admin Console Mission Profile entries.
- Added `scripts/verify-pass-199-admin-console-profiles-v2.mjs`.
- Added `verify:pass-199-admin-console-profiles-v2` to `package.json` and the release-blocker chain after PASS198.

## Guardrails preserved

- Browser-side/local-only profile launchers only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No provider API automation.
- No secrets, tokens, cookies, or credentials added to source, mission state, or profile contracts.

## Verification

- `npm run verify:pass-199-admin-console-profiles-v2`
- `npm run verify:pass-198-mission-recipe-library-v2`
- `npm run verify:pass-197-mission-layout-determinism`

Remaining enterprise hardening passes after PASS199: 26
