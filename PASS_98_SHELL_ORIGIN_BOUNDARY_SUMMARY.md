# PASS98 — Shell Origin Boundary

PASS98 closes the privileged first-party shell origin seam.

## Hardened

- Added `src/shared/shell-origin-boundary.ts`.
- Privileged `tahai-browser:*` IPC is no longer allowed for any generic `file://` page.
- IPC now requires an exact allowlisted TAHAI shell page URL with query/hash stripped.
- Main-window `will-navigate` now blocks arbitrary local file navigation and allows only packaged TAHAI shell pages.
- Remote/new-window handling remains behind the PASS94 navigation sanitizer.
- UI/source markers document the shell-origin boundary.

## Security effect

A malicious local file cannot gain browser settings, profile, mission, export, clipboard, or filesystem-handoff APIs merely because it is loaded through a `file://` URL in the shell window.
