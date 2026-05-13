# PASS232 QA — WebView Runtime Command Sweep + Release Closeout

## Blocker being closed

```text
TAHAI Browser Runtime Diagnostic
Booting browser shell…
Renderer error: Uncaught Error: The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

## Required local smoke

Run after applying PASS232:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass232-webview-runtime-command-sweep-release-closeout.mjs
npm run verify:pass-232-webview-runtime-command-sweep-release-closeout
npm run verify:release-blockers
npm run build
npm start
```

Then test:

1. Launch cold from a clean app session.
2. Confirm no runtime diagnostic shows the WebView DOM-ready error.
3. Use address-bar navigation immediately after launch.
4. Press reload immediately after opening a new tab.
5. Use back/forward immediately after navigation.
6. Open and close DevTools on the active webview.
7. Trigger capture/evidence paths that may use `executeJavaScript` or `capturePage`.
8. Switch Mission layouts and repeat navigation, reload, DevTools, and capture.
9. Resize restored/small/maximized and repeat one navigation action.

## Release decision

PASS232 can unblock the runtime class only if the installed app no longer reports the diagnostic. If the diagnostic returns, GA/Store/direct public release remains blocked.
