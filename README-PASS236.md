# PASS236 — WebView DOM-Ready Direct loadURL Elimination

Purpose: hard-close the persistent installed-app WebView lifecycle crash by removing direct renderer `webview.loadURL(...)` calls and replacing fallback navigation with a `src` assignment wrapper.

Run:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass236-dom-ready-direct-loadurl-elimination.mjs
npm run verify:pass-236-dom-ready-direct-loadurl-elimination
npm run verify:release-blockers
npm run build
npm start
```

Hard blocker if still seen:

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

Full repo ZIP note: this patch includes the repo-root source changes and verifier. A true full repo ZIP must be produced from the actual local repo after applying this pass, because this environment cannot directly read `C:\dev\browser\app`.
