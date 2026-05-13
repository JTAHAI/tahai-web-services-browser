# PASS193 — Bookmarks and Admin Launch Reliability

PASS193 hardens bookmark, Admin Console Profile, and Mission Recipe launch paths.

## Changed

- Added `src/shared/bookmark-admin-launch-reliability-contract.ts` as the PASS193 source-truth contract.
- Added launch-source diagnostics for bookmark/admin/recipe surfaces.
- Added `pass193FindLaunchRecipe()` so recipe/profile IDs resolve before profile switching or tab closeout.
- Added safe missing/duplicate/coming-soon launch handling so unavailable IDs no-op visibly.
- Added `pass193SanitizeBookmarkMissionDetail()` to revalidate bookmark Mission event payloads.
- Converted bookmark Mission dispatch to the named PASS193 event constant.
- Reworked single-bookmark Mission dispatch to build a sanitized manifest instead of interpolating raw title/URL text.
- Added PASS193 verifier and release-blocker wiring.

## Verification

- `npm run verify:pass-193-bookmarks-admin-launch-reliability` passes in this source tree.
- PASS193 is wired into `verify:release-blockers` after PASS192.

## Not claimed

Installed Windows behavior still requires the local installed-app smoke pass. PASS193 is a source and static-verifier hardening pass, not a GA or installed-runtime attestation.
