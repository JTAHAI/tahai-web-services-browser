# PASS243 — Maximized Overlay Layering Polish

This pass tightens visual containment for two polished operator surfaces after maximize/restore:

- **Ctrl+K / Operator Command Center**: keep diagnostics and command rows visually separated with more opaque layered surfaces and list containment.
- **Mission Control**: prevent upper layout controls from ghosting through cards by isolating workbench sections and increasing panel opacity.

Scope is renderer-only polish. No backend, security model, or packaging contract changes.
