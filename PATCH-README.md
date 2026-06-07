# PASS337 — Cursor Root-Cause Closeout

This repo-root patch applies the Cursor white-screen/dead-chrome findings as source cleanup.

Primary fixes:
- PASS271_R9 GPU disable is opt-in only.
- PASS271_R4 normal-webview hard repair loop is opt-in only.
- PASS271_R9 blank-surface retry loop is opt-in only.
- Emergency PASS329–PASS336 recovery imports are quarantined except PASS333 diagnostic.
- Runtime-loaded CSS (`src/renderer/styles/browser.css`) receives the chrome-safe webview stage contract.
- Verifier checks the loaded CSS path, not the orphan `src/renderer/browser.css` path.

Run from `D:\dev\browser\app`:

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\TAHAI-browser-pass337-cursor-root-cause-closeout-patch-20260518.zip" D:\dev\browser\app
.\scripts\apply-pass337-cursor-root-cause-closeout.ps1
npm run build
npm run dev
```

Optional after local verification:

```powershell
.\scripts\package-pass337-full-source.ps1
```

That creates a full source zip from the local repo while excluding generated/runtime folders.
