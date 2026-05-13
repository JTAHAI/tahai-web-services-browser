# PASS241 — Responsive Modal + Command Palette Spacing Polish

Purpose: close the visible overlap in Ctrl+K Operator Command Center and reduce modal/card collisions across restored, maximized, and small-window conditions.

Changes:
- Compacts the Operator Command Center v2 panel inside Ctrl+K.
- Moves command-family cards behind an optional details expander instead of rendering the full dense grid by default.
- Adds contained grid/scroll behavior for the command palette.
- Adds wrapping, line clamps, and safe overflow handling for command rows, scope pills, disabled-reason pills, and shortcut labels.
- Adds shared modal max-width/max-height containment for Settings, Shortcut, Profile, Bundle, Dev, Ops, Capture, and text-input dialogs.

Boundary:
- No backend, IT Docs, PSA, package-signing, or store-submission changes.
- No generated release artifacts are part of the pass.
