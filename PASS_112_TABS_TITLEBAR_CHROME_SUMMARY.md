# PASS112 — Tabs Titlebar Chrome

Completed PASS112 for TAHAI Web Services Browser.

## Fixed

- Removed the perceived extra top toolbar level on Windows.
- Moved the existing browser tab strip into the effective window titlebar area.
- Hid the native menu bar by default while keeping menu accelerators/application menu behavior.
- Preserved native OS caption buttons through Electron `titleBarOverlay`.
- Added topbar drag behavior and explicit no-drag behavior for tabs/buttons.

## Verification

- Repaired the stale PASS73 release-chain verifier so it accepts PASS111/PASS112 final-build ordering.

- Added `scripts/verify-pass-112-tabs-titlebar-chrome.mjs`.
- Added `verify:pass-112-tabs-titlebar-chrome`.
- Wired PASS112 into `verify:release-blockers` before the final build step.

## Scope

Browser-side UX/source only. No IT Docs backend, PSA connector, secrets, generated artifacts, or runtime data.
