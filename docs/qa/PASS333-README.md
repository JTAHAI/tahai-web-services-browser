# PASS333 Patch README

Run from `D:\dev\browser\app`:

```powershell
Set-Location D:\dev\browser\app
Expand-Archive -Force "$env:USERPROFILE\Downloads\TAHAI-browser-pass333-chrome-hit-test-webview-layer-truth-patch-20260517.zip" D:\dev\browser\app
.\scripts\apply-pass333-chrome-hit-test-and-pass-recovery-quarantine.ps1
npm run build
npm run dev
```
