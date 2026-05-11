# PASS144 — Public Repo + Supply-Chain Hardening

Status: complete
Version: 1.8.30

PASS144 hardens the public open-source repository lane and source supply-chain posture before installed-app QA begins.

## Delivered

- Shared public repo supply-chain contract.
- Dedicated PASS144 supply-chain verifier.
- `.npmrc` deterministic install/save/audit posture.
- Pinned root development dependency specs.
- CODEOWNERS review coverage for release/security-sensitive paths.
- Dependabot coverage for npm and GitHub Actions.
- Dedicated supply-chain GitHub Actions workflow.
- Node 22 alignment across GitHub Actions workflows.
- Public repo supply-chain policy doc.
- PASS144 release-blocker wiring.

## Guardrails preserved

- Browser-side work only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No secrets, runtime profiles, generated installers, release directories, dist output, artifacts, or node_modules in source.
- Version remains 1.8.30.

## Verification

Run:

```bash
npm run build
npm run verify:public-repo
npm run verify:pass-143-mission-redaction-closeout
npm run verify:pass-144-public-repo-supply-chain
npm run verify:release-blockers
```
