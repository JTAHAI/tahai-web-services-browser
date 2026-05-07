# PASS66 — Mission View pane runtime repair

PASS66 repairs the PASS64/PASS65 Mission View runtime issues reported during Windows testing.

## Fixes

- Protects Mission Control recipe/runbook/tabs/evidence panels from being treated as draggable browser panes.
- Confines the asymmetric Tri View grid CSS to real Mission View pane containers only.
- Keeps Tri View controls compact and mounted inside the layout toolbar instead of breaking the Mission Recipes area.
- Adds pointer-event drag fallback for Electron/webview panes so pane reorder works even when native HTML5 drag is unreliable.
- Adds Ctrl+Alt+1..4 pane focus routing for visible panes.
- Removes the aggressive PASS64 refresh interval and relies on MutationObserver plus render-triggered refresh.
- Retains PASS65 strict DOM typing repair.

## Commands

```powershell
Set-Location C:\dev\browser\app
npm run pass66:apply
npm run verify:pass-66-mission-view-pane-runtime-repair
npm run verify:pass-65-triview-tsdom-repair
npm run verify:pass-64-triview-repair-hardening
npm run verify:pass-63-triview-pane-reorder
npm run build
```
