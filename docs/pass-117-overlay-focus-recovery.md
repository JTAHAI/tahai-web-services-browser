# PASS117 — Overlay Focus Recovery Guard

PASS117 hardens the browser chrome after PASS116 made fixed operator overlays one-at-a-time.

## Purpose

The next visible/operator-risk surface was keyboard and focus recovery. After More Tools, DevOps / IT command lanes, Ops Panel, and Site View became coordinated overlays, operators still needed deterministic focus behavior: opening an overlay should move keyboard focus into that overlay, closing it with Escape or a close button should return focus to the launcher, and arbitration-close events should not steal focus from the newly opened surface.

PASS117 adds focus-scope markers and return-focus behavior for the adaptive browser chrome. It stays renderer-local and browser-side only.

## Behavior

- More Tools gets a `more-tools` focus scope, focuses its first actionable control, and restores focus to the More Tools button on Escape/explicit close.
- DevOps / IT command lanes get a `command-toolbar` focus scope and restore focus to the lane launcher when closed from Escape/back.
- Ops Panel gets an `ops-hub` focus scope, focuses its first actionable control when opened, and restores focus to Ops Panel when explicitly closed.
- Site View Mission Rail gets a `site-view` focus scope, focuses its first actionable rail control, and restores focus to Site View on explicit close/Escape.
- Arbitration-driven closes pass `restoreFocus=false` so the newly opened overlay keeps focus.
- Active overlay launchers expose PASS117 expanded/focus data attributes for CSS and future automated UI checks.

## Source changes

- `src/renderer/index.html` adds `data-pass117-overlay-focus-recovery="true"`.
- `src/renderer/responsive-toolbar.ts` adds More Tools focus scope, Escape close, first-control focus, and return-focus state.
- `src/renderer/app.ts` adds shared PASS117 focus helpers for command lanes, Ops Panel, and Mission Control focus scope state.
- `src/renderer/site-view-mission-rail.ts` adds Site View focus scope and explicit close focus recovery.
- `src/renderer/styles/responsive-toolbar.css` adds PASS117 focus-state styling without dragging overlays into the titlebar region.
- `scripts/verify-pass-117-overlay-focus-recovery.mjs` statically gates the pass.

## Guardrails

- Browser-side source only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No raw IPC exposure.
- No `shell.openExternal` changes.
- No webview or Mission pane routing changes.
- Version remains `1.8.30`.
