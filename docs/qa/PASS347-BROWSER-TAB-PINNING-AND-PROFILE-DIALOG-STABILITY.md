# PASS347 Browser Tab Pinning + Profile Dialog Stability

## Purpose

PASS347 upgrades TAHAI's daily-driver tab flow so the browser behaves more like a serious Chromium workbench while also hardening the restored-window `Default` / profile dialog bug that could flash open and close on smaller non-maximized windows.

## Scope

- Browser tab pinning:
  - Tab-strip pin hit target
  - Browser Kit pin action
  - Pinned tabs reorder to the front of the strip
  - Pinned state survives recently-closed recovery and session restore
- Browser tab switching:
  - `Ctrl+Tab`
  - `Ctrl+Shift+Tab`
  - `Ctrl+1..9`
  - Native History menu wiring for next/previous/pin
  - Command Palette entries for pin/next/previous
- Browser Kit layout hardening:
  - restored-window Browser Kit panel stacks sections vertically and keeps pin/tab/session cards in internal multi-row grids
  - Browser Kit avoids the shallow horizontal command rail that clipped cards at 1366x768
  - Browser Kit skips DevOps/IT command-rail chevrons/back-button chrome so cards own their full hit targets
- Profile dialog hardening:
  - explicit viewport-fit repair before/after open
  - extended restored-window settle guard before dismissing clipped profile overlays
  - built-app coverage that keeps the dialog open long enough to catch the flash-close regression

## Guardrails

- No `allowpopups`
- No Node in remote content
- No raw IPC widening
- No remote session sync
- No PSA/API/provider secrets
- Pinning is renderer-local shell state only and remains profile-scoped through the existing session recovery model

## Acceptance

- Pin Active Tab works from Browser Kit
- Browser Kit cards stay fully visible and clickable in restored desktop windows, including `1366x768`
- Clicking the tab pin glyph toggles pinned state without breaking drag, close, or activation
- Pinned tabs move to the front of the strip and remain reachable
- `Ctrl+Tab` and `Ctrl+Shift+Tab` cycle visible tabs in strip order
- `Ctrl+1` focuses the first visible tab and `Ctrl+9` focuses the last visible tab
- Reopened closed tabs restore pinned state when applicable
- Restore Last Session preserves pinned state when a saved snapshot contains it
- The profile dialog remains open in restored windows long enough to interact with it instead of flashing closed
- PASS345 built-app Playwright coverage and PASS158 runtime E2E both exercise the new tab flow
