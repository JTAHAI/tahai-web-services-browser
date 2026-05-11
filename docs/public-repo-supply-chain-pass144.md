# PASS144 — Public repo + supply-chain hardening

PASS144 closes the public repository and supply-chain credibility lane before installed-app QA passes begin.

## Scope

Browser source only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No version bump. No generated installers, release directories, SBOM files, npm cache data, node_modules, runtime profiles, local mission files, or evidence data in source.

## Changes

- Added a shared public repo supply-chain contract at `src/shared/public-repo-supply-chain-contract.ts`.
- Added a dedicated PASS144 verifier at `scripts/verify-pass-144-public-repo-supply-chain.mjs`.
- Added `.npmrc` guardrails for lockfile use, exact future saves, audit-on, and no funding noise.
- Pinned root development dependency specifiers in `package.json` and the lockfile root metadata.
- Added `.github/CODEOWNERS` for owner review of security-sensitive paths.
- Expanded Dependabot to cover npm and GitHub Actions, with supply-chain labels and grouped npm dev tooling updates.
- Added a dedicated GitHub Actions `supply-chain-guard.yml` workflow.
- Aligned GitHub Actions Node setup with the documented Node 22 local packaging lane.
- Added `docs/public-repo-supply-chain-policy.md`.
- Wired `verify:pass-144-public-repo-supply-chain` into `verify:release-blockers` after PASS143.

## Verifier coverage

The PASS144 verifier fails closed on:

- missing public repo policy/material files;
- missing `.npmrc`, CODEOWNERS, Dependabot, or supply-chain workflow posture;
- version drift from `1.8.30`;
- non-Apache package license;
- package-lock/package version mismatch;
- root runtime dependencies without an explicit future pass;
- broad root dev dependency specifiers;
- root lifecycle install scripts;
- unexpected dependency install scripts beyond the currently allowed Electron packaging dependencies;
- git/file/ssh/GitHub direct dependency resolution in the lockfile;
- missing generated-artifact and secret exclusions in `.gitignore`;
- workflow Node major drift away from Node 22;
- forbidden generated/package/runtime files in source;
- high-confidence secret/token/cookie/authorization patterns outside approved scanner/policy fixtures.

## Validation

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefer-offline --loglevel=error
npm run build
npm run verify:public-repo
npm run verify:pass-143-mission-redaction-closeout
npm run verify:pass-144-public-repo-supply-chain
```

## Acceptance

PASS144 is complete when the new verifier passes, public repo verification still passes, release blockers include PASS144, generated outputs remain excluded, and the source ZIP excludes generated artifacts and local data.
