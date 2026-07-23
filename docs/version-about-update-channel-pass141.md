# PASS141 — Version/about/update-channel truth pass

PASS141 closes the release-truth gap between `package.json`, runtime config, the local About page, download copy, and update-channel expectations.

## Scope

- Keep `package.json`, `src/shared/release-truth.ts`, `browser/about/release-truth.json`, and the local About page on the same current release truth.
- Make release truth explicit in source instead of scattering current-version strings.
- Update the local About page so it no longer claims stale `1.8.28 / PASS54 polish` status.
- Expose runtime-safe release metadata to the renderer config without exposing filesystem paths, credentials, tokens, or customer data.
- Document that the current update channel is `manual-release`: no silent updater is enabled in this preview build.

## Release truth

| Field | Value |
| --- | --- |
| Product | TAHAI Web Services Browser |
| Bundle lane | TAHAI—SENTINEL Browser |
| Current version | `2.0.14` |
| Current release pass | `PASS328` |
| Release channel | `public-rc` |
| Release phase | `enterprise-profile-ux-ga-lane` |
| Update channel | `manual-release` |
| Signing status | Unsigned preview until the approved code-signing lane is active |
| Download origin | `https://browser.tahai.net` |
| Download alias | `https://browser.tahaiportal.com` |
| Public repo | `https://github.com/JTAHAI/tahai-web-services-browser` |

## Update-channel rule

This pass intentionally does **not** add background update checks, vendor update feeds, or silent install behavior. Preview updates are manual:

1. Download the desired installer from the official TAHAI browser/download surface or GitHub Releases.
2. Verify SHA256 against the generated handoff checksum file.
3. Install intentionally.

## Verifier expectations

`npm run verify:pass-141-version-about-update-channel-truth` checks:

- `package.json` version and the shared release-pass constants match `src/shared/release-truth.ts`.
- Main-process runtime config uses the shared release truth module.
- The About page and `browser/about/release-truth.json` report the same current version / pass / channel / update-channel truth as the shared release source.
- No stale PASS54 about-page copy remains.
- No generated release artifacts are committed to git just because they exist locally.
- No automatic update dependency or Electron auto-updater import is introduced.

## Guardrails

Browser-side only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets, tokens, generated installers, runtime profiles, `dist/`, `release/`, `node_modules/`, or local app data in source.
