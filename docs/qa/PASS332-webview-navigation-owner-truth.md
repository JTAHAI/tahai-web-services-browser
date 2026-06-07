# PASS332 - WebView Navigation Owner Truth + Blank Final-Load Recovery

## Purpose

PASS332 targets the remaining symptom after PASS330/PASS331: the website briefly flashes, then a blank white surface wins. The likely root is navigation ownership drift: an active/visible webview can remain `about:blank` or a blank non-owner can be visually above the webview that actually loaded.

## Runtime object

Open DevTools in the renderer shell and run:

```js
window.__TAHAI_PASS332_NAV_OWNER__.reconcile('manual-after-white')
document.documentElement.dataset.pass332NavigationHealth
window.__TAHAI_PASS332_NAV_OWNER__.lastSample
window.__TAHAI_PASS332_NAV_OWNER__.lastCritical
```

Expected healthy state: `ok` or a temporary `warn` if PASS332 recovered a blank primary webview.

## Recovery guardrails

- Only `http:` and `https:` shell/address URLs are eligible for automatic recovery.
- `javascript:`, `data:`, and `file:` are never auto-recovered into a webview.
- Recovery can be disabled with `TAHAI_BROWSER_DISABLE_PASS332_NAV_OWNER_RECOVERY=1`.
- Blank non-owner webviews are hidden and made inert; the highest scoring owner remains visible.

## Verification

```powershell
Set-Location D:\dev\browser\app
npm run verify:pass-332-webview-navigation-owner-truth
npm run build
```
