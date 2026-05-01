# Public release candidate

This is the final source-side public release candidate gate for TAHAI Web Services Browser v1.8.21.

## Scope

Pass 45 prepares the repository for a public RC without committing generated release artifacts. The repo remains source-only, open-source safe, and browser-side only for IT Docs / PSA integration.

## Non-negotiables

- No generated artifacts in source.
- No installers, release zips, `dist/`, `release/`, runtime profiles, browser profiles, caches, SBOM output, mission data, evidence data, or local app data committed.
- No PSA/API/provider secrets, tokens, cookies, Authorization headers, OAuth refresh tokens, private keys, tenant credentials, or real customer data in source or release metadata.
- IT Docs and PSA behavior remains a browser-side reference contract only.
- No direct PSA API calls.
- Unsigned preview posture stays explicit until an approved code-signing lane is active.
- Publish binaries only through GitHub Releases and official browser.tahai.net download copy with SHA256 checksums.

## Required public RC verification

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:public:verify
```

## Windows public RC builder

```powershell
Set-Location C:\dev\browser\app
npm run release:public:win
```

The public RC builder cleans local release output, runs the public verification gate, builds unsigned Windows NSIS/MSI artifacts, creates the friend-feedback zip, and writes:

- `release/public-release-candidate-manifest.json`
- `release/public-rc-truth.json`
- `release/SHA256SUMS.txt`

Generated release files stay under `release/` and must not be committed.

## Manual Windows public RC gates

1. Install unsigned public RC with the expected Windows warning only.
2. Launch from Start Menu, desktop shortcut, and installed executable path.
3. Confirm taskbar, Start Menu, installer, and window icons use TAHAI spider branding.
4. Verify normal browser navigation: address bar, back, forward, reload, home, DevTools F12, Alt+Left, Alt+Right, and mouse Button 4/5.
5. Verify Mission Control 1-Up, 2-Up, 3-Up, 4-Up, focus pane, active-pane routing, and pane return controls.
6. Verify Ctrl+K, Ctrl+Alt+1..4, Ctrl+Alt+Q, Ctrl+Alt+S, Ctrl+Alt+F, Ctrl+Alt+E.
7. Create, save, restore, export, duplicate, and archive a local-only Mission without sign-in.
8. Confirm IT Docs and PSA controls remain browser-side contracts with disabled/authorized states only and no direct PSA API behavior.
9. Run Evidence Pack redaction preview with bearer token, JWT-looking string, email, IP, cookie/header text, and private-key fixture.
10. Confirm no console errors, renderer promise rejections, missing packaged resources, broken local pages, or mystery disabled buttons.

## Public release destinations

- GitHub Releases: use `docs/github-release-notes-1.8.21.md` as the release body.
- browser.tahai.net: use `docs/browser-download-page-copy.md` as the downloads-page copy.
- Checksums: publish `SHA256SUMS.txt` beside the installer artifacts.
- Source: preserve Apache-2.0 license, NOTICE, TRADEMARKS.md, SECURITY.md, SUPPORT.md, and privacy/code-signing docs.

## Stop conditions

Do not publish the public RC if any of the following occurs:

- Any verification command fails.
- Windows installed-app smoke testing finds console errors, missing packaged resources, broken Mission Views, or broken normal browser navigation.
- Any secret, token, cookie, Authorization header, PSA/API/provider credential, customer data, runtime profile, or cache appears in source or release output.
- IT Docs or PSA behavior attempts browser-side writeback outside the browser-side contract.
- `public-release-candidate-manifest.json` or `SHA256SUMS.txt` cannot be generated from actual release artifacts.
