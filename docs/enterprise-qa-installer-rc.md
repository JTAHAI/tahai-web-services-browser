# Enterprise QA and installer RC

This document is the release-candidate gate for TAHAI Web Services Browser before the public release candidate pass.

## Scope

Pass 44 is a source-controlled QA and installer-RC hardening pass. It does not commit generated installers, release zips, SBOM outputs, dist files, runtime profiles, browser profiles, app data, or local mission/evidence files.

## Non-negotiables

- No generated artifacts in source.
- No PSA/API/provider secrets in source, mission files, fixtures, exports, or release metadata.
- No direct PSA API calls from the browser.
- IT Docs and PSA remain browser-side reference contracts only.
- Unsigned preview packaging must keep `CSC_IDENTITY_AUTO_DISCOVERY=false` so contributor machines do not accidentally sign builds.
- Windows installer output must include a manifest and `SHA256SUMS.txt` next to generated release artifacts.

## RC verification commands

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:rc:verify
```

## Windows installer RC command

```powershell
Set-Location C:\dev\browser\app
npm run release:rc:win
```

The RC builder runs the release blockers, creates the NSIS/MSI release outputs, creates the friend feedback zip, and writes the release manifest.

Generated runtime files are expected under `release/` and must not be committed:

- `release-candidate-manifest.json`
- `installer-rc-truth.json`
- `SHA256SUMS.txt`
- generated `.exe`, `.msi`, `.zip`, and `.blockmap` files

## Windows installed-app gates

Before calling a build release-candidate quality, manually verify all of the following on Windows:

1. Install unsigned preview with expected Windows warning copy only.
2. Launch from Start Menu, desktop shortcut, and installed executable path.
3. Confirm taskbar and window icons use TAHAI spider branding.
4. Verify normal browser navigation: address bar, back, forward, reload, home, DevTools F12.
5. Verify Mission Control 1-Up, 2-Up, 3-Up, 4-Up, focus pane, and active-pane routing.
6. Verify Ctrl+K, Ctrl+Alt+1..4, Ctrl+Alt+Q, Ctrl+Alt+S, Ctrl+Alt+F, Ctrl+Alt+E.
7. Create, save, restore, export, and archive a local-only Mission without sign-in.
8. Confirm IT Docs and PSA controls remain browser-side contracts with disabled/authorized states only.
9. Run Evidence Pack redaction preview with bearer token, JWT-looking string, email, IP, and private-key fixture.
10. Confirm no console errors, renderer promise rejections, missing packaged resources, or broken local pages.

## Release-candidate manifest

`npm run release:rc:manifest` writes `release/release-candidate-manifest.json` and `release/SHA256SUMS.txt` from actual files present in `release/`.

The manifest records:

- product name
- version
- appId
- unsigned preview signing lane
- source-truth files
- required verification commands
- manual Windows QA gates
- releasable artifact names, sizes, and SHA-256 hashes

## Stop conditions

Stop the RC and do not publish if any of the following occurs:

- `npm run verify:release-blockers` fails.
- `npm run verify:mission-tabs-security` fails.
- Installer artifacts cannot be hashed.
- Windows installed-app smoke tests produce console errors or missing packaged resources.
- Any secret, token, cookie, Authorization header, PSA/API/provider credential, or real customer data appears in release output.
- IT Docs or PSA behavior attempts direct browser-side writeback instead of the browser-side contract.
