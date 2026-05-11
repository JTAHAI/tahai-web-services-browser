# PASS176 — Compact Icon Viewport Hardening

## Scope
PASS176 continues the PASS173–PASS175 iconified utility chrome work by hardening the next weak responsive surface: open More Tools state during resize/compact reflow, compact hit targets, and compact Mission layout controls.

## What changed
- More Tools now exposes an explicit `aria-controls="toolbar-overflow-menu"` relationship.
- Responsive relayout publishes PASS176 density state so runtime/CSS state can be inspected after boot and resize.
- If More Tools is open during a resize/reflow and the focused item is moved out of the menu, focus is repaired to a visible menu item instead of becoming stale or hidden.
- Utility chrome and More Tools menu items get stronger compact hit targets, including coarse-pointer/touch hardening.
- Compact Mission Control layout controls keep stronger focus affordance and scroll the active layout button into view after render or layout click.

## Guardrails
- Source-only patch; no generated artifacts or runtime DOM hacks.
- No backend, PSA connector, IT Docs backend, secrets, token storage, raw IPC, or external-open changes.
- Version remains `1.8.30`.
