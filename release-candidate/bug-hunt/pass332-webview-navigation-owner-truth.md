# PASS332 Bug-Hunt Report - WebView Navigation Owner Truth

## Hypothesis

The upper-left compositor trap has been reduced, but the page still flashes and becomes white. That points to final-load ownership drift:

1. the shell/address bar owns a non-blank URL,
2. the selected/top webview remains `about:blank`, or
3. a blank non-owner webview is visible above the loaded owner.

## Source changes

- Added `src/renderer/pass332-webview-navigation-owner-truth.ts`.
- Imported it into `src\renderer\app.ts`.
- Added `npm run verify:pass-332-webview-navigation-owner-truth`.

## Runtime findings to collect locally

```js
window.__TAHAI_PASS332_NAV_OWNER__.reconcile('manual-after-white')
window.__TAHAI_PASS332_NAV_OWNER__.lastSample
window.__TAHAI_PASS332_NAV_OWNER__.lastCritical
```

Important finding kinds:

- `primary-blank-with-shell-url`
- `primary-blank-with-shell-url-recovered`
- `no-webview-for-shell-url`
- `multiple-visible-webview-owners`
- `visible-blank-non-owner-webview`
- `content-probe-not-webview`
