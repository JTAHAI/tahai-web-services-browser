# PASS198 — Mission Recipe Library v2

PASS198 upgrades the Mission Recipe Library from simple launch blueprints into enterprise operator templates.

## Scope

The v2 recipe layer keeps the existing ten local-only Mission templates, but adds the information an operator needs before using them during real administrative or release work:

- operator intent
- risk tier
- human approval requirement
- preflight gates
- pane intent for Quad View
- evidence checklist
- recovery actions
- handoff sections
- export profiles
- policy locks

## Recipes covered

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
- Local-only by default.
- Human approval required for each v2 recipe.
- No direct PSA API calls.
- No provider credentials or secret storage.
- No automatic vendor/ticket writeback.
- No private-key or credential export path.
- Every recipe has stop gates before risky work continues.
- Every recipe has evidence prompts and recovery actions.

## Runtime integration

`src/shared/mission-recipe-library-v2-contract.ts` is the canonical v2 contract. The renderer imports that contract and exposes v2 truth through safe UI metadata:

- `data-pass198-recipe-v2`
- `data-pass198-risk-tier`
- `data-pass198-preflight-gates`
- `data-pass198-evidence-items`
- `data-pass198-policy-locks`
- `data-pass198MissionRecipeLibraryV2`
- `data-pass198MissionRecipeLibraryV2Summary`

The Ops Panel and Mission Control recipe cards now surface the v2 preflight/evidence posture without adding secrets, credentials, or backend dependencies.

## Verification

Run:

```powershell
npm run verify:pass-198-mission-recipe-library-v2
```

The verifier checks v2 coverage for all ten canonical recipes, required enterprise fields, local-only/security invariants, renderer integration, release-blocker ordering, docs, and generated-artifact exclusion.

## Version truth

Version remains `1.8.30`. This is source hardening only and does not claim GA, installed-app proof, signing, or package verification.
