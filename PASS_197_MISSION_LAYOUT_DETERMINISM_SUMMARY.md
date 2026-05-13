# PASS197 — Mission Layout Determinism

Implemented after PASS196 Mission Control IA rebuild.

## Purpose

Make Mission layout changes deterministic across 1-Up, 2-Up, Tri-view variants, Quad View, Focus Pane, and restore so Mission Control cannot look correct while silently losing pane role, URL, title, runtime tab, active focus, or history targeting truth.

## Source changes

- Added `src/shared/mission-layout-determinism-contract.ts`.
- Added PASS197 renderer snapshots for layout type, active pane, visible pane IDs, restore layout, pane role, pane URL, pane title, runtime tab ID, and webview history state.
- Instrumented layout render, layout set, active pane change, Focus Pane enter, and Focus Pane restore paths.
- Added `docs/pass-197-mission-layout-determinism.md`.
- Added `scripts/verify-pass-197-mission-layout-determinism.mjs`.
- Added `verify:pass-197-mission-layout-determinism` to `package.json` and release-blockers after PASS196.

## Verification

- Static verifier: `npm run verify:pass-197-mission-layout-determinism`
- Version: 1.8.30 unchanged.

## Remaining enterprise hardening passes after PASS197: 28
