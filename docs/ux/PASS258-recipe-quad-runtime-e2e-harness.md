# PASS258 — Recipe + Quad Runtime E2E Harness

PASS258 makes the recipe launch path testable instead of relying on visual confidence.

## Harness contract

The renderer exposes:

- `window.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_E2E__`
- `window.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__`
- `data-pass258-recipe-quad-runtime-contract`
- `data-pass258-recipe-count`
- `data-pass258-layout-sequence`

The verifier checks that every flagship recipe can produce a complete runtime scenario:

1. recipe card selected
2. mission started
3. mission name/type/layout present
4. runbook objective, rollback condition, and checklist present
5. evidence prompts present
6. timeline contains safe `recipe-start` event
7. pane count matches layout intent
8. every pane has role/title/URL/runtime tab ID/visible webview
9. all layouts in the stress sequence are represented
10. export preview requires redaction and contains no secrets

## Flagship recipes

- DNS Migration
- Cloudflare Cutover
- GitHub Actions Release
- Production Deployment
- Certificate Renewal
- M365 User Offboarding
- Incident Triage
- Vendor Support Handoff

## Hard boundaries

Browser-side only. IT Docs and PSA remain reference/contract surfaces only. No IT Docs backend, no PSA connector, no direct PSA calls, and no API/provider secrets.

## Remaining installed-app gate

This harness is source/runtime-contract evidence. Store submission still requires installed Windows smoke for actual Electron webviews in Split/Tri/Quad/Focus transitions.
