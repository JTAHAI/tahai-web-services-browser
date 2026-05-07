# PASS111 — Release Blocker Build Phase Ordering Repair

PASS111 repairs release-blocker ordering so source/handoff/generated-artifact verifiers run before the build step creates `dist/`.

## Repairs

- Moves `npm run build` to the end of `verify:release-blockers`.
- Keeps PASS105 through PASS111 static/source verifiers before build.
- Prevents post-build `dist/` from being mistaken for a committed/generated source artifact.
- Preserves PASS110 Git-aware generated-artifact checks.

## Verification

Run:

```powershell
npm run verify:pass-109-release-blocker-continuity-repair
npm run verify:pass-110-release-blocker-generated-artifact-git-aware
npm run verify:pass-111-release-blocker-build-phase-ordering
```
