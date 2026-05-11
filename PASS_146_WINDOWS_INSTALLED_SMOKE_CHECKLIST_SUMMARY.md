# PASS146 — Windows Installed-App Smoke Checklist + Evidence Runner Summary

PASS146 adds the Windows installed-app QA handoff lane for TAHAI Web Services Browser.

Version remains `1.8.30`.

## Added

- `src/shared/windows-installed-smoke-contract.ts`
- `scripts/run-pass146-windows-installed-smoke.ps1`
- `scripts/verify-pass-146-windows-installed-smoke.mjs`
- `docs/windows-installed-smoke-pass146.md`
- `PASS_146_WINDOWS_INSTALLED_SMOKE_CHECKLIST_SUMMARY.md`

## NPM scripts

- `evidence:windows-installed-smoke`
- `verify:pass-146-windows-installed-smoke`

## Verification

PASS146 verifies that:

- Windows installed-app smoke evidence has a bounded checklist.
- The evidence runner writes to `artifacts/windows-installed-smoke/` only.
- The runner does not silently uninstall, delete user data, or claim completion of manual checks.
- The documentation covers install, checksum, launch, About/version truth, Guide/KB, Mission Control, 2-Up, Tri-view, Quad, active-pane routing, Evidence export redaction, DevTools, no console/crash noise, and uninstall path awareness.
- Generated evidence outputs remain excluded from source.

## Boundary

PASS146 does not claim that Windows manual smoke was completed here. That proof must be run on the real installed Windows app.

No direct PSA API calls. No IT Docs backend work. No generated installers or evidence artifacts committed.
