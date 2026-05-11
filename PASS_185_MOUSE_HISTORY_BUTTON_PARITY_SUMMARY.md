# PASS185 — Mouse History Button Parity

Completed: 2026-05-11
Version remains `1.8.30`.

## Fixed

- Mouse Button 4/5 now route through the same history path as toolbar Back/Forward and Alt+Left/Alt+Right.
- Added webview-bound capture handling for hardware mouse history buttons.
- Added main-process app-command fallback for focused shell and guest webContents.
- Added dedupe guards to prevent double navigation when multiple event paths fire.
- Preserved active Mission pane routing for Split / Tri / Quad layouts.

## Verification

- `npm run verify:pass-185-mouse-history-button-parity`
- `npm run verify:pass-184-hidden-more-tools-focus-recovery`
- `npm run build`
