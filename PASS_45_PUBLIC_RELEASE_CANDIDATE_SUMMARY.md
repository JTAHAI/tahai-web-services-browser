# PASS 45 — Public release candidate

Version: 1.8.21

Implemented final source-side public release candidate preparation for TAHAI Web Services Browser.

## Added

- `docs/public-release-candidate.md` with final public RC verification, publish destinations, manual Windows gates, and stop conditions.
- `docs/github-release-notes-1.8.21.md` for the GitHub Releases body.
- `docs/browser-download-page-copy.md` for the browser.tahai.net downloads page.
- `packaging/windows/build-public-release-candidate.ps1` as the bounded public RC Windows builder.
- `scripts/write-public-release-candidate-manifest.mjs` to generate `public-release-candidate-manifest.json` and `SHA256SUMS.txt` from actual artifacts.
- `scripts/verify-pass-45-public-release-candidate.mjs` wired into `verify:release-blockers`.
- `.github/workflows/public-release-candidate.yml` for manual public RC packaging.

## Hardened

- Version advanced to `1.8.21` in `package.json` and `package-lock.json`.
- Electron advanced to `41.3.0` and electron-builder advanced to `26.8.1` for a zero-high buildchain audit posture.
- README and known-issues copy updated to public release candidate posture.
- Pass 44 verifier now allows newer versions while preserving the Pass 44 installer-RC checks.
- Public release scripts keep unsigned preview posture explicit with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Public RC publish copy requires SHA256 checksums and official GitHub/browser.tahai.net distribution.

## Required local public RC command

```powershell
Set-Location C:\dev\browser\app
npm run release:public:win
```

Generated installer outputs remain under `release/` and must not be committed.
