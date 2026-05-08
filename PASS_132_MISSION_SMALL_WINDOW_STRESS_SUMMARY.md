# PASS132 — Mission Control Small-Window Stress Summary

Version: 1.8.30 unchanged.

PASS132 hardens Mission Control for small-width and short-height browser windows.

## Source changes

- Added compact Mission section jumpbar in `src/renderer/index.html`.
- Added PASS132 viewport state detection and jump handling in `src/renderer/app.ts`.
- Added compact/micro Mission Control CSS rules in `src/renderer/styles/mission-control.css`.
- Added `scripts/verify-pass-132-mission-small-window-stress.mjs`.
- Wired `verify:pass-132-mission-small-window-stress` into `verify:release-blockers`.

## Guardrails

- Browser-side only.
- No IT Docs backend work.
- No PSA connector work.
- No secrets, generated release artifacts, runtime browser profiles, or installer outputs.
