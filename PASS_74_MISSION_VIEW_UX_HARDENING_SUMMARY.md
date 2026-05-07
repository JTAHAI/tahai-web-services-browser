# PASS74 — Mission View UX hardening and self-correction

Scope: browser-side Mission View only. No IT Docs backend work, no PSA connector work, no secrets, no generated artifacts.

## Fixes

- Makes pane move behavior reliable by adding a real pointer movement threshold.
- Stops click-to-swap from arming on pointerup and then immediately cancelling on the subsequent click.
- Makes the Move handle explicit and visible: click one pane, then another pane to swap; Esc cancels.
- Adds direct webview bounds self-correction after layout, load, resize, and transition events.
- Reapplies important pixel bounds, width/height attributes, display mode, and anti-blur compositor properties when Electron webview surfaces drift.
- Adds Mission View surface diagnostics through status messages when stale/mismatched pane bounds are corrected.

## Verification

```powershell
npm run verify:pass-74-mission-view-ux-hardening
npm run build
npm run verify:release-blockers
```
