# PASS235 QA — WebView Prototype Lifecycle Hard Close

## Required local smoke

Run from a clean overlay:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass235-webview-prototype-lifecycle-hard-close.mjs
npm run verify:pass-235-webview-prototype-lifecycle-hard-close
npm run verify:release-blockers
npm run build
npm start
```

## Must not appear

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

## Manual runtime checks

- Launch the app from a cold start.
- Open a normal page.
- Trigger Back, Forward, Reload, Home, Launchpad, Settings/About/KB, DevTools, Mission Control, 2-Up, Tri-view, Quad, Focus Pane.
- Navigate to a malformed/blocked URL and confirm the app routes to the safe error/new-tab surface without renderer boot diagnostics.
- Check diagnostics only if needed: `document.body.dataset.pass235LastLifecycleDiagnostic`, `pass235LastSrcFallback`, `pass235LastQueuedCommand`, `pass235LastQueueFlush`.

## Release verdict

PASS235 is acceptable only if the exact WebView attach/dom-ready diagnostic is gone during boot and normal navigation. Any recurrence blocks preview release, Store submission, and GA language.
