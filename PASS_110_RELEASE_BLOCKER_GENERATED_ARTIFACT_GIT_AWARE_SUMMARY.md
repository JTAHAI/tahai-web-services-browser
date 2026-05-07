# PASS110 — Release Blocker Generated Artifact Git-Aware Repair

PASS110 repairs PASS109 generated-artifact hygiene so local dependency installation does not break release-blocker verification.

## Repairs

- PASS109 now treats a Git working tree differently from a strict source ZIP hygiene audit.
- In a Git working tree, generated folders such as `node_modules/`, `dist/`, `release/`, `artifacts/`, and `.pass-runs/` fail only if tracked by Git.
- In strict source ZIP hygiene mode, physical generated folders still fail.
- This prevents `npm ci` from causing false release-blocker failures while preserving source ZIP exclusion rules.

## Verification

Run:

```powershell
npm run verify:pass-109-release-blocker-continuity-repair
npm run verify:pass-110-release-blocker-generated-artifact-git-aware
```
