# PASS271-R6 — Popup-As-Tabs Operator Toggle

Adds a safe popup allowance for sites that require popup auth/admin flows.

Behavior:
- Popups are not allowed as unmanaged Electron popup windows.
- Safe popup URLs are sanitized in the main process.
- When enabled, the popup opens as a normal TAHAI browser tab.
- Unsafe popup URLs stay blocked.
- No `allowpopups` webview attribute is introduced.

Run:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r6-popup-as-tabs-operator-toggle.mjs
npm run verify:pass-271-r6-popup-as-tabs-operator-toggle
npm run build
npm run dev
```
