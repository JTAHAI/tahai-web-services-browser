# PASS130 — KB Screenshot Intake Hardening

PASS130 hardens the Knowledge Base created in PASS129 so it is ready for user-provided screenshots without guessing where each image belongs.

## Scope

- Browser-side documentation/source only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No secrets, tokens, runtime profiles, generated installers, package outputs, or local data.
- No real screenshots are committed in this pass.

## Added

- `docs/kb/screenshot-manifest.json` — machine-readable screenshot intake contract.
- `docs/kb/screenshot-intake.md` — human checklist for the screenshots still needed.
- `docs/kb/article-authoring-contract.md` — article shape and sync rules.
- Expanded every KB article with a screenshot capture checklist.
- Expanded the in-app Guide / KB page with screenshot placeholder prompts and a capture checklist.
- Added `verify:pass-130-kb-screenshot-intake` and wired it into `verify:release-blockers`.

## Why

The KB needs screenshots for the main browser features, but the repo should not accept random captures, private pages, or generated/runtime data. PASS130 makes each required screen explicit and verifies that the docs, shipped KB page, article source, and manifest stay synchronized.

## Screenshot rule

Real screenshots may be added later only after review and only when sanitized for public/user-facing KB use. Add approved PNGs to both:

- `docs/kb/screenshots/`
- `browser/onboarding/screenshots/`

Do not add screenshots that reveal customer data, private URLs, account identifiers, auth state, cookies, secret material, local filesystem paths, generated installers, `dist/`, `release/`, `node_modules/`, `.git`, or runtime browser profiles.
