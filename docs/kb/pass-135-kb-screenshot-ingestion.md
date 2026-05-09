# PASS135 — KB Screenshot Ingestion

PASS135 turns the PASS130 screenshot checklist into an ingestible, verifier-backed workflow.

## Purpose

Allow sanitized KB screenshots to be added later without breaking source-only builds when screenshots are still missing.

## Source of truth

- Screenshot manifest: `docs/kb/screenshot-manifest.json`
- Canonical screenshot source: `docs/kb/screenshots/`
- In-app mirror: `browser/onboarding/screenshots/`
- Ingestion command: `npm run kb:screenshots:ingest -- --apply`
- Verification command: `npm run verify:pass-135-kb-screenshot-ingestion`

## Guardrails

- Only listed `.png` screenshots are accepted.
- PNG signatures are checked.
- Screenshots over 8 MiB are rejected.
- Unlisted files are rejected.
- Path traversal is rejected.
- Missing screenshots are allowed and keep awaiting-screenshot placeholders active.
- No runtime browser profiles, generated installers, customer data, local filesystem paths, credentials, cookies, tokens, or secrets belong in KB screenshots.

## Version

Version remains `1.8.30`.
