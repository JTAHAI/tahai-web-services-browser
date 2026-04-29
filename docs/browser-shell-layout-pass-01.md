# Browser Shell Layout Pass 01

This pass makes the source repo self-contained under `C:\dev\browser\app` and repairs the browser shell layout.

## Fixes

- `scripts/copy-static.mjs` now copies packaged browser assets from either the repo root itself or the historical parent-folder layout.
- Missing header logos after a clean `C:\dev\browser` reset are fixed by copying `browser/new-tab/assets/tws/*` into `dist/browser` during build.
- Site View Mission Rail is now a real drawer: fully hidden when closed, fully visible when opened, and no longer leaves a half-visible sliver over the page.
- Toolbar controls collapse into a functional `More` menu as the window narrows instead of creating ugly app-level scrollbars.
- App-owned rail scrollbars are styled. Remote page scrollbars inside a webview remain controlled by the loaded website/Chromium.

## Verification

```powershell
npm run verify:browser-shell-layout
npm run verify:release-blockers
```
