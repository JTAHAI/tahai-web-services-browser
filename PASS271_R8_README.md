# PASS271-R8 — R7 Script Repair + Webview Src Hard Close

R7 did not apply because its apply script had an unescaped backtick in a Markdown template literal. R8 replaces that broken R7 apply script with a wrapper and applies the actual webview attach-src fix.

Run:

```powershell
Set-Location C:\dev\browser\app
Expand-Archive "$env:USERPROFILE\Downloads\TAHAI-browser-pass271-r8-r7-script-repair-webview-src-hard-close-cumulative-patch-20260515.zip" -DestinationPath . -Force
node scripts\apply-pass271-r8-r7-script-repair-webview-src-hard-close.mjs
npm run verify:pass-271-r8-r7-script-repair-webview-src-hard-close
npm run dev
```
