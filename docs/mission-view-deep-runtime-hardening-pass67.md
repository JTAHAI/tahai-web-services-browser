# PASS67 — Mission View deep runtime hardening

Purpose: repair runtime layout regressions observed after the asymmetric Tri View and universal pane reorder passes.

Fixes:

- Removes the bulky Tri View behavior panel from Mission Control and replaces it with compact inline 3-Up variant controls.
- Hides Tri View variant controls when there is no active mission.
- Preserves an explicitly selected 3-Up/4-Up layout when a tab is dropped into an empty pane, instead of collapsing the view down to split view based only on current tab count.
- Adds a bounding-box pane lookup for drag targets, so pane moves are not dependent only on native HTML5 drag/drop over embedded web content.
- Adds click-to-arm/click-to-target pane swap fallback for environments where BrowserView/webview surfaces swallow drag events.
- Keeps Ctrl+Alt+1..4 pane focus registered on both window and document capture paths.
- Adds responsive pane-grid CSS for smaller windows and short displays.
- Keeps the prior layout-set event repair and strict DOM-safe handle typing.

Operator note: pane dragging remains handle-only. If an embedded browser surface swallows drag/drop, click a pane's Drag Pane handle once to arm it, then click the target pane's Drag Pane handle to swap.
