# PASS339 - Normal Browsing Input/Paint Closeout

## Purpose

PASS338 removed the white webview surface but exposed the adjacent runtime owner: stale Mission drag/drop chrome could remain visible above the normal 1-Up webview. The visible `Internal TAHAI drags only` label showed that Mission drop-zone residue was still mounted over the website stage, which can block webview paint and hit-testing on Windows/Electron.

## Source changes

- Adds a standalone PASS339 normal-browsing closeout owner in `src/renderer/app.ts`.
- Clears stale Mission drag classes in normal browsing without re-enabling PASS271_R4.
- Hides Mission drop zones, pane headers, and drag residue outside an active Mission drag.
- Restores the active webview to direct `#webview-stage` ownership in single/normal browsing.
- Reasserts chrome hit targets as no-drag and pointer-enabled.
- Adds loaded stylesheet fail-closed rules in `src/renderer/styles/browser.css` so Mission drop overlays cannot appear in normal 1-Up browsing.

## Verifier

```powershell
npm run verify:pass-339-normal-browsing-input-paint-closeout
```

Report:

```text
release-candidate/generated/pass339-normal-browsing-input-paint-closeout-report.json
```

## Runtime check

Run without PASS271 emergency env vars:

```powershell
npm run dev
```

Expected:

- No `Internal TAHAI drags only` label in normal browsing.
- Active webview remains inside `#webview-stage`.
- Chrome buttons and address bar respond.
- Website content remains visible after load.
- PASS271_R4 repair remains disabled unless explicitly enabled by env var.

## DevTools probe

```js
window.__TAHAI_PASS339_NORMAL_BROWSING_INPUT_PAINT_CLOSEOUT__?.repair('manual')
window.__TAHAI_PASS339_NORMAL_BROWSING_INPUT_PAINT_CLOSEOUT__?.lastReport()
document.documentElement.dataset.pass339NormalBrowsingInputPaintCloseout
document.body.classList.contains('mission-tab-dragging')
document.querySelector('.mission-pane-drop-zones')?.hidden
```
