# PASS106 — Site View / Tri View Binding Repair

PASS106 fixes the real Site View and Mission View 3-Up failure path without adding another decorative runtime doctor.

## What changed

- Browser tab buttons and Electron webviews now carry the same stable browser tab ID.
- Site View rail snapshots pair cards to webviews by stable browser tab ID instead of relying on DOM order.
- Site View `Send to Pane` now emits a local shell event with `{ browserTabId, paneId }`.
- The app shell receives that event and assigns the exact browser tab into the requested Mission pane through the existing Mission pane upsert path.
- The old rail-side delayed active-tab activation + hidden button click path is no longer used for Site View pane sends.
- Mission View 3-Up/tri-view pixel layout, viewport fit, relayout retries, and direct pane controls are rescheduled when the Site View rail opens, closes, changes side, changes density, or sends a tab to a pane.
- The Site View verifier was updated so it verifies the new event bridge instead of requiring the old hidden-button click path inside the rail.
- `verify:pass-106-site-view-triview-binding` was added and wired into `verify:release-blockers`.

## Guardrails preserved

- Browser-side only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No raw IPC exposure.
- No shell/open-external expansion.
- No generated artifacts or secrets in source.
- Version remains `1.8.30`.
