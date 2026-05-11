# PASS177 — Website Pane Viewport Recovery

Version remains `1.8.30`.

## Purpose

Fix the compact-window UI regression where browser chrome can expand until the website/webview content is reduced to a thin horizontal sliver at the bottom of the window.

## What changed

- Adds a PASS177 runtime marker: `data-pass177-site-viewport-recovery="true"`.
- Hard-caps the titlebar, toolbar, and statusbar rows so they cannot consume the page viewport.
- Preserves Chromium bookmarks support with a separate 5-row grid when the bookmarks bar is installed.
- Forces utility controls into More Tools when measured chrome height would leave too little webview space.
- Publishes runtime diagnostics for measured chrome height, measured webview height, chrome share, and forced-overflow reason.
- Keeps More Tools, command toolbar, Ops Hub, and Site View rail bounded to the remaining viewport.

## Acceptance

- The website pane remains the primary surface after resizing.
- Compact widths do not wrap the toolbar into a multi-row chrome stack.
- More Tools remains the overflow destination for secondary controls.
- No raw IPC, external open, PSA connector, or secret-handling behavior was added.
- The release version remains unchanged.

## Local verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-177-website-pane-viewport-recovery
npm run build
```

Manual UI check should include at least 960x640, 1024x768, 1366x768, maximized, and restored/non-maximized windows.
