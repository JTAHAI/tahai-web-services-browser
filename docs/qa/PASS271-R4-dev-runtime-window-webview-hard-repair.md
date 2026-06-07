# PASS271-R4 — Dev Runtime Window + Normal Webview Hard Repair

This is a release-blocker repair for the post-build dev runtime failure where the shell chrome renders but the website surface is black/unclickable and Electron reports `Object has been destroyed` while trying to show the renderer failure fallback.

## Scope

- Browser-side only.
- No IT Docs backend code.
- No PSA connector code.
- No Store, GA, or signed-release claim.

## Fixes

- Guards the Electron failure fallback against destroyed BrowserWindow/WebContents before calling `loadFile`, `loadURL`, or `executeJavaScript`.
- Forces normal 1-Up browsing to hide idle Mission drag/drop/head chrome instead of letting it sit over the website budget.
- Reattaches/restores the active browser webview into `#webview-stage` if it is detached.
- Forces the active webview full-stage, visible, and clickable.
- Clears stale drag-active body classes in normal browsing.

## Verification

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass271-r4-dev-runtime-window-webview-hard-repair.mjs
npm run verify:pass-271-r4-dev-runtime-window-webview-hard-repair
npm run dev
```
