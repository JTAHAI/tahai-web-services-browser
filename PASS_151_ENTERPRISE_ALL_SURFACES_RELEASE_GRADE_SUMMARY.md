# PASS151 — Enterprise All-Surfaces Release Grade Gate

PASS151 adds the post-RC enterprise release-grade gate. It does not add browser features and it does not bump version `1.8.30`.

## Added

- `src/shared/enterprise-all-surfaces-release-grade-contract.ts`
- `scripts/run-pass151-enterprise-all-surfaces-gate.mjs`
- `scripts/verify-pass-151-enterprise-all-surfaces-release-grade.mjs`
- `docs/enterprise-all-surfaces-release-grade-pass151.md`
- `docs/enterprise-release-grade-checklist-pass151.md`
- `PASS_151_ENTERPRISE_ALL_SURFACES_RELEASE_GRADE_SUMMARY.md`

## Package scripts

- `evidence:enterprise-all-surfaces`
- `verify:pass-151-enterprise-all-surfaces-release-grade`

## Release blocker wiring

PASS151 runs after PASS150 and before the final build in `verify:release-blockers`.

## Enterprise release-grade standard

The build should not be called enterprise release grade until source gates pass, package handoff manifests/checksums exist for Windows and Linux, installed-app smoke evidence exists for Windows and Linux, cross-size responsive evidence exists, and the PASS151 strict evidence aggregation report passes.

## Source hygiene

Generated installers, package manifests, checksum files, evidence reports, `release/`, `dist/`, `artifacts/`, `.pass-runs/`, runtime profiles, local Mission data, local Evidence data, and `node_modules/` remain excluded from source.
