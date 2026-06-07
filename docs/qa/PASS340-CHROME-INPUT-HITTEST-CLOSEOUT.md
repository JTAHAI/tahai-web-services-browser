# PASS340 - Chrome Input Hit-Test Closeout

## Purpose

PASS338 proved the webview guest/load path is alive and removed the white surface owner. PASS339 removed stale Mission drag/drop overlay residue from normal browsing. The remaining runtime symptom was browser chrome still not accepting clicks. PASS340 hardens the adjacent surface: chrome hit-test ownership versus the native Electron webview layer.

## Changes

- Adds a bounded renderer runtime closeout owner: `PASS340_CHROME_INPUT_HITTEST_CLOSEOUT`.
- Samples primary chrome controls with `document.elementFromPoint()` and records blockers.
- Forces topbar, toolbar, tabs, address, and statusbar controls to high z-index, pointer-enabled, no-drag click targets.
- Forces the normal active webview to block-display geometry contained inside `#webview-stage`.
- Temporarily pauses webview pointer ownership while the pointer is over browser chrome.
- Schedules recovery after tab creation, `dom-ready`, `did-stop-loading`, resize, focus, and short startup settle windows.
- Updates the PASS339 verifier so the normal webview display contract may be `block` or `inline-flex`; PASS340 uses `block` for Electron guest paint reliability.

## Security guardrails

- No unsafe `allowpopups`.
- No Node in remote content.
- No raw IPC exposure.
- No direct PSA/API/provider calls or secrets.
- PASS271_R4 remains opt-in only.

## Verification

```powershell
Set-Location D:\dev\browser\app
npm run build
npm run verify:pass-337-cursor-root-cause-closeout
npm run verify:pass-338-cursor-runtime-root-cause-closeout
npm run verify:pass-339-normal-browsing-input-paint-closeout
npm run verify:pass-340-chrome-input-hittest-closeout
npm run dev
```

## Runtime probes

```js
window.__TAHAI_PASS340_CHROME_INPUT_HITTEST_CLOSEOUT__?.sample('manual')
window.__TAHAI_PASS340_CHROME_INPUT_HITTEST_CLOSEOUT__?.lastReport()
document.body.dataset.pass340LastChromeBlocker
document.body.dataset.pass340BlockedChromeControlCount
document.body.dataset.pass340ActiveWebviewRect
document.body.dataset.pass340StageRect
```

Healthy runtime: toolbar buttons click, address field focuses, Guide/DevOps/IT Tools/Settings open, and `blockedControlCount` is `0` or transiently recovers to `0` after settle.
