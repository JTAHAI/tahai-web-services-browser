# PASS159 — Enterprise Signing/Provenance/SBOM Gate Summary

PASS159 adds a source-only enterprise release integrity gate for signing truth, provenance, SBOM generation, checksum publication, and no-false-GA release claims.

## Added

- `src/shared/signing-provenance-sbom-contract.ts`
- `scripts/generate-pass159-release-provenance.mjs`
- Enhanced `scripts/generate-source-sbom.mjs`
- `scripts/verify-pass-159-enterprise-signing-provenance-sbom.mjs`
- `docs/enterprise-signing-provenance-sbom-pass159.md`
- `docs/enterprise-release-provenance-pass159.template.json`

## Package scripts

- `generate:sbom`
- `release:provenance:plan`
- `release:provenance`
- `verify:pass-159-enterprise-signing-provenance-sbom`

## Release blocker order

PASS159 runs after PASS158 and before final build inside `verify:release-blockers`.

## Remaining enterprise GA passes

Remaining enterprise GA passes: 3
