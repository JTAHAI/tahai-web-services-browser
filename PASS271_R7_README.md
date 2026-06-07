# PASS271-R7 — Webview Attach Src + Click Runtime Closeout

This patch fixes the audit-confirmed runtime blocker where the browser chrome renders but the website pane is a white, unclickable surface.

Root cause: the webview was appended to the DOM before it had a sanitized `src`. The main-process webview attach guard checks `params.src` during `will-attach-webview`, so the guest webContents could be blocked before navigation.

Run:

```powershell
Set-Location C:\dev\browser\app
Expand-Archive "$env:USERPROFILE\Downloads\TAHAI-browser-pass271-r7-webview-attach-src-click-runtime-closeout-cumulative-patch-20260515.zip" -DestinationPath . -Force
node scripts\apply-pass271-r7-webview-attach-src-click-runtime-closeout.mjs
npm run verify:pass-271-r7-webview-attach-src-click-runtime-closeout
npm run dev
```
