# PASS137 — First-run walkthrough summary

Version: 1.8.30 unchanged.

PASS137 turns the KB/onboarding lane into a practical first-run path. The in-app Guide / Knowledge Base now includes a Start walkthrough panel, ordered feature steps, a new first-run walkthrough article, a new screenshot slot, and source/verifier coverage.

## Added

- `docs/kb/articles/first-run-walkthrough.md`
- `docs/kb/pass-137-first-run-walkthrough.md`
- `scripts/verify-pass-137-first-run-walkthrough.mjs`
- `19-first-run-walkthrough.png` screenshot slot in manifests/checklists

## Guardrails preserved

No IT Docs backend code, PSA connector work, direct PSA API calls, secrets, telemetry, remote scripts, cookies, localStorage, runtime profiles, generated installers, release output, dist output, or node_modules are added to source.
