# PASS163 — More Tools Action Dispatch + Mission Reflow Guard

PASS163 fixes the small-window regression where toolbar controls moved under **More Tools** could appear inert and Mission Control could flicker or dismiss during its first open cycle.

## Problem closed

At reduced window widths, secondary toolbar controls are moved into the More Tools overflow panel. Those controls kept their original handlers, but the overflow panel could stay on top after the action fired, making navigation/profile/settings actions look broken. Separately, the PASS122 overlay viewport guard could classify the top-layer Mission Control dialog as a clipped chrome overlay while compact/fullscreen Mission Control was still settling, causing the Mission button to flicker and require repeated clicks.

## Source changes

- More Tools now delegates activation for moved `.in-toolbar-overflow` controls.
- After a moved control dispatches its original click action, More Tools closes without stealing the action.
- The overlay viewport guard now records the active overlay open timestamp/source.
- Recently opened overlays get a short settle window before clipping dismissal.
- Scroll-contained overlays and top-layer Mission Control compact/micro layouts are treated as valid viewport-safe surfaces when they have usable visible height.
- Mission Control compact/micro CSS explicitly anchors the dialog to the top-layer viewport and keeps pointer events active while open.

## Guardrails preserved

- Actual renderer TypeScript/CSS changes only.
- No browser-side IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No secrets, runtime profiles, generated packages, `dist`, `release`, or `node_modules` added.
- Version remains `1.8.30`.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-163-more-tools-mission-reflow
npm run build
npm run verify:release-blockers
```

## Manual smoke checklist

- Resize the app below maximized width until Settings, About, Guide, Launchpad, Ops Panel, Profile, or bookmark controls move into More Tools.
- Open More Tools and click each moved control.
- Confirm the original action fires and More Tools does not remain as a blocking surface.
- Open Mission Control repeatedly at compact and micro window sizes.
- Confirm Mission Control opens on the first click without flicker/dismiss/retry behavior.
- Confirm Escape still closes active overlays and returns focus to the launcher where appropriate.
