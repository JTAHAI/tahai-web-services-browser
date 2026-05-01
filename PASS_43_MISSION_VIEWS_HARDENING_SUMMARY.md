# PASS 43 — Mission Views hardening

- Added a persistent Mission pane HUD so 2-Up, 3-Up, 4-Up, and Focus views always show the active pane, pane role, and current pane title.
- Repaired Mission View routing helpers for visible panes, active pane normalization, tab-to-pane upsert, drag/drop assignment, right-click quick assignment, and Quad-from-tabs seeding.
- Hardened Focus pane restore behavior by routing Ctrl+Alt+F through the existing focus toggle instead of forcing a stateless layout change.
- Added a pass verifier and wired it into release-blocker verification.
