# PASS113 — Adaptive Chrome Density Summary

PASS113 continues browser-side hardening from PASS112.

## Delivered

- Tightened the PASS112 titlebar-tabs chrome.
- Added a formal CSS density contract for titlebar height, caption-button reserve, and toolbar height.
- Kept OS-owned titlebar controls through Electron `titleBarOverlay`.
- Preserved draggable topbar behavior while explicitly marking tabs, close buttons, new-tab, toolbar controls, inputs, flyouts, and overflow menu as non-draggable.
- Hardened responsive toolbar overflow so secondary controls move to More Tools before they crowd the address bar.
- Added dynamic collection for Site View / bookmark controls that appear after startup.
- Kept core navigation, address routing, DevOps, IT Tools, and Mission Control visible.
- Added `verify:pass-113-adaptive-chrome-density` and wired it into `verify:release-blockers` after PASS112 and before final build.

## Version

Version remains `1.8.30`.

## Scope held

Browser-side UX/source hardening only. No IT Docs backend, no PSA connector work, no secrets, no generated artifacts.
