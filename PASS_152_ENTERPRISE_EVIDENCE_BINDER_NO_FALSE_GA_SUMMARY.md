# PASS152 — Enterprise Evidence Binder + No-False-GA Gate

PASS152 restores the evidence-binder release truth lane before PASS153.

## Added

- `src/shared/enterprise-evidence-binder-no-false-ga-contract.ts`
- `scripts/verify-pass-152-enterprise-evidence-binder.mjs`
- `docs/enterprise-evidence-binder-no-false-ga-pass152.md`
- `PASS_152_ENTERPRISE_EVIDENCE_BINDER_NO_FALSE_GA_SUMMARY.md`

## Gate behavior

The verifier confirms the package remains `1.8.30`, keeps PASS150/PASS151 release truth intact, wires PASS152 into `verify:release-blockers`, and blocks source-language drift that would falsely call the build enterprise GA before real package/install/manual evidence exists.

## Source hygiene

Generated installers, checksums, package manifests, evidence reports, `release/`, `dist/`, `artifacts/`, `.pass-runs/`, runtime profiles, local Mission data, local Evidence data, and `node_modules/` remain excluded from source.

## No-false-GA marker

PASS152 keeps the no-false-GA marker explicit for release-blocker verification.
