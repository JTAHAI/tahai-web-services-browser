# PASS83 — Operator Safety Contract

PASS83 hardens all operator-facing browser surfaces without adding backend scope, PSA connectors, credentials, or remote automation.

## Added

- Runtime Operator Safety Contract command.
- `Ctrl+Alt+Shift+M` shortcut.
- Redaction gates on copy/save actions for DevOps capture, Ops Check, deploy readiness, IT service card, endpoint snapshot, support triage, route map, developer audit, evidence bundle, IT Docs/PSA handoff, Ops Guard, and Mission export.
- Dialog Escape recovery declarations and close-button inspection.
- Toolbar `aria-expanded` / `aria-controls` truth sync.
- Active-pane and visible-pane truth markers.
- Launch recipe shape and URL contract inspection.
- Runtime fault visibility for `window.error` and unhandled promise rejections with redacted reporting.
- Copyable redaction-scanned PASS83 operator safety report.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No secrets, generated installers, dist, release, node_modules, or runtime profile data.
