# PASS 20 — Linux AppImage + Recipe Hardening

## Scope

Bounded hardening pass after the Linux AppImage build proof and DevOps Recipes v3 work.

## Changes

- Added `build-linux-appimage.ps1` at repo root for Windows-to-WSL AppImage builds.
- The script runs Windows preflight, release blockers, WSL build, and Linux AppImage packaging.
- Fixed duplicate `tahai-it-docs` recipe ID declaration.
- Promoted Azure and M365 recipes from generic provider labels to first-class provider labels.
- Added Pass 20 verifier and wired it into `verify:release-blockers`.

## Validation

Run:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:release-blockers
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-linux-appimage.ps1
```

## Guardrails

- No generated artifacts committed.
- No secrets added.
- Browser-side only.
- Normal mode unchanged.
