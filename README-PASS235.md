# PASS235 — WebView Prototype Lifecycle Hard Close

Purpose: close the remaining runtime boot diagnostic after PASS231–PASS234 by gating WebView methods at the prototype level and converting early `loadURL` fallback navigation to a safe `src` assignment until the WebView is attached and `dom-ready`.

Run:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass235-webview-prototype-lifecycle-hard-close.mjs
npm run verify:pass-235-webview-prototype-lifecycle-hard-close
npm run verify:release-blockers
npm run build
npm start
```

Hard blocker if still seen:

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```
