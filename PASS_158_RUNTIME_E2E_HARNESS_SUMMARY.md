# PASS158 — Runtime E2E Harness Summary

PASS158 adds the first source-tracked runtime E2E harness for the enterprise DevOps and IT Admin browser lane.

## Added

- `src/shared/runtime-e2e-harness-contract.ts`
- `scripts/run-pass-158-runtime-e2e-harness.mjs`
- `scripts/verify-pass-158-runtime-e2e-harness.mjs`
- `docs/runtime-e2e-harness-pass158.md`
- Stable runtime selectors for titlebar drag, tabs, Guide/KB, Mission Control, and webview stage surfaces.
- Launch-shell viewport proof now includes guest document-bottom alignment, so a 150px native guest viewport fails closed.
- Runtime clicks now fail closed when a visible shell control does not own its hit target.
- Browser Kit tab pinning/cycling plus representative DevOps, IT, and Ops Panel action-card clicks are covered by the live harness.
- Trusted shell runtime hook: `window.__TAHAI_RUNTIME_E2E__.run()`.
- Main-process opt-in execution through `TAHAI_RUNTIME_E2E=1`.

## Verification

- `verify:pass-158-runtime-e2e-harness`
- `test:runtime-e2e:plan`
- `test:runtime-e2e` after `npm run build` on a GUI-capable desktop session.

PASS158 runs after PASS157 and before final build inside `verify:release-blockers`.

Remaining enterprise GA passes: 4.
