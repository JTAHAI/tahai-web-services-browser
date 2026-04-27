# TAHAI Web Services Browser 1.8.3 Mission Control Delta

## Scope

This delta advances the browser from the 1.8.0 public source lane to 1.8.3 with the first browser-side Mission Control implementation.

Implemented browser-side only:

- Local Mission Tabs model and validation.
- Mission Control dialog and toolbar entry point.
- Mission creation, local save/restore, and mission list.
- Active-tab-to-mission capture with role assignment.
- 1-Up, 2-Up, 3-Up, Quad, and Focus layout controls.
- Active pane tracking and keyboard focus shortcuts.
- Local Markdown export preview with redaction scanning.
- Main-process mission persistence under Electron user data.
- Central safe external-open wrapper.
- Static Mission Tabs security verifier.
- Repo-readable Mission Tabs security spec.

Not implemented in this repo:

- IT Docs backend features.
- PSA connectors.
- Direct PSA API calls.
- Integration secrets, provider tokens, OAuth refresh tokens, or PSA credentials.

## Verification completed in ChatGPT container

- `node scripts/verify-mission-tabs-security.mjs` => OK
- `node scripts/verify-public-repo.mjs` => OK
- `node scripts/verify-enterprise-release.mjs` => OK
- TypeScript parse/syntax check across `src/**/*.ts` => OK

## Verification not completed in ChatGPT container

- `npm ci` timed out because dependencies were not available/installed in this container.
- Full `npm run build` and Windows packaging were not claimed as verified here.

## Local verification commands

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:release-blockers
```

Packaging after verification:

```powershell
Set-Location C:\dev\browser\app
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run package:win:release
npm run release:friend:zip
```
