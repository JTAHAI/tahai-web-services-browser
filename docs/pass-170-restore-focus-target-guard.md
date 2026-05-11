# PASS170 — Restore Focus Target Guard

## Issue found

PASS169 guarded delayed "focus the first control" timers, but close-time restore-focus paths still focused overlay launchers directly or through unguarded zero-delay timers.

That left a remaining compact-window bug class: if an overlay closed while another overlay opened, or if the toolbar reflow moved/hid the opener before the timer ran, the browser could refocus a hidden/replaced control. That can show up as flicker, focus jumps, or a click that appears not to stick.

Affected surfaces reviewed and hardened:

- More Tools
- Mission Control
- command toolbar lanes
- Site View Mission Rail
- Ops/app overlays that use the shared overlay-focus helper

## Fix

PASS170 routes restore-focus through guarded helpers that only focus an opener when it is still:

- mounted in the document,
- not disabled,
- not `aria-hidden`,
- not `hidden`,
- visibly rendered, and
- not superseded by a different active overlay.

Skipped and applied focus restores are recorded through PASS170 body dataset markers so the verifier can lock the behavior and future debugging has runtime truth.

## Verification

Run:

```powershell
npm run verify:pass-170-restore-focus-target-guard
npm run typecheck
npm run build
```
