# PASS185 — Mouse History Button Parity

## Purpose

Restore engineering-grade navigation parity for hardware mouse Back/Forward buttons. DevOps and IT operators commonly use Mouse Button 4 and Mouse Button 5 while focused inside cloud consoles, docs, dashboards, tickets, and Mission panes. Those buttons must behave like toolbar Back/Forward and Alt+Left/Alt+Right.

## Hardened surface

PASS185 closes the gap where the previous renderer-level `mouseup` listener and BrowserWindow `app-command` handler could miss events when focus lived inside an Electron `<webview>`.

The pass adds:

- Main-process routing for browser history `app-command` events from shell and guest webContents.
- A safe focused-window/host-window resolver for webview-originated app commands.
- Renderer-level mouse history routing bound directly to each `<webview>` element.
- Capture-phase handling for `mousedown`, `mouseup`, and `auxclick` on Mouse Button 4/5.
- Dedupe guards so the same hardware click cannot navigate twice if multiple event paths fire.
- Active-tab promotion for the webview that received the hardware mouse button event.
- Active Mission pane routing remains centralized through `goBackTarget('mouse')` and `goForwardTarget('mouse')`.

## Guardrails

- No raw IPC exposure.
- No global mouse hook.
- No remote-page script injection.
- No direct DOM handler attributes.
- No change to navigation authority: mouse buttons still route through the existing active tab / active Mission pane resolver.
- Version remains `1.8.30`.

## Manual QA

1. Open a normal browser tab, navigate to at least two pages, click inside the page, then press Mouse Button 4.
2. Confirm the active page goes back.
3. Press Mouse Button 5 and confirm it goes forward.
4. Open Mission Control / Split or Quad View.
5. Click inside a non-default Mission pane webview.
6. Press Mouse Button 4/5 and confirm the active pane navigates, not a different pane or hidden tab.
7. Confirm toolbar Back/Forward and Alt+Left/Alt+Right still work.
