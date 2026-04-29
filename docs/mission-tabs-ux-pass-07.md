# Pass 07 — Mission Tabs UX

This pass hardens Mission Tabs interaction without changing the browser-side-only security boundary.

## Delivered

- In-app Mission rename command using the existing safe dialog flow.
- Saved Mission duplicate/delete actions through typed preload and main-process IPC.
- Local Mission delete is constrained to validated mission IDs and the app-owned mission directory.
- Mission tab rows now support drag/drop reordering inside Mission Control.
- Mission tab rows gained pin/unpin and remove-from-mission actions.
- Focus Pane now restores the previous Mission layout instead of always falling back to Quad.
- Mission name normalization removes control characters and keeps names length-bounded.

## Guardrails preserved

- No native `prompt()`.
- No direct PSA connector code.
- No secrets or generated artifacts in source.
- Mission files remain validated in the main process before save/load.
