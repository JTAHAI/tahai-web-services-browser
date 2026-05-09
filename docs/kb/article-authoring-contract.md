# TAHAI Browser KB Authoring Contract

This KB is source-controlled product documentation for the local Guide / Knowledge Base surface.

## Required article shape

Every article must include:

1. A single `#` title matching the KB manifest title.
2. A `Screenshot target` line with the expected `docs/kb/screenshots/*.png` path.
3. A `Screenshot capture checklist` section.
4. A `What this feature does` section.
5. A `How to use it` section.
6. A `Safety notes` section.

## Screenshot rule

Screenshot placeholders are source. Real screenshots are allowed only after review and only when sanitized for public/user-facing documentation. Do not add runtime profiles, private customer pages, cookies, tokens, local paths, generated installers, package outputs, or build artifacts.

## In-app KB rule

The shipped `browser/onboarding/index.html` page must remain local-first and source-reviewable. It should not depend on online services to explain core features.

## Sync rule

When an article is renamed or added, update all of these together:

- `docs/kb/articles/*.md`
- `docs/kb/README.md`
- `docs/kb/screenshot-manifest.json`
- `browser/onboarding/kb-manifest.json`
- `browser/onboarding/index.html`
- `scripts/verify-pass-130-kb-screenshot-intake.mjs`


## PASS131 search metadata rule

Every KB article must have matching keyword/search metadata in `browser/onboarding/kb-manifest.json`, `docs/kb/search-index.json`, and the in-app article `data-kb-search` attribute. Search metadata must remain generic and must not include customer names, tokens, secrets, tenant IDs, runtime profile paths, or local workstation data.

## PASS135 screenshot ingestion rule

Every article screenshot reference must stay manifest-driven. The canonical capture lives in `docs/kb/screenshots/`; the in-app mirror lives in `browser/onboarding/screenshots/` and must be populated by `npm run kb:screenshots:ingest -- --apply`, not by ad-hoc file drops. Article HTML must continue to use `data-screenshot-id` placeholders so missing screenshots remain valid.


## PASS136 navigation rule

Each article with a screenshot slot must remain discoverable by normal text search and by screenshot status filters. Missing screenshots must never hide the article or fail the build.
