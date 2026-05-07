# PASS99 — Mission Drop Boundary

PASS99 hardens Mission drag/drop handling so external files, URLs, HTML, and text payloads cannot become Mission pane assignments or Mission tab reorder inputs.

## Hardened source surfaces

- Added `src/shared/drop-boundary.ts` as the shared drop/drag policy.
- Browser tab drags now write only TAHAI internal MIME payloads plus a non-sensitive text marker.
- Browser tab drag no longer exposes the tab URL through `text/plain`.
- Mission pane drop zones accept only internal browser-tab or mission-tab payloads.
- Mission tab list reorder accepts only internal mission-tab payloads and verifies the payload matches the active drag source.
- Renderer shell blocks external file / URL / HTML / text drops at capture phase.
- Settings UI exposes the PASS99 drop boundary contract.

## Security posture

External drops are blocked by default. Operators must use explicit navigation, import, save, or export controls instead of dragging arbitrary files/URLs/HTML into Mission surfaces.
