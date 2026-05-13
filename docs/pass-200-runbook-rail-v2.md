# PASS200 — Runbook Rail v2

PASS200 turns the local Runbook Rail into a fuller enterprise operator rail while preserving the browser-side-only boundary.

## Scope

Runbook Rail v2 adds export-ready structure for:

- checklist sections
- notes
- rollback conditions
- validation steps
- blocked items
- operator timestamps
- export-ready structure and diagnostics

## What changed

- Added `src/shared/runbook-rail-v2-contract.ts` as the PASS200 source of truth.
- Extended the Mission Runbook model with sections, validation steps, rollback conditions, blocked items, operator timestamps, export profile, and updated timestamp.
- Kept existing checklist/objective/rollback fields compatible with saved missions.
- Hardened mission validation so imported/saved runbook v2 data is schema-limited, length-limited, redaction-aware, and enum/UUID constrained where required.
- Added Mission Control Runbook Rail v2 UI rows for section state, validation state, rollback condition activity, blockers, and operator timestamps.
- Extended mission evidence exports with Runbook Rail v2 sections, validation steps, rollback conditions, blockers, timestamps, diagnostics, and guardrail summary.
- Added PASS200 verifier and release-blocker chain integration.

## Guardrails preserved

- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No provider API calls.
- No provider secrets.
- No cookies, auth headers, OAuth refresh tokens, API keys, private keys, or credential fields.
- Runbook Rail remains local-only and browser-side only.
- IT Docs and PSA writeback remain future server-authorized contracts outside this repo.
- Export still goes through redaction/sanitized handoff paths.

## Operator behavior

Runbook Rail v2 gives operators a more disciplined mission closeout path:

1. Define scope/objective.
2. Capture preflight state.
3. Track execution checklist state.
4. Mark validation steps.
5. Keep rollback conditions visible.
6. Record blockers.
7. Stamp key operator timestamps.
8. Export a sanitized handoff packet.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-200-runbook-rail-v2
npm run verify:pass-199-admin-console-profiles-v2
npm run verify:pass-198-mission-recipe-library-v2
npm run verify:pass-197-mission-layout-determinism
npm run typecheck
npm run build
```

## Version

Version remains `1.8.30`.
