# PASS77 — Mission View command dock and viewport fit

PASS77 hardens Mission View against two webview-specific failure modes:

1. Native Electron webviews can swallow pointer events intended for pane movement controls.
2. Guest viewport sizing can drift after layout changes, producing cropped or partially painted sites.

## Changes

- Added a Mission pane command dock outside the webview stage.
- Added chrome-level pane controls for focus, pairwise swaps, rotate left/right, and repaint/fit.
- Kept direct stage-level Move controls from PASS76, but no longer relies on them as the only pane movement path.
- Added exact webview viewport fit attributes (`autosize`, `minwidth`, `minheight`, `maxwidth`, `maxheight`, `width`, `height`) from the measured pane bounds.
- Added a manual Repaint / Fit control that reapplies pane bounds and webview viewport bounds across multiple animation frames.

## Acceptance

- Users can move panes even when hosted pages/webviews intercept drag or overlay clicks.
- Repaint / Fit is available without DevTools or hidden commands.
- Normal active-pane routing remains unchanged.
- Browser-side-only Mission Control scope is preserved.
