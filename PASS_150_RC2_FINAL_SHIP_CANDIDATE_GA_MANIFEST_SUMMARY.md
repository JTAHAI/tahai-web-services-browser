# PASS150 — RC2 Final Ship Candidate / GA Manifest

Version remains `1.8.30`.

PASS150 closes the bounded enterprise-release hardening lane as the RC2 final ship-candidate manifest pass.

## Changes

- Added `src/shared/final-ship-candidate-contract.ts`.
- Added `scripts/verify-pass-150-final-ship-candidate.mjs`.
- Added `docs/final-ship-candidate-ga-manifest-pass150.md`.
- Added `docs/ga-release-manifest-pass150.json`.
- Updated release truth to `PASS150` / `rc2-final-ship-candidate-ga-manifest`.
- Updated the local About page release lane to `v1.8.30 / PASS150 RC2 final ship candidate`.
- Fixed the titlebar drag-region regression by making the empty tab-strip track draggable while keeping tabs and buttons `no-drag`.
- Wired `verify:pass-150-final-ship-candidate` into `verify:release-blockers` before the final build.

## Guardrails preserved

- No direct PSA API calls.
- No IT Docs backend work.
- No secret, token, cookie, OAuth, cloud credential, or PSA credential storage.
- No silent auto-update lane.
- No telemetry or analytics additions.
- No unreviewed dependency additions.
- No generated evidence outputs, installers, manifests, `release/`, `dist/`, `artifacts/`, `.pass-runs/`, runtime profiles, Mission data, or Evidence data in source.

## Local proof

Run:

```powershell
npm run build
npm run verify:pass-138-windows-installer-closeout
npm run verify:pass-149-rc1-freeze
npm run verify:pass-150-final-ship-candidate
npm run verify:release-blockers
```

## Required installed-app manual check

Before public release, confirm on Windows that the brand area and empty tab-strip track drag the window, while tabs, tab close buttons, new-tab, and native caption controls remain interactive.
