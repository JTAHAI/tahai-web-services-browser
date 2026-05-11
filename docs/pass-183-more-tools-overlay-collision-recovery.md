# PASS183 — More Tools Overlay Collision Recovery

## Purpose

PASS183 hardens the next compact-chrome UX weak surface after PASS182: stale overlay/focus state when **More Tools** launches or overlaps another active surface.

The failure mode is subtle but important: a user can open More Tools, activate Settings/Profile/Guide/Ops surfaces, or open a DevOps/IT command panel, and More Tools can briefly remain the active chrome overlay while the new surface is already visible. That can create focus fights, stale `aria-expanded` state, misleading Escape behavior, or a feeling that the browser is stuck.

## Changes

- Adds a More Tools overlay-collision recovery controller.
- Audits open `dialog[open]` surfaces and visible `.tool-menu-panel` command panels.
- Immediately closes More Tools with `restoreFocus: false` when a dialog or command panel is active.
- Avoids pulling focus back to the More Tools opener when the user has moved into the newly opened surface.
- Tracks runtime state with `data-pass183-more-tools-overlay-collision-*` attributes.
- Adds a small visual state hook for the More Tools launcher while another dialog/command panel is open.
- Preserves all existing More Tools action wiring and compact-button behavior.

## Guardrails

- No raw IPC added.
- No `shell.openExternal` behavior added.
- No inline event handlers added.
- No generated artifacts committed.
- Browser source remains local UX hardening only.

## Verification

```bash
npm run verify:pass-183-more-tools-overlay-collision-recovery
npm run verify:pass-182-compact-hit-target-focus
npm run build
```

Version remains `1.8.30`.
