# PASS118 — Overlay Dismiss Recovery Guard

PASS118 closes the next UX/control-plane gap after PASS116 overlay arbitration and PASS117 focus recovery.

## Implemented

- Shared `tahai:chrome-overlay-close-all` event.
- Global Escape recovery for the active chrome overlay.
- Stale overlay-state audit/cleanup for `data-pass116-active-overlay`.
- More Tools participates in the shared close-all event.
- DevOps / IT command lanes close through the shared recovery path.
- Ops Panel closes through the shared recovery path.
- Site View Mission Rail participates in the shared close-all event.
- Mission Control now has a dedicated close helper that clears PASS117/PASS118 focus state and restores launcher focus on explicit close.
- PASS118 CSS keeps all dismissal boundaries non-draggable and prevents hidden `aria-hidden` overlays from receiving pointer events.
- Added `verify:pass-118-overlay-dismiss-recovery` and wired it into `verify:release-blockers` after PASS117 and before final build.

## Version

Version remains `1.8.30`.
