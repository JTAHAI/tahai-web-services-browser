# PASS81 — All-Surface Browser Hardening Guard

Scope: browser-side only. No IT Docs backend work, no PSA connector work, no direct PSA API calls, no secrets, and no generated artifacts.

## Added

- All-Surface Doctor command and `Ctrl+Alt+Shift+S` shortcut.
- Protected non-pane Mission/rail/evidence/tool surfaces so browser-tab and pane drag payloads cannot accidentally target recipes, runbooks, mission lists, evidence lists, dialogs, or command lanes.
- Runtime hardening for shell buttons, external local-shell links, dialog labels, evidence/export textareas, hardened webview preferences, active-pane routing, and toolbar overflow markers.
- Redaction-scanned All-Surface Doctor Markdown copy path.
- PASS81 static verifier wired into `verify:release-blockers`.

## Acceptance

- Mission panes remain the only pane drop targets.
- Normal browser mode stays clean.
- Ops Mode and Mission Control get repair/diagnostic coverage without adding backend/API scope.
- Evidence and export outputs receive autocomplete/spellcheck hardening and redaction-scanned doctor reporting.
