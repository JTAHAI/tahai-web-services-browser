# PASS113 — Adaptive Chrome Density

PASS113 hardens the visible chrome after PASS112 moved tabs into the titlebar. The goal is to avoid replacing the removed native-titlebar clutter with a crowded address/command row.

## What changed

- Tightened the titlebar/tab row without replacing native Windows caption buttons.
- Kept Electron `titleBarOverlay` and the native minimize, maximize, and close controls.
- Added an explicit titlebar caption reserve so tab content does not run under Windows caption buttons.
- Made titlebar tab controls, tab close controls, new-tab control, toolbar buttons, inputs, flyouts, and overflow menu non-draggable.
- Promoted the existing toolbar overflow behavior into an adaptive chrome-density contract.
- Moves secondary controls into **More Tools** before they crowd the active address/pane-routing row.
- Keeps core navigation, address routing, DevOps, IT Tools, and Mission Control visible.
- Keeps Launchpad, Guide, Ops Panel, Site View, Bookmarks, Profile, Settings, and About usable through overflow when the window narrows.
- Adds a MutationObserver so dynamically inserted chrome controls, such as Site View and bookmark controls, are collected after startup.

## Security and architecture boundaries

PASS113 is renderer-shell UX hardening only. It does not add browser-side credentials, PSA connectors, IT Docs backend code, raw IPC, direct PSA calls, or webview privileges.

## Local verification

```powershell
Set-Location C:\dev\browser\app
npm run build
npm run verify:pass-113-adaptive-chrome-density
npm run verify:release-blockers
npm run dev
```

## Manual visual gates

- Native Windows title/menu bar is not visible.
- Native Windows caption buttons remain visible and usable.
- Dragging the open titlebar space moves the window.
- Tab click, tab close, and `+` new tab remain clickable.
- Address bar remains usable as the primary active-pane routing control.
- At narrower widths, More Tools appears and secondary controls remain usable there.
- Mission Control, DevOps, and IT Tools remain visible in the main toolbar.
