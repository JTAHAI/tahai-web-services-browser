# PASS183 — More Tools Overlay Collision Recovery

PASS183 continues compact-chrome UX hardening by closing a deeper overlay collision and focus regression class.

## Fixed

- More Tools now detects when a dialog or command panel opens while More Tools is active.
- More Tools closes immediately without restoring focus back to its launcher, preventing stale focus jumps.
- Overlay collision telemetry is exposed through `data-pass183-more-tools-overlay-collision-*` runtime markers.
- Hidden More Tools surfaces remain pointer-safe.

## Verified

- `npm run verify:pass-183-more-tools-overlay-collision-recovery`
- `npm run verify:pass-182-compact-hit-target-focus`
- `npm run build`

Version remains `1.8.30`.
