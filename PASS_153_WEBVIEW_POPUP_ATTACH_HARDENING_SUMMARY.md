# PASS153 — Enterprise WebView Popup/Attach Hardening

PASS153 hardens the Electron webview popup and attach boundary for the enterprise DevOps/IT Admin browser lane.

## Changed

- Added `src/shared/webview-attach-security-contract.ts`.
- Added main-process `will-attach-webview` enforcement.
- Added main-process default-deny popup handling for created web contents.
- Removed renderer-created `allowpopups` attributes from webviews.
- Changed renderer webview popup handling to deny remote popup attempts by default.
- Added `scripts/verify-pass-153-webview-popup-attach-hardening.mjs`.
- Added `docs/webview-popup-attach-hardening-pass153.md`.

## Package scripts

- `verify:pass-153-webview-popup-attach-hardening`

## Release blocker wiring

PASS153 runs after PASS152 and before the final build in `verify:release-blockers`.

## Security rule

Popup permission is absent from renderer-created webviews. Unsafe attach options are stripped or forced safe by the main process. Remote page/webview content is still untrusted.
