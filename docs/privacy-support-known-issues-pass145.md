# PASS145 — Privacy/support/known-issues documentation closeout

PASS145 closes the public-trust documentation lane before installed-app QA and release-candidate freeze.

## Scope

Browser-side documentation and verification only:

- Privacy Policy current to `1.8.30 public-rc`.
- Support boundaries current to `1.8.30 public-rc`.
- Known Issues current to `1.8.30 PASS145 documentation closeout`.
- README links to Privacy, Support, Known Issues, security reporting, and download/checksum guidance.
- Static verifier prevents stale docs from omitting manual-update, unsigned-preview, redaction, and browser-side integration boundaries.

## Public claims hardened

The docs now state that:

- TAHAI Web Services Browser does not intentionally collect or sell user telemetry, browsing history, credentials, mission notes, or Evidence Pack content.
- Local browser data, local Mission Control data, and local Evidence Pack metadata can exist on the user's machine.
- Third-party websites and services opened by the user are governed by their own privacy policies.
- Current update posture is manual release downloads only; no silent auto-update channel is enabled.
- Official downloads should come from GitHub Releases or official TAHAI download pages, with SHA256 verification before install.
- Support is best-effort open-source/public preview support unless a separate written support agreement exists.
- Users must not post secrets, copied cookies, tokens, private keys, provider credentials, PSA credentials, customer data, raw browser profiles, or unredacted Mission/Evidence exports in public issues.
- The product is not enterprise GA until the PASS150 final ship candidate / GA manifest is complete.

## Boundaries preserved

PASS145 does not add IT Docs backend code, PSA connector code, direct PSA API calls, provider-secret storage, telemetry, auto-update dependencies, or generated release artifacts.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:public-repo
npm run verify:pass-144-public-repo-supply-chain
npm run verify:pass-145-privacy-support-known-issues
npm run verify:release-blockers
```

## Acceptance

- Version remains `1.8.30`.
- `docs/privacy-policy.md`, `SUPPORT.md`, and `docs/known-issues.md` contain current public-RC truth.
- `src/shared/privacy-support-known-issues-contract.ts` records the documentation contract.
- `scripts/verify-pass-145-privacy-support-known-issues.mjs` fails closed if key public-trust statements are removed.
- Generated installers, generated manifests, `release/`, `dist/`, `node_modules/`, runtime profiles, local mission data, and evidence data remain outside source.
