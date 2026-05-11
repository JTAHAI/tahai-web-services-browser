# PASS170 — Restore Focus Target Guard

PASS170 hardens the remaining restore-focus path after PASS169.

## Fixed

- More Tools restore-focus no longer directly focuses a launcher that may have been hidden or moved by responsive toolbar reflow.
- Mission Control close restore-focus now checks that the launcher is still mounted and visible.
- Command-toolbar lane close restore-focus now uses the same guard.
- Site View Mission Rail restore-focus now skips stale/hid/replaced launchers.
- Shared app overlay restore-focus now avoids jumping focus while another overlay is active.

## Guardrails

- No version increment.
- No raw IPC.
- No external-open behavior.
- No eval.
- PASS170 verifier added to release blockers before the final build.
