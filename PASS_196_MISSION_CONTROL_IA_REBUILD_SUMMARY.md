# PASS196 — Mission Control IA Rebuild

Status: source hardening complete.
Version: 1.8.30 unchanged.

## What changed

- Rebuilt the top of Mission Control around a visible command deck.
- Added seven operator cards: Mission, Active pane, Layout, Runbook, Evidence, Timeline, and Export.
- Wired the cards to sanitized local Mission state during `renderMissionControl()`.
- Added responsive CSS so the deck remains usable at restored and compact window sizes.
- Added `src/shared/mission-control-ia-contract.ts` and `scripts/verify-pass-196-mission-control-ia-rebuild.mjs`.
- Added PASS196 to `verify:release-blockers` before the final build step.

## Boundary

This is browser-side UX/IA hardening only. It does not implement IT Docs backend features, PSA connectors, direct PSA API calls, token storage, or generated release artifacts.

## Local verification

```powershell
Set-Location C:\devrowserpp
npm run verify:pass-196-mission-control-ia-rebuild
npm run verify:release-blockers
```

Installed-app Mission Control behavior still requires Windows manual/runtime verification.
