# PASS178 — Live Viewport Budget + Enterprise Button Geometry

## Purpose

PASS177 recovered the website pane when the browser chrome collapsed the webview into a horizontal sliver. PASS178 hardens the next weak surface: chrome geometry can still change after the initial responsive toolbar relayout through bookmarks, command toolbar state, overlays, restored-window resize, or late DOM/class changes.

PASS178 keeps the viewport budget live and also changes the utility chrome controls away from soft mobile-app pill shapes toward tighter enterprise-style rounded rectangles.

## Changes

- Adds a live viewport-budget observer marker: `data-pass178-viewport-budget-observer="true"`.
- Adds an enterprise geometry marker: `data-pass178-enterprise-button-geometry="true"`.
- Installs a `ResizeObserver` over the shell, titlebar, toolbar, bookmarks bar, statusbar, and webview stage.
- Adds a mutation observer for chrome-level class/child changes that can alter viewport budget after startup.
- Re-runs viewport budget audits after chrome-stack reflow, window resize, startup settle delays, and chrome mutations.
- If the website pane is threatened and secondary controls are not fully moved into More Tools, PASS178 forces a guarded relayout rather than allowing webview starvation.
- Refactors toolbar utility buttons and More Tools buttons from pill geometry to tighter enterprise rounded-rectangle geometry.
- Keeps touch/coarse-pointer hit targets readable while avoiding the exaggerated mobile capsule shape.

## Guardrails

- No raw IPC added.
- No external-open behavior added.
- No inline DOM event handlers added.
- Version remains `1.8.30`.
- PASS177 remains the primary hard CSS cap; PASS178 keeps it live after late chrome changes.

## Local verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-178-live-viewport-budget-enterprise-button-geometry
npm run verify:pass-177-website-pane-viewport-recovery
npm run build
```
