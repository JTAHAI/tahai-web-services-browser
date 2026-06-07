# PASS329 - Runtime Lifecycle Geometry Sentry

Purpose: continue bug hunting past PASS328 by proving whether late lifecycle owners still trap the renderer/webview shell in the upper-left corner after attach/load/resize.

This pass adds a source-owned renderer sentry that:

- samples viewport, root, stage, and webview rectangles after install, DOMContentLoaded, load, resize, visibility changes, and webview insertion
- records samples at `window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__`
- sets `document.documentElement.dataset.pass329ViewportHealth` to `ok`, `warn`, or `critical`
- flags root/stage/webview upper-left island failures
- flags inline geometry owners on stage/webview elements
- flags active webview transforms
- does not resize, reposition, zoom, or patch webview geometry at runtime

Verification:

```powershell
Set-Location D:\dev\browser\app
npm run verify:pass-329-runtime-lifecycle-geometry-sentry
npm run build
```

Manual runtime probe:

1. Launch restored, not maximized.
2. Load `https://tahaiportal.com/`.
3. Open DevTools for the shell if needed.
4. Run:

```js
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')
document.documentElement.dataset.pass329ViewportHealth
```

Acceptance:

- Expected healthy value is `ok`.
- `warn` means stale inline geometry remains but the app may still be usable.
- `critical` means the upper-left/black-space failure is observable and should be correlated with `lastCritical`.
- Any PASS271/PASS317-PASS328 observer/timer still controlling viewport geometry must be removed or gated.

Release truth:

- Microsoft Store submission remains not submitted.
- Microsoft Store approval remains false.
- No GA claim.
- No signed-release claim.
