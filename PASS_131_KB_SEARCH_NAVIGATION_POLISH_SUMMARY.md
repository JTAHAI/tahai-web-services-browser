# PASS131 — KB Search and Navigation Polish

## Purpose

Make the Guide / Knowledge Base easier to use before screenshot ingestion by adding local search, quick filters, search-aware navigation, and a verifiable source search index.

## Changed

- Added a local-only search panel to the in-app KB.
- Added `browser/onboarding/kb-search.js`.
- Added `docs/kb/search-index.json`.
- Added KB keywords/status metadata to `browser/onboarding/kb-manifest.json`.
- Updated PASS129 and PASS130 verifiers to allow only the self-hosted deferred KB search script.
- Added `scripts/verify-pass-131-kb-search-navigation-polish.mjs`.
- Wired PASS131 into `verify:release-blockers`.

## Security posture

No remote scripts, inline scripts, fetch/XHR/beacon telemetry, cookies, localStorage, runtime profiles, generated installers, or screenshots are introduced.

## Version

1.8.30 unchanged.
