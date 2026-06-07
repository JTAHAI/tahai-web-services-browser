# PASS271-R9 — Webview White-Screen Input/Compositor Closeout

Run:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r9-webview-white-screen-input-compositor-closeout.mjs
npm run verify:pass-271-r9-webview-white-screen-input-compositor-closeout
npm run build
npm run dev
```

Debug-only GPU comparison:

```powershell
$env:TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR = "0"
npm run dev
```
