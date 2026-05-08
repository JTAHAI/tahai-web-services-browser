# PASS117 — Overlay Focus Recovery Guard

PASS117 hardens the adaptive chrome overlay stack by making focus behavior deterministic after PASS116 overlay arbitration.

## Changed

- Added `data-pass117-overlay-focus-recovery="true"` to the renderer body.
- Added PASS117 focus-scope markers for More Tools, command toolbars, Ops Panel, Mission Control, and Site View.
- More Tools now focuses its first available control when opened and returns focus to its launcher on Escape/explicit close.
- DevOps / IT command lanes now mark a focus scope and can restore focus to their launcher when closed from keyboard/back flows.
- Ops Panel now marks a focus scope, focuses into the panel when opened, and restores focus to the Ops Panel button on explicit close.
- Site View Mission Rail now marks a focus scope, focuses into the rail when opened, and restores focus to the Site View button on explicit close/Escape.
- Arbitration closes use `restoreFocus=false` so the newly opened overlay keeps keyboard focus.
- Added PASS117 focus-state CSS without touching webview or Mission pane routing surfaces.
- Added `verify:pass-117-overlay-focus-recovery`.
- Wired PASS117 into `verify:release-blockers` after PASS116 and before the final build.

## Guardrails preserved

- Browser-side work only.
- No IT Docs backend changes.
- No PSA connector work.
- No direct PSA API calls.
- No secrets or generated artifacts.
- No raw IPC.
- No `shell.openExternal` additions.
- No webview / Mission pane routing movement.

Version remains `1.8.30`.
