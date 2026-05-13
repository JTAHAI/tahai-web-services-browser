# PASS198 — Mission Recipe Library v2

PASS198 upgrades Mission Recipe Library v1 into serious enterprise operator templates.

## Changed

- Added `src/shared/mission-recipe-library-v2-contract.ts`.
- Added v2 coverage for all ten canonical Mission Recipe Library entries.
- Added risk tiers, preflight gates, pane intents, evidence checklists, recovery actions, handoff sections, export profiles, and policy locks.
- Wired v2 recipe truth into Ops Panel and Mission Control recipe cards.
- Added `data-pass198-*` runtime metadata so v2 coverage can be verified without fragile visual scraping.
- Added `scripts/verify-pass-198-mission-recipe-library-v2.mjs`.
- Added docs at `docs/pass-198-mission-recipe-library-v2.md`.
- Added release-blocker wiring for PASS198 after PASS197.

## Verification

- `npm run verify:pass-198-mission-recipe-library-v2`
- `npm run verify:pass-197-mission-layout-determinism`

## Boundary

Browser-side only. No IT Docs backend work. No PSA connector work. No provider credentials. No direct PSA API calls. No automatic ticket/vendor writeback. Version remains `1.8.30`.

Remaining enterprise hardening passes after PASS198: 27
