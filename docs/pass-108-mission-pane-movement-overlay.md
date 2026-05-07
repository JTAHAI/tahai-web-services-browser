# PASS108 — Mission Pane Movement Overlay Repair

## Objective

Mission pane movement must work reliably even when native Electron webviews intercept normal DOM drag/drop events. PASS108 adds a deterministic app-chrome overlay for pane swaps.

## Operator behavior

1. Open Mission View in 2-Up, 3-Up, or 4-Up.
2. Click a pane `Move` handle.
3. Click a highlighted pane target to swap the selected pane with that target.
4. Press `Esc` or click the selected pane again to cancel.

Drag/drop still exists, but the reliable path is now explicit overlay targeting.

## Acceptance

- Pane movement no longer depends on native webview dragover/drop propagation.
- Full-pane swap targets are visible only after a pane Move handle is armed.
- Webviews still receive normal browsing input when pane movement is not armed.
- All Mission View pane swaps trigger render, restore failsafe, and viewport settle.
