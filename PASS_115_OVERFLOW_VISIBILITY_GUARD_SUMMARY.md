# PASS115 — Overflow Visibility Guard

## Result

PASS115 adds an overflow visibility guard and hardens the adaptive chrome overflow behavior after PASS112–PASS114.

## Changed

- Added `data-pass115-overflow-visibility-guard="true"` to the renderer body.
- Stamped overflow-managed controls as PASS115 visibility candidates.
- Added CSS overrides so legacy narrow-width `display:none` rules cannot hide controls once they are moved into **More Tools**.
- Covered Settings, About, Launchpad, Guide, Profile Switcher, and generic overflow-managed controls.
- Preserved `[hidden]` semantics for intentionally hidden controls.
- Kept all work browser-side and local to chrome/overflow visibility.
- Added `verify:pass-115-overflow-visibility-guard`.
- Wired PASS115 into `verify:release-blockers` after PASS114 and before final build.

## Security / scope

No raw IPC, no shell.openExternal changes, no Mission API exposure, no webview privilege changes, no IT Docs backend work, no PSA connector work, no secrets.

Version remains `1.8.30`.
