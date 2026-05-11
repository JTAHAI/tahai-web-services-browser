# PASS166 — Runtime CSS State Alignment Summary

Version remains `1.8.30`.

Remaining enterprise GA passes: 0.

## What changed

- Fixed runtime `data-pass*` body markers so CSS-active responsive hardening flags remain `"true"` instead of being overwritten to `"ready"` or `"initializing"` after renderer initialization.
- Preserved compact-window CSS for More Tools, toolbar density, overlay arbitration, overlay pointer boundaries, scroll containment, viewport reflow, and Mission Control small-window handling.
- Updated verifier assumptions that were accidentally validating the broken `"ready"` runtime value for CSS-active flags.
- Added `verify:pass-166-runtime-css-state-alignment`.

## Why it matters

More Tools and Mission Control were being hardened in code, but some runtime initialization paths could quietly turn off the very CSS selectors responsible for compact-window behavior. PASS166 keeps those CSS contracts active after boot.

## Verification

- `npm run verify:pass-166-runtime-css-state-alignment`
- `npm run verify:pass-115-overflow-visibility-guard`
- `npm run verify:pass-116-overlay-arbitration`
- `npm run verify:pass-117-overlay-focus-recovery`
- `npm run verify:pass-118-overlay-dismiss-recovery`
- `npm run verify:pass-163-more-tools-mission-reflow`
- `npm run verify:pass-164-mission-control-open-race`
- `npm run verify:pass-165-responsive-mission-recipe-hardening`
- `npm run typecheck`
- `npm run build`
