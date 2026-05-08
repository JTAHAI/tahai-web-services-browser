# PASS116 — Overlay Arbitration Guard

PASS116 hardens the adaptive browser chrome by preventing fixed operator surfaces from stacking on top of each other.

## Changed

- Added `data-pass116-overlay-arbitration="true"` to the renderer body.
- Added a renderer-local `tahai:chrome-overlay-open` arbitration event.
- More Tools announces itself and closes when another chrome overlay opens.
- DevOps / IT command lanes announce themselves and close other chrome overlays.
- Ops Panel announces itself and closes More Tools, command lanes, and Site View.
- Site View Mission Rail announces itself and closes More Tools, command lanes, and Ops Panel.
- Mission Control announces itself and closes chrome overlays before opening the modal workspace.
- Added CSS no-drag and hidden-state safeguards for arbitrated overlays.
- Added `verify:pass-116-overlay-arbitration`.
- Wired PASS116 into `verify:release-blockers` after PASS115 and before the final build.

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
