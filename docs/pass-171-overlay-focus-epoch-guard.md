# PASS171 — Overlay Focus Epoch Guard

PASS171 hardens the next weak surface after PASS170: delayed focus callbacks that are state-checked but not tied to the specific overlay open generation that scheduled them.

## Weak surface

A delayed focus timer from an older More Tools, Site View, or Ops Hub open cycle could still fire during a later open of the same overlay type. Even with hidden-state checks, that old timer could focus an outdated target after compact-window relayout, close/reopen cycles, or rapid overlay switching.

## Fix

- Add source-specific focus epochs for More Tools and Site View.
- Add an app overlay focus epoch for Ops Hub/app-owned overlay focus recovery.
- Bump epochs on overlay open and close/clear.
- Require delayed focus callbacks to match the current epoch and active overlay source before focusing.
- Add PASS171 verifier coverage and include it in release blockers.
