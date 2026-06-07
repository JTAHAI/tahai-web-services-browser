# PASS271-R3 — Normal Browsing Click Surface + Webview Visibility Repair

This is a release-blocker repair on top of PASS271-R2.

## Why

Installed/runtime smoke showed the browser chrome rendering while the website surface stayed black and click behavior was blocked. The screenshot showed the idle drag/drop guard text (`INTERNAL TAHAI DRAGS ONLY`) over the website surface, which means a helper layer was allowed to occupy or intercept the normal browsing plane.

## Fix

- Forces toolbar, status bar, dialogs, address bar, and runtime controls into `-webkit-app-region: no-drag` so Electron titlebar drag regions cannot swallow clicks.
- Forces the active normal browser `<webview>` to be visible, full-stage, top-left anchored, pointer-enabled, and above the dark stage background.
- Makes Mission pane drop zones click-through whenever an internal drag is not actively happening.
- Suppresses idle drag/drop pseudo-labels, including the `INTERNAL TAHAI DRAGS ONLY` visual, outside active drag state.
- Adds runtime inspection hook: `window.__TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE__`.
- Adds a fail-closed verifier that runs `npm run build`.

## Verify

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r3-normal-browsing-click-surface-repair.mjs
npm run verify:pass-271-r3-normal-browsing-click-surface-repair
```

## Release posture

No GA claim. No Store approval claim. No signed-release claim. Microsoft Store submission remains blocked until installed runtime smoke is clean.
