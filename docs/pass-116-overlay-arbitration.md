# PASS116 — Overlay Arbitration Guard

PASS116 hardens the browser chrome after PASS112–PASS115 moved tabs into the titlebar, compressed the toolbar, anchored overlays below the measured chrome stack, and preserved overflow visibility.

## Purpose

The next visible/operator-risk surface was overlay stacking. After the adaptive toolbar work, multiple fixed chrome surfaces could be opened in sequence: More Tools, DevOps / IT command lanes, Ops Panel, Site View Mission Rail, and Mission Control. Even when each surface was individually positioned correctly, opening several at once could create visual collisions, stale focus targets, and unclear operator state.

PASS116 adds a renderer-local chrome overlay arbitration event. It does not expose IPC, does not touch webviews, does not change pane routing, and does not add backend or connector behavior.

## Behavior

One active chrome overlay wins at a time:

- Opening **More Tools** announces `more-tools` and closes command lanes, Ops Panel, and Site View.
- Opening **DevOps / IT command toolbar** announces `command-toolbar` and closes More Tools, Ops Panel, and Site View.
- Opening **Ops Panel** announces `ops-hub` and closes More Tools, command lanes, and Site View.
- Opening **Site View Mission Rail** announces `site-view` and closes More Tools, command lanes, and Ops Panel.
- Opening **Mission Control** announces `mission-control` and closes chrome overlays before the modal workspace opens.

## Source changes

- `src/renderer/index.html` adds `data-pass116-overlay-arbitration="true"`.
- `src/renderer/responsive-toolbar.ts` dispatches and listens for `tahai:chrome-overlay-open` for More Tools.
- `src/renderer/app.ts` dispatches/listens for `tahai:chrome-overlay-open` for command lanes, Ops Panel, and Mission Control.
- `src/renderer/site-view-mission-rail.ts` dispatches/listens for `tahai:chrome-overlay-open` for Site View.
- `src/renderer/styles/responsive-toolbar.css` adds no-drag and hidden-state guardrails for arbitrated overlays.
- `scripts/verify-pass-116-overlay-arbitration.mjs` statically gates the pass.

## Guardrails

- Browser-side source only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No raw IPC exposure.
- No `shell.openExternal` changes.
- No webview or Mission pane routing changes.
- Version remains `1.8.30`.
