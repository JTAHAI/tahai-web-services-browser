# PASS179 — More Tools Overflow Clarity

PASS179 hardens the compact chrome UX after PASS177/PASS178 by making More Tools explain what happened when secondary controls move out of the toolbar.

## Changed

- Added a More Tools overflow count badge.
- Added runtime `toolbar-clear`, `responsive`, and `viewport-forced` mode markers.
- Updated the More Tools `aria-label`, `title`, and tooltip text with moved-control counts.
- Added a subtle forced-overflow visual state for viewport-budget recovery.
- Added explanatory More Tools copy so compact recovery does not look like a mystery icon.
- Added `verify:pass-179-more-tools-overflow-clarity` to the release-blocker chain.

## Security / scope

- Browser-side UI hardening only.
- No IPC changes.
- No external-open changes.
- No secrets or generated artifacts.
- Version remains `1.8.30`.
