# PASS71 — Mission View pane-shell isolation

## Goal
Stop Mission View/Site View panes from staying blurred or dimmed after entering 2-Up/3-Up/4-Up Mission layouts.

## Root cause fixed
The hosted Electron `<webview>` was being used as the layout/decorated pane itself. Mission CSS, pane labels, drag handles, rounded clipping, overlay targeting, and pseudo-elements could all land on or around the actual compositor surface. In Electron this can force the guest page into an intermediate rasterized layer and leave it visually blurred/dimmed.

## Changes
- Added Mission pane shell wrappers in `src/renderer/app.ts`.
- Moved Mission layout, active-pane outline, pane labels, and drag/reorder targeting onto shell elements.
- Kept hosted `webview.browser-view` surfaces flat and absolute inside shells.
- Restored webviews to the stage root when leaving Mission multi-view mode.
- Prevented pane heads and drop-zone overlays from being mistaken for reorderable Mission panes.
- Added CSS rules so direct stage webviews are hidden in Mission mode while shell-hosted webviews remain crisp.
- Disabled webview pseudo-elements and backdrop-filter on Mission pane heads/drag handles.
- Added shell-aware Tri View placement for top-wide, bottom-wide, left-tall, and right-tall layouts.
- Added `verify:pass-71-mission-view-pane-shell-isolation` and wired it into `verify:release-blockers`.

## Local verification
```powershell
npm run verify:pass-71-mission-view-pane-shell-isolation
npm run build
npm run verify:release-blockers
npm run dev
```
