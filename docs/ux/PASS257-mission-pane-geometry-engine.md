# PASS257 — Mission Pane Geometry Engine

PASS257 makes pane geometry deterministic after PASS256 made layout transitions deterministic.

## Acceptance coverage

- One canonical function computes pane bounds.
- CSS and JS use the same layout truth.
- Webviews are pinned top-left with full width and height.
- Pane shells use stable `min-height: 0`, `min-width: 0`, and `overflow: hidden` containment.
- ResizeObserver watches stage and pane shells.
- Bounds are recalculated after layout change, resize, DOM-ready, did-stop-loading, and focus.
- Hidden panes are marked out of active routing.
- Visual-health flags are surfaced on panes and runtime webviews.

## Manual smoke focus

Stress restored, maximized, and small windows:

1. Start each flagship recipe.
2. Switch 1-Up → 2-Up → 3-top → 3-bottom → 3-left → 3-right → Quad → Focus → Quad → 1-Up.
3. Resize during loading.
4. Confirm visible panes fill the Mission stage from top-left.
5. Confirm no pane renders as a bottom-only sliver.
6. Confirm intentionally empty panes show the local placeholder.

## Boundary

Browser-side only. No IT Docs backend code. No PSA connector code. No direct PSA API calls. No secrets.
