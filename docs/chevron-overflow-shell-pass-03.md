# PASS 03 - Chevron Overflow Shell Cleanup

This pass removes native horizontal scrollbars from the browser shell controls and replaces them with explicit overflow controls.

## Main toolbar

The main toolbar is command-oriented, so lower-priority controls move into the right-side `>` overflow menu as the window narrows. Core browser controls remain visible: back, forward, reload, home, address bar, profile, DevOps, IT Tools, and Mission.

## Bookmarks / folder rail

The bookmarks/folder strip is content-oriented, so it uses left/right chevron buttons when the row overflows. Native scrollbars are hidden, but the row remains reachable by chevron clicks and mouse wheel movement.

## Guardrails

- Do not hide overflowing controls without an alternate access path.
- Do not bring back native horizontal scrollbars in shell rows.
- Keep DevOps, IT Tools, and Mission prominent.
- Keep keyboard and pointer access intact.
