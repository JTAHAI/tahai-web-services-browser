# PASS257 — Mission Pane Geometry Engine

Version target: **2.0.6**

## Goal

Eliminate bottom-only website rendering, black dead areas, stale transforms, and geometry drift by making Mission Control pane sizing owned by one canonical browser-side geometry engine.

## What this pass adds

- Canonical pane-bounds calculation for 1-Up, 2-Up, split-vertical, tri-view variants, Quad, and Focus.
- Runtime pane application that pins visible panes top-left with explicit pixel bounds.
- Runtime webview/iframe pinning: `top: 0`, `left: 0`, full width/height, `transform: none`.
- Stable pane containment: `min-height: 0`, `min-width: 0`, `overflow: hidden`, and layout containment.
- `ResizeObserver` recalc for the Mission stage and pane shells.
- Recalculation after layout change, resize, `dom-ready`, `did-stop-loading`, focus, and operator clicks.
- Visual-health flags:
  - `data-pane-visible`
  - `data-pane-has-webview`
  - `data-pane-geometry-ok`
  - `data-webview-top-left-ok`

## Apply

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\\apply-pass251-mission-multiview-final-polish.mjs
node scripts\\apply-pass252-mission-multiview-state-hardening.mjs
node scripts\\apply-pass253-mission-pane-viewport-hardening.mjs
node scripts\\apply-pass254-mission-recipe-click-contract.mjs
node scripts\\apply-pass255-recipe-pane-hydration.mjs
node scripts\\apply-pass256-quad-view-state-machine.mjs
node scripts\\apply-pass257-mission-pane-geometry-engine.mjs
```

## Verify

```powershell
npm run verify:pass-256-quad-view-state-machine
npm run verify:pass-257-mission-pane-geometry-engine
```

## Store posture

Microsoft Store submission remains blocked until installed-app smoke confirms recipe launch plus Split/Tri/Quad/Focus/restore has no blank panes, no bottom-only webview rendering, no orphaned active pane state, and reliable layout switching.
