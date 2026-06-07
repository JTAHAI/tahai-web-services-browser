# PASS333 - Chrome Hit-Test + WebView Layer Truth

PASS333 responds to the current runtime evidence: the website briefly flashes, then the browser becomes a white screen and the chrome buttons stop working.

That symptom is different from the original upper-left compositor trap. It points to a full-window or top-layer webview surface winning hit tests over the browser shell.

Changes:

- Quarantines PASS329-PASS332 auto-recovery imports from the renderer entry point.
- Removes the broad PASS328 stage CSS contract.
- Adds a narrower chrome-safe webview-stage CSS contract.
- Adds a diagnostic-only runtime sentry at `window.__TAHAI_PASS333_CHROME_HITTEST__`.
- Adds `npm run verify:pass-333-chrome-hit-test-webview-layer-truth`.

Runtime probe:

```js
window.__TAHAI_PASS333_CHROME_HITTEST__.sample('manual-white-buttons-dead')
document.documentElement.dataset.pass333ChromeHitTestHealth
window.__TAHAI_PASS333_CHROME_HITTEST__.lastSample
window.__TAHAI_PASS333_CHROME_HITTEST__.lastCritical
```

Healthy shell target: `ok`.

Critical findings to paste back:

- `webview-occludes-browser-chrome`
- `webview-enters-browser-chrome-band`
- `webview-full-window-surface`
