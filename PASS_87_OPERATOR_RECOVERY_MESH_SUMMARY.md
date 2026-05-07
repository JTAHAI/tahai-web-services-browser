# PASS87 — Operator Recovery Mesh

Browser-side hardening pass for TAHAI Web Services Browser 1.8.30.

## Scope

PASS87 adds a source-true recovery mesh across navigation, address routing, DevOps/IT tool actions, non-drop Mission boundaries, command/shortcut registry contracts, pane/webview isolation, evidence/export redaction boundaries, dialog Escape recovery, and runtime truth surfaced through the status bar.

## Key hardening

- Adds `Operator Recovery Mesh` command and `Copy Operator Recovery Mesh Report`.
- Adds `Ctrl+Alt+Shift+O` recovery shortcut.
- Corrects recovery auditing to the real address input `#address`, avoiding stale `#address-input` drift.
- Marks navigation controls as active-pane-aware recovery surfaces.
- Marks DevOps/IT tool actions as redaction-aware operator actions.
- Enforces Mission non-drop boundaries for Ops Hub, tool panels, recipe areas, runbook/evidence rails, command dock, dialogs, and tool panels.
- Reasserts webview guardrails: no `nodeintegration`, `allowpopups=false`, `autosize=off`, isolated direct-stage-child recovery marker.
- Adds redaction-required evidence/output recovery markers to textareas.
- Adds dialog Escape/ARIA recovery markers.
- Adds `verify:pass-87-operator-recovery-mesh` and wires it into `verify:release-blockers`.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend work.
- No PSA connector/API work.
- No secrets, generated artifacts, `node_modules`, `dist`, or `release` in source.
- Keeps version at 1.8.30.
