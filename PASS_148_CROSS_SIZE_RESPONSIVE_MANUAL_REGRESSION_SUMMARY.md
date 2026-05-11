# PASS148 — Cross-size Responsive Manual Regression Checklist

PASS148 adds the final manual responsive regression checklist and evidence runner before RC freeze.

Version remains `1.8.30`.

## Added

- `src/shared/cross-size-responsive-regression-contract.ts`
- `scripts/run-pass148-cross-size-responsive-regression.mjs`
- `scripts/verify-pass-148-cross-size-responsive-regression.mjs`
- `docs/cross-size-responsive-regression-pass148.md`
- `PASS_148_CROSS_SIZE_RESPONSIVE_MANUAL_REGRESSION_SUMMARY.md`

## Package scripts

- `evidence:cross-size-regression`
- `verify:pass-148-cross-size-responsive-regression`

## Scope

The pass covers installed-app manual regression across:

- 960x640
- 1024x768
- 1366x768
- 1920x1080
- 2560x1440

The checklist covers Guide/KB, More Tools overflow, Mission Control, 2-Up, Tri-view, Quad, Focus Pane, pane movement, active-pane routing, Command Center, Runbook Rail, Evidence export redaction, DevTools, and crash/noise observation.

Generated evidence outputs remain excluded from source under `artifacts/cross-size-responsive-regression/`.

This pass does not claim that manual responsive testing was completed here. It adds the repeatable evidence path for Windows and Linux installed-app RC validation.
