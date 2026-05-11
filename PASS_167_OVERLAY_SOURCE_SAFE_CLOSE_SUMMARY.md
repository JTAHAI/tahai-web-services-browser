# PASS167 — Overlay Source-Safe Close Guard

## Summary

PASS167 fixes a remaining deep overlay-state race. Close events for non-active overlays no longer clear the currently active overlay state. This protects compact-window More Tools, Site View, Ops Panel, command toolbar, and Mission Control from losing active-overlay truth during cycle cleanup.

## Changed

- `src/renderer/app.ts`
  - Made `pass118ClearChromeOverlayState` source-safe.
  - Added PASS167 telemetry for clear mode.
  - Mounted PASS167 marker in overlay guard initialization.
- `src/renderer/responsive-toolbar.ts`
  - Added PASS167 source-safe overlay-close marker for More Tools.
- `src/renderer/site-view-mission-rail.ts`
  - Added PASS167 source-safe overlay-close marker for Site View.
- `src/renderer/index.html`
  - Added PASS167 body marker.
- `scripts/verify-pass-167-overlay-source-safe-close.mjs`
  - Added verifier preventing stale unconditional active-overlay deletion.
- `package.json`
  - Added `verify:pass-167-overlay-source-safe-close`.

## Verification

- `npm run verify:pass-167-overlay-source-safe-close`
- `npm run typecheck`
- `npm run build`
