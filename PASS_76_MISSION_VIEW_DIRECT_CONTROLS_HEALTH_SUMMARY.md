# PASS76 — Mission View Direct Controls + Health Doctor

Browser-side Mission View UX hardening only.

- Direct stage-level Move control layer so pane movement controls are not children of pointer-events-none overlay shells.
- Autosize off for Mission webviews to avoid short guest viewport / black lower-half cutoff.
- Removes min/max webview attribute traps and preserves explicit CSS pixel bounds.
- Adds two-frame resize nudge when pane bounds change.
- Adds pane health signature + repair loop after layout, load, dom-ready, resize, and visibility events.
