# PASS89 — Mission Pane Restore Failsafe

PASS89 hardens Mission View restoration and pane movement so operator actions cannot silently move a Mission tab into a hidden pane.

## Added

- Mission Pane Restore Failsafe command.
- Copy Mission Pane Restore Report command.
- `Ctrl+Alt+Shift+G` shortcut.
- Layout promotion when pane movement targets a pane outside the current visible layout.
- Active-pane/focus restore fallback when stale state points to a hidden pane.
- Stale Mission pane drag/drop overlay cleanup after layout/move operations.
- Move-control accessibility and type guards for pane restore controls.
- PASS89 CSS focus and status states.
- `verify:pass-89-mission-pane-restore-failsafe` release verifier.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend work.
- No PSA connector/API work.
- No secrets, generated artifacts, `node_modules`, `dist`, or `release` in source.
- Version remains `1.8.30`.
