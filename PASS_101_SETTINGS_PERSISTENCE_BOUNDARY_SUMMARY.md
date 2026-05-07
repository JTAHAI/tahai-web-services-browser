# PASS101 — Settings Persistence Boundary

PASS101 hardens runtime settings as a main-process persistence boundary instead of treating settings submitted by the renderer as trusted configuration.

## Hardened surfaces

- Saved home page URLs now pass through the shared navigation boundary before persistence.
- Remote saved home pages must be HTTPS.
- HTTP saved home pages are allowed only for localhost development targets.
- Embedded URL credentials, blocked protocols, control characters, and oversized home-page values fail closed to the TAHAI default.
- Settings files over the configured size cap are ignored and reset to defaults at read time.
- renderer-submitted settings cannot set local download paths.
- Settings returned to the renderer hide the persisted download directory and expose an empty `defaultDirectory` only.
- Existing main-owned download directory state is preserved internally until a future explicit main-process directory picker is added.

## Verification

- `npm run verify:pass-101-settings-persistence-boundary`
- Wired into `npm run verify:release-blockers`

Policy phrase: HTTPS or localhost HTTP.
