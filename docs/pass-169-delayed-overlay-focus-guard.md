# PASS169 — Delayed Overlay Focus Guard

## Purpose
Prevent stale focus timers from refocusing hidden or already-replaced overlays after rapid compact-window open/close cycles.

## What changed
- More Tools delayed first-focus now checks that the menu is still open, connected, and aria-visible before focusing.
- App overlay focus recovery now checks that the target surface is still connected, visible, and not a closed dialog.
- Site View delayed focus now checks that the rail is still open and visible before focusing.
- Remaining module-specific overlay runtime markers were aligned from `ready` to `true` so runtime state stays consistent with CSS-active guards.

## Verification
Run:

```bash
npm run verify:pass-169-delayed-overlay-focus-guard
npm run typecheck
npm run build
```

Version remains `1.8.30`.
