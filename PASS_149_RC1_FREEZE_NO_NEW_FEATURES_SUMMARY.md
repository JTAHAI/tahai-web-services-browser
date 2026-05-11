# PASS149 — RC1 Freeze and No-New-Features Pass

PASS149 freezes the browser for RC1 and prevents the final closeout lane from drifting into new feature work.

## Version

Version remains `1.8.30`.

## Added

- `src/shared/rc1-freeze-contract.ts`
- `scripts/verify-pass-149-rc1-freeze.mjs`
- `docs/rc1-freeze-pass149.md`
- `PASS_149_RC1_FREEZE_NO_NEW_FEATURES_SUMMARY.md`

## Updated

- `src/shared/release-truth.ts`
- `browser/about/release-truth.json`
- `browser/about/index.html`
- `README.md`
- `package.json`
- PASS141/PASS54 compatibility verifiers so release-truth can advance from PASS141 to PASS149 without breaking the earlier gates.

## Freeze rules

PASS149 allows only release-blocker fixes, security blocker fixes, build/packaging fixes, installer handoff truth fixes, documentation truth fixes, manual QA evidence/checklist fixes, critical regression fixes, and checksum/manifest fixes.

PASS149 blocks new user-facing features, new integrations/providers, No direct PSA API calls, IT Docs backend work, secret/token storage, silent auto-update, telemetry/analytics, unreviewed dependency additions, generated artifacts in source, and version bumps without explicit release decision.

## Verification

- `verify:pass-149-rc1-freeze`
- `verify:release-blockers` now runs PASS149 after PASS148 and before the final build.

## Guardrail

Generated evidence outputs, installers, manifests, `release/`, `dist/`, `artifacts/`, `.git`, `.pass-runs`, runtime profiles, local Mission data, Evidence data, and `node_modules/` remain excluded from source.

PASS150 should be final ship candidate / GA manifest truth only, not a feature pass.
