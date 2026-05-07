# PASS 44 — Enterprise QA and installer RC

Version: 1.8.20

Implemented source-side release-candidate hardening for TAHAI Web Services Browser.

## Added

- `docs/enterprise-qa-installer-rc.md` with enterprise RC commands, Windows installed-app gates, stop conditions, and unsigned preview posture.
- `packaging/windows/build-release-candidate.ps1` as the bounded Windows installer RC runner.
- `scripts/write-release-candidate-manifest.mjs` to generate `release-candidate-manifest.json` and `SHA256SUMS.txt` from actual release artifacts.
- `scripts/verify-pass-44-enterprise-qa-installer-rc.mjs` wired into `verify:release-blockers`.
- Package scripts:
  - `verify:pass-44-enterprise-qa-installer-rc`
  - `release:rc:verify`
  - `release:rc:win`
  - `release:rc:manifest`

## Hardened

- Version advanced to `1.8.20` in `package.json` and `package-lock.json`.
- Package build metadata now aligns with installer-RC posture: `compression: maximum`, `publish: null`, `removePackageScripts: true`, and `nodeGypRebuild: false`.
- Installer RC explicitly disables code-signing certificate auto-discovery for unsigned preview safety.
- RC manifest generation records SHA-256 hashes and manual Windows gates without committing generated artifacts.

## Required local Windows RC command

```powershell
Set-Location C:\dev\browser\app
npm run release:rc:win
```

Generated installer outputs remain under `release/` and must not be committed.
