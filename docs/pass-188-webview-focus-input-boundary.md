# PASS188 — WebView Focus and Input Boundary Hardening

PASS188 closes the enterprise UX gap where keyboard or mouse input can appear to disappear after focus moves into a remote Chromium `<webview>`, Mission pane, overlay, tool menu, or Command Center surface.

## Scope

- Preserve browser-shell accelerators when focus is inside a remote guest page.
- Record which focus surface currently owns input.
- Make Mission pane clicks/focus transitions update the active pane target.
- Add a typed main-to-renderer input-boundary event instead of exposing raw IPC.
- Keep `Ctrl/Cmd+L`, `Ctrl/Cmd+K`, `Alt+Left`, `Alt+Right`, `Ctrl/Cmd+Alt+1..4`, and `Escape` recoverable from webview focus.
- Add source-visible focus/input diagnostics through `data-pass188-*` attributes.

## Guardrails

- Remote content remains untrusted.
- No Node integration is added to webviews.
- No raw `ipcRenderer` exposure is added.
- Main process sends only a typed, allowlisted `tahai-browser:pass188-input-boundary` payload.
- The renderer reuses existing safe command handlers and active-pane routing instead of adding duplicate navigation logic.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-188-webview-focus-input-boundary
npm run verify:release-blockers
```

Manual installed-app smoke:

1. Open any remote site in a normal tab.
2. Click inside the page, then press `Ctrl+L`; the address bar should focus and select.
3. Click inside the page, then press `Ctrl+K`; Command Center should open.
4. In Mission Control, click inside a pane webview, then use `Ctrl+Alt+1..4`; active pane should update.
5. In Mission Control, click inside a pane webview, then use `Alt+Left` / `Alt+Right`; navigation should route through the active-pane truth matrix.
6. Open More Tools, Mission Control, or another overlay, then press `Escape`; the overlay should close and focus should return to a safe opener/shell surface.

Version remains `1.8.30`.
