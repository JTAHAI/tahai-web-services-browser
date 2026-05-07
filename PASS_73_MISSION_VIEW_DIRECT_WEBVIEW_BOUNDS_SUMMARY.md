# PASS73 — Mission View Direct Webview Bounds

## Goal

Repair the remaining Mission View runtime issues after PASS70–PASS72:

- Blur improved, but hosted sites could appear vertically cut off because Electron webviews were still nested inside decorated pane shells.
- Pane movement was not discoverable/reliable because the click-to-swap fallback was defined but not actually reachable through the handle path.

## Changes

- Keeps Electron `<webview>` elements as direct children of the webview stage during Mission multi-view.
- Uses pane shells as overlay frames only for labels, outlines, active/drop state, and move handles.
- Pixel-positions the direct webviews and overlay frames to the same bounds.
- Adds direct webview pane data attributes so hit-testing can still resolve target panes when dragging over hosted content.
- Prevents move handles from being injected into the webview custom element.
- Makes pane move handles visible in Mission View.
- Wires click-to-swap fallback:
  1. Click a pane's Move/Drag handle to arm the pane.
  2. Click another pane's handle to swap.
  3. Esc cancels.
- Preserves pointer drag reorder when the handle drag path is supported by the host OS/webview compositor.

## Verification

Added:

```powershell
npm run verify:pass-73-mission-view-direct-webview-bounds
```

Wired into:

```powershell
npm run verify:release-blockers
```
