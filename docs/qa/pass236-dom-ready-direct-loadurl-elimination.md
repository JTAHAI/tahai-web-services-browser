# PASS236 QA — DOM-Ready Direct loadURL Elimination

## Apply and verify

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass236-dom-ready-direct-loadurl-elimination.mjs
npm run verify:pass-236-dom-ready-direct-loadurl-elimination
npm run verify:release-blockers
npm run build
npm start
```

## Must not appear

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

## Installed-app smoke

After `npm start`, also test the installed/unpacked app, because that is where the issue kept recurring:

```powershell
Set-Location C:\dev\browser\app
npm run package:win:unpacked-zip
npm run verify:package:win
```

Then launch the built app and confirm the boot diagnostic does not show the WebView attach/dom-ready error.

## Manual runtime checks

- Cold start the app.
- Open the launchpad/home page.
- Navigate to a normal HTTPS page.
- Navigate to a malformed or blocked URL and confirm safe fallback works.
- Trigger reload, back, forward, Mission Control, 2-Up, Tri-view, Quad, Focus Pane, Settings/About, Guide/KB, More Tools, and DevTools.
- Confirm no renderer diagnostic mentions WebView attach/dom-ready.

## Local diagnostic breadcrumbs

If the error persists, inspect these renderer datasets in DevTools:

```text
document.body.dataset.pass236DomReadyLifecycleGate
document.body.dataset.pass236LastDomReadyLifecycleLabel
document.body.dataset.pass236LastDomReadyLifecycleDetail
document.body.dataset.pass236LastSafeLoadUrl
document.body.dataset.pass236DomReadyAtLoad
```
