# PASS137 — First-run walkthrough

PASS137 adds a local-first first-run walkthrough to the Guide / Knowledge Base.

## Scope

- In-app walkthrough panel with Start walkthrough and ordered feature steps.
- New KB article: `docs/kb/articles/first-run-walkthrough.md`.
- New screenshot slot: `19-first-run-walkthrough.png`.
- Manifest/search/screenshot intake updates for the new article.
- Verifier: `npm run verify:pass-137-first-run-walkthrough`.

## Guardrails

The walkthrough is static local source. It does not add telemetry, remote scripts, cookies, browser storage, IT Docs backend behavior, PSA connector code, secrets, generated installers, runtime profiles, or local data.

## Version

1.8.30 unchanged.
