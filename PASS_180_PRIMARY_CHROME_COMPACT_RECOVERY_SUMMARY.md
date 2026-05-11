# PASS180 — Primary Chrome Compact Recovery

Completed after PASS179.

## Purpose

Prevent the always-visible primary toolbar controls from crowding the address bar or threatening the website pane after secondary controls have already moved into More Tools.

## What changed

- Home and Mission now have compact-safe icon/label markup while preserving their existing IDs and actions.
- DevOps, IT Tools, Home, and Mission condense into tighter enterprise square controls when the window or address budget is tight.
- Added runtime compact-state markers for verification and future diagnostics.
- Added CSS-only label hiding that preserves accessible labels and titles.
- Added PASS180 verifier and release-blocker integration.

## Verification

- `npm run verify:pass-180-primary-chrome-compact-recovery`
- `npm run verify:pass-179-more-tools-overflow-clarity`
- `npm run build`

Version remains `1.8.30`.
