# PASS86 — Source Contract Sentinel

PASS86 hardens TAHAI Web Services Browser across all operator/browser surfaces by adding a stricter Source Contract Sentinel.

## Scope

Browser-side only. No IT Docs backend work, no PSA connector work, no direct PSA API calls, no secrets, and no generated artifacts.

## Added

- `source-contract-sentinel` command.
- `copy-source-contract-sentinel` command.
- `Ctrl+Alt+Shift+X` runtime shortcut.
- Prior guard mount audit for PASS81 through PASS85.
- Source contract markers for shell, tabs, address routing, webview stage, Ops Hub, command palette, Mission dialog, keyboard shortcuts, DevOps/IT tool lanes, launch recipes, Mission recipes, and Mission command dock.
- Command registry coverage and duplicate command ID checks.
- Shortcut presence and shortcut collision checks.
- Launch recipe ID, URL, and protocol contract checks.
- Active pane / visible pane repair and webview security contract repair.
- Redaction-required boundary repair for textareas.
- Dialog Escape/ARIA contract repair.
- Status bar operator truth contract repair.
- Redaction-scanned PASS86 source contract report.
- `verify:pass-86-source-contract-sentinel`, wired into `verify:release-blockers`.

## Verification

Run locally from `C:\dev\browser\app`:

```powershell
npm ci
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:pass-86-source-contract-sentinel
npm run verify:release-blockers
npm run build
```
