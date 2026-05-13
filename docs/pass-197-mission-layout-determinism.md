# PASS197 — Mission Layout Determinism

PASS197 hardens Mission Control layout switching so the flagship work surface does not drift when operators move between 1-Up, 2-Up Split/Stack, 3-Up variants, 4-Up Quad Ops, Focus Pane, and restored layouts.

## What changed

- Added a browser-side Mission layout determinism contract for every supported Mission layout.
- Added a runtime snapshot in the renderer that records the active layout, active pane, visible panes, prior Focus Pane restore target, pane roles, pane URLs, pane titles, runtime tab IDs, and history availability.
- Focus Pane now uses a deterministic restore candidate: the prior non-focus layout when valid, otherwise Quad Ops.
- Layout render, layout set, active-pane focus, and Focus Pane enter/restore paths all refresh the same PASS197 state record.
- Added release-blocker verifier coverage so this cannot regress silently.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend work.
- No PSA connector work.
- No secret storage.
- No version increment; Version remains `1.8.30`.
- Layout changes may alter geometry only; pane role, URL, title, runtime tab mapping, active pane, and history truth must remain auditable.

## Manual Windows checks still required

PASS197 is source/static/runtime-instrumentation hardening. It does not claim installed Windows runtime proof. On Windows, verify:

1. Open four tabs and assign them into Quad View.
2. Switch through Split Horizontal, Split Vertical, all Tri-view variants, Quad, Focus Pane, and restore.
3. Confirm the intended active pane stays highlighted and navigation targets the active pane.
4. Confirm each pane keeps the expected URL/title/role after geometry changes.
5. Confirm Focus Pane returns to the previous non-focus layout.
