# PASS108 — Mission Pane Movement Overlay Repair

PASS108 closes the remaining Mission View movement failure where pane drag/drop could be swallowed by Electron webview guest surfaces.

- Added explicit PASS108 pane swap targets above native webviews.
- Click `Move` on a Mission pane, then click a highlighted pane target to swap panes.
- Existing drag and click-to-swap paths remain, but pane movement no longer depends on webview drag/drop hit-testing.
- Pane swaps now run the full Mission Layout renderer before settle/repair scheduling.
- Browser tab-to-pane assignment and Mission tab-to-pane movement now schedule PASS107 viewport settle.
- PASS108 state is inspectable through `data-pass108-pane-move-mode` and `data-pass108-last-pane-swap` markers.
