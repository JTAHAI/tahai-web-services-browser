# PASS140 — Download/install docs and checksum UX

## Purpose

Close the download-page and install-instruction gap after Windows and Linux package handoff work by making the public package matrix, checksum verification path, signing status, and generated-artifact boundary explicit.

## Changed

- Added `src/shared/release-download-ux.ts` with source-level release download artifact labels, checksum filenames, and package-selection copy for version `1.8.30`.
- Rewrote `docs/downloads-and-checksums.md` around a SHA256-first public package matrix.
- Updated `docs/browser-download-page-copy.md` from the stale v1.8.21 copy to v1.8.30 preview download-page copy.
- Expanded `docs/kb/articles/downloads-installers.md` with package choices, checksum UX, and PASS139 Linux handoff context.
- Added `docs/download-install-checksum-ux-pass140.md`.
- Added `scripts/verify-pass-140-download-install-checksum-ux.mjs`.
- Added package script `verify:pass-140-download-install-checksum-ux`.
- Wired PASS140 into `verify:release-blockers` after PASS139 and before final build.

## Guardrails preserved

- Version remains `1.8.30`.
- Browser-side source/docs/verifier work only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No generated installers, release manifests, `dist`, `release`, `artifacts`, `node_modules`, runtime profiles, local data, secrets, tokens, or credentials added to source.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:public-repo
npm run verify:pass-139-linux-package-handoff-closeout
npm run verify:pass-140-download-install-checksum-ux
npm run verify:release-blockers
```

Linux package generation remains artifact-dependent and must be validated locally from WSL/native Linux.
