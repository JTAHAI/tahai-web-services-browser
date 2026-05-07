# PASS64 — Tri View repair and pane reorder hardening

PASS64 repairs the failed PASS63 overlay path and hardens the Mission Control pane reorder upgrade.

## Fixes

- Self-contained repair for the TypeScript build blocker: `layout-changed` is normalized to `layout-set`.
- Replaces the brittle PASS63 helper-anchor insertion with a robust self-contained append strategy.
- Keeps PASS63 script names/verifier compatibility so existing release blockers do not fail stale checks.
- Adds asymmetric Tri View layouts:
  - `triple-top`
  - `triple-bottom`
  - `triple-left`
  - `triple-right`
- Keeps legacy `triple` mapped to bottom-wide behavior.
- Adds click-and-drag pane reordering for 2-Up, 3-Up, and 4-Up views.

## Hardening

- Drag starts from the visible handle only, not from arbitrary webview/pane content.
- Self-drop is a safe no-op.
- Drops outside visible mission panes are ignored.
- Active pane routing is preserved by tracking the active tab after reorder.
- Replaces the old tight PASS63 800ms refresh loop with a MutationObserver + throttled refresh scheduler.
- Updates release blockers with PASS64 verification.

## Local commands

```powershell
Set-Location C:\dev\browser\app
npm run pass64:apply
npm run verify:pass-64-triview-repair-hardening
npm run verify:pass-63-triview-pane-reorder
npm run build
```
