# PASS171 — Overlay Focus Epoch Guard

## Fixed

- Delayed focus callbacks now belong to a specific overlay open generation.
- More Tools, Site View, and Ops Hub delayed focus paths reject stale epochs.
- Delayed focus also verifies the matching active overlay source before focusing.
- PASS171 verifier added and wired into release blockers.

## Verification

- npm run verify:pass-171-overlay-focus-epoch-guard
- npm run typecheck
- npm run build
