# PASS145 — Privacy/support/known-issues documentation closeout summary

Version remains `1.8.30`.

## Completed

- Updated `docs/privacy-policy.md` for the `1.8.30 public-rc` lane.
- Updated `SUPPORT.md` with best-effort preview support boundaries and bug-report requirements.
- Updated `docs/known-issues.md` with current PASS145 public-RC truth.
- Updated `README.md` so users can find Privacy, Support, Known Issues, Security, and checksum/download docs from the main project page.
- Added `src/shared/privacy-support-known-issues-contract.ts`.
- Added `scripts/verify-pass-145-privacy-support-known-issues.mjs`.
- Added `docs/privacy-support-known-issues-pass145.md`.
- Wired `verify:pass-145-privacy-support-known-issues` into `verify:release-blockers` after PASS144 and before final build.

## Guardrails preserved

- No direct PSA API calls.
- No IT Docs backend implementation in the browser repo.
- No provider-secret, PSA-secret, token, cookie, credential, or private-key storage added.
- No telemetry or silent auto-update dependency added.
- No generated installers, generated manifests, release outputs, runtime profiles, local Mission data, or Evidence Pack runtime data committed.

## Verification

```text
npm run build
npm run verify:public-repo
npm run verify:pass-144-public-repo-supply-chain
npm run verify:pass-145-privacy-support-known-issues
npm run verify:release-blockers
```
