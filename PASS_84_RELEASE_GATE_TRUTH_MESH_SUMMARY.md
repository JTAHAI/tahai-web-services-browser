# PASS84 — Release Gate Truth Mesh

PASS84 adds a browser-side release-gate truth mesh across the hardened TAHAI Browser surfaces.

## Added

- `Release Gate Truth Mesh` command in the Operator Command Center.
- `Copy Release Gate Truth Mesh Report` command for redaction-scanned QA/handoff evidence.
- `Ctrl+Alt+Shift+V` runtime shortcut.
- Guard-mount truth checks for PASS81, PASS82, and PASS83.
- Command registry and shortcut drift checks.
- Export/evidence redaction-boundary contract repair.
- Mission pane active/visible truth repair.
- Launch recipe shape, role, duplicate, and URL checks.
- Status/live-region release-gate repair.
- `verify:pass-84-release-gate-truth-mesh`, wired into `verify:release-blockers`.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No secrets, generated artifacts, installers, `dist`, `release`, or `node_modules` in source.

## Manual QA

Run `Ctrl+Alt+Shift+V` or Command Center → `Release Gate Truth Mesh` after opening Mission Control and several tools. Copy the report and confirm it is redaction-scanned.
