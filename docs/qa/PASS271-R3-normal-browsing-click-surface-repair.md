# PASS271-R3 QA — Normal Browsing Click Surface + Webview Visibility Repair

Acceptance gate:

- Normal 1-Up browsing displays the website in the content pane.
- Browser chrome remains clickable.
- Address bar remains editable and routes to the active tab/pane.
- DevOps / IT Tools / Ops Panel / Mission / Settings buttons can be clicked.
- The stage does not show an idle `INTERNAL TAHAI DRAGS ONLY` overlay.
- Mission pane drop targets only receive pointer events during active internal drag.
- `npm run build` passes.

Manual installed-app smoke:

1. Open the installed app.
2. Navigate to `https://tahaiportal.com/`.
3. Confirm the site is visible and clickable.
4. Click Home, Launchpad, Guide, DevOps, IT Tools, Ops Panel, Mission, Settings.
5. Confirm no invisible layer blocks clicks.
6. Drag a tab only inside Mission mode and confirm drop targets appear only during the drag.
