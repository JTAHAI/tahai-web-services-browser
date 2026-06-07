# PASS317 — Emergency viewport compositor fill hotfix

This is a corrective hotfix for the observed runtime failure where the Electron window compositor fills the display but the browser chrome/content shell remains trapped in the upper-left region, leaving black unused space to the right/bottom.

Scope:
- Patch renderer CSS root/app/chrome/workspace wrappers to fill the real BrowserWindow viewport.
- Remove stale max-width behavior from the immediate app shell hierarchy.
- Preserve browser-side-only scope and release truth.

Local proof:
```powershell
Set-Location C:\dev\browser\app
.\scripts\apply-pass317-viewport-compositor-fill-hotfix.ps1
npm run dev
```

Expected manual result:
- Restored and maximized windows fill the full Electron content area.
- No black unused right/bottom compositor area.
- Toolbar spans the full window width.
- Webview/content stage spans the full available content width.
