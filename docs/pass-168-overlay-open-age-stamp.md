# PASS168 — Overlay Open-Age Stamp

## What needed fixing

The responsive overlay open-age guard uses an “opened age” window so compact overlays are not dismissed before they finish layout/settle work. The main app path stamped that timestamp, but module-owned overlays such as **More Tools** and **Site View** could announce themselves as active without refreshing `pass122ActiveOverlayOpenedAt` / `pass122ActiveOverlayOpenedSource`.

That created a hidden regression class: the viewport reflow guard could see an overlay as active, fail to find a fresh open-age window, and dismiss it immediately instead of giving it the same settle protection Mission Control receives.

## Hardening

- Added a central `pass116MarkActiveChromeOverlay(...)` helper in the renderer shell.
- Every main-process overlay-open path now refreshes active overlay, opened timestamp, opened source, and PASS168 telemetry together.
- The shared overlay-open event listener refreshes the stamp for module-owned overlays.
- More Tools and Site View also stamp the opened time/source before dispatching their overlay-open events.
- The multi-overlay cycle keeper now preserves the retained overlay by using the same helper instead of directly setting `pass116ActiveOverlay`.
- The release-blocker chain now includes PASS167 and PASS168 before the final build.

## Verification

Run:

```powershell
npm run verify:pass-168-overlay-open-age-stamp
npm run verify:pass-167-overlay-source-safe-close
npm run typecheck
npm run build
```
