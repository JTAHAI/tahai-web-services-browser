# PASS 35 — Release script and builder truth

Version: 1.8.12

- Repaired release-builder source of truth across `package.json`, `package-lock.json`, and `electron-builder.yml`.
- Added `verify:builder-truth` gate and wired it into release blockers/preflight.
- Replaced stale hard-coded release version checks with package-lock/builder truth validation.
- Repaired Windows release script paths so package commands resolve inside the repo root.
- Added Windows release clean, unpacked ZIP, MSI builder, generated cleanup, and source SBOM scripts.
- Hardened friend-feedback release packaging to resolve current artifacts dynamically, emit SHA256 sums, and include `release-build-truth.json`.
- Updated smoke/production/release-clean verifiers for the current single-root app layout.

Verification completed in this environment:

- `node scripts/verify-enterprise-release.mjs`
- `node scripts/verify-builder-truth.mjs`
- `node scripts/verify-public-repo.mjs`
- `node scripts/smoke-static.mjs`
- `node scripts/assert-production-config.mjs`
- Existing static release blocker verifiers through PASS 34

Not completed in this Linux container:

- Full `npm ci` / `npm run build` / Windows installer packaging. Local Windows package verification remains required.
