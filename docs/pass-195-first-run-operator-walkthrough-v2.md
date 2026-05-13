# PASS195 — First-Run Operator Walkthrough v2

## Purpose

Make first launch useful for an enterprise DevOps or IT admin operator in under ten minutes. The browser should teach normal mode first, then show why Mission Control exists, then guide the user through layouts, runbooks, tools, evidence, settings, and troubleshooting.

## Source changes

- Added `src/shared/first-run-operator-walkthrough.ts` as the typed local walkthrough contract.
- Extended first-run state with the operator walkthrough version, start anchor, privacy summary, and milestones.
- Routed Guide / KB entry points to the operator v2 anchor so a new user lands on the useful path first.
- Added the in-app **First 10 minutes** panel.
- Updated KB search and manifest metadata for the v2 walkthrough without remote scripts, telemetry, cookies, or browser storage.
- Removed visible development-pass labels from the public KB screenshot sections.
- Added verifier coverage for duplicate article prevention and public-copy cleanliness.

## Guardrails

- Local static guide only.
- No IT Docs backend code.
- No PSA connector code.
- No remote KB service.
- No telemetry.
- No cookies or browser storage.
- No generated release artifacts.
- Version remains `1.8.30`.

## Verification

Run:

```powershell
npm run verify:pass-195-first-run-operator-walkthrough-v2
npm run verify:release-blockers
```

Installed-app onboarding behavior remains a manual Windows/Linux gate.
