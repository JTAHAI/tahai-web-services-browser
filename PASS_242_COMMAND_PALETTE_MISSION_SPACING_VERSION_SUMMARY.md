PASS242 — Command Palette + Mission Control Spacing / Version 1.9.0

- Stabilized Ctrl+K after maximize/restore with command palette open guard and idempotent open behavior.
- Cleaned dense command palette row layout, diagnostics clamping, shortcut chip containment, and modal max-height behavior.
- Cleaned Mission Control card overlap in recipe, evidence, redaction, timeline, and command-card surfaces.
- Incremented app/release truth to `1.9.0` / `PASS242`.

Verification:
- npm run verify:pass-242-command-palette-mission-spacing-version
- npm run typecheck
- npm run build
