# PASS 59 — Mission Pane Close Polish

Adds Mission Control pane-close UX behavior:

- Adds configurable pane close behavior:
  - `Auto-refactor`: when a pane closes, remaining assigned panes collapse to the best layout. A 2-Up with one pane closed becomes Focus/1-Up.
  - `Leave blank panes`: closing a pane removes the mission tab assignment but leaves the current Mission layout available for a new site.
- Adds a visible `Close active pane` control in the Mission layout area.
- Adds per-pane close buttons for active assigned panes.
- Makes existing Mission tab remove buttons easier to hit.
- Stores the preference locally in `localStorage` under `tahai.browser.missionPaneCloseBehavior`.

The feature remains browser-side/local-only and does not add secrets, backend calls, PSA connectors, or IT Docs writeback.
