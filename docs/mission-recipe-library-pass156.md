# PASS156 — Mission Recipe Library v1

PASS156 adds a first-class Mission Recipe Library for the enterprise DevOps and IT Admin browser lane.

## Scope

Mission recipes are safe, local-first launch blueprints. They open approved HTTPS surfaces, create local Mission state, seed runbook steps, and add evidence prompts. They do not store credentials, secrets, bearer tokens, OAuth refresh tokens, PSA API keys, cookies, or private customer data.

## Recipes added

- DNS Migration
- Microsoft 365 User Offboarding
- Firewall Change
- Production Deployment
- Certificate Renewal
- Incident Triage
- GitHub Actions Release
- Cloudflare Cutover
- New Workstation / Admin Setup
- Vendor Support Handoff

## Enterprise guardrails

- Browser-side only.
- No direct PSA API calls.
- No IT Docs backend work.
- No provider credentials or secrets.
- HTTPS launch surfaces only.
- At most four launch URLs per recipe so Mission panes stay deterministic.
- Every recipe includes a stop condition before risky operational work continues.
- Every recipe includes runbook steps and evidence prompts for handoff.
- No generated release artifacts.
- Evidence profiles are limited to change-record, incident-packet, sanitized-handoff, and internal-markdown.

## Runtime integration

`src/shared/mission-recipes-contract.ts` is the canonical PASS156 source. The renderer maps that library into existing Launch Recipe and Mission Recipe UI through `missionRecipeLibraryToLaunchRecipe()`. The existing Mission start flow opens the URLs, assigns pane roles, seeds the runbook, adds evidence prompts, and saves a local-only mission.

## Verification

Run:

```powershell
npm run verify:pass-156-mission-recipe-library
```

This verifier checks the contract, the ten required recipes, renderer integration, release-blocker ordering, no secret-bearing literals, no direct PSA fetches, no unsafe popup/external-open additions, and no generated release artifacts.
