# PASS78 — Mission View Deterministic UX Guard

PASS78 rebuilds the Mission View command-dock hardening from PASS77 into a deterministic movement and repair surface.

## Added

- Selected-pane mover in the Mission pane command dock:
  - Move from
  - to
  - Swap selected panes
- Doctor button in the command dock.
- Keyboard repair shortcuts:
  - `Ctrl+Alt+Shift+D` — Mission View Doctor
  - `Ctrl+Alt+Shift+R` — Repaint / Fit
- Command-palette entries for Doctor and Repaint / Fit.
- Autosize-off guest sizing guard for Mission webviews.
- Bounds audit/self-correction checks for short or cut-off guest surfaces, stale autosize/min/max attributes, stale webview parent placement, stale move/drop/click-swap overlay state, and command-dock selected source/target drift.
- `scripts/verify-pass-78-mission-view-deterministic-ux-guard.mjs`.
- `verify:pass-78-mission-view-deterministic-ux-guard` wired into `verify:release-blockers`.

## Preserved

- Webviews remain direct stage children.
- Mission APIs remain browser-side only.
- No IT Docs backend work.
- No PSA connector work.
- No secrets, generated installers, dist, release, node_modules, runtime profiles, or local data added.
