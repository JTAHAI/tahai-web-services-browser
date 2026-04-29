# TAHAI Web Services Browser Mission Tabs Security Spec

This repo implements only the browser-side Mission Control lane for TAHAI Web Services Browser.

## Scope

Mission Control is local browser-side operational context: Mission Tabs, Mission Views, local timeline metadata, local notes, local JSON persistence, and sanitized export previews.

The browser may store opaque IT Docs and PSA display references later, but it must not implement IT Docs backend behavior, PSA connectors, direct PSA API calls, provider secret handling, OAuth refresh-token storage, or ticket writeback in this repo.

## Security invariants

- Never trust renderer input.
- Never trust local mission files.
- Never trust remote page content.
- Never store bearer tokens, refresh tokens, PSA API keys, cloud provider secrets, raw cookies, or authorization headers in Mission JSON.
- Mission JSON is schema-versioned and validated in the main process before persistence.
- Mission tab URLs are parsed and blocked for `javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`, username/password URLs, and unknown protocols.
- External URL opening must route through `src/main/safe-open-external.ts`.
- IT Docs and PSA writeback remain disabled/reference-only until authorized server-side contracts exist.

## Implemented in 1.8.3

- `src/shared/mission-types.ts` defines the local mission schema, roles, layouts, modes, and result types.
- `src/shared/mission-validators.ts` validates mission shape, schema version, UUIDs, pane IDs, URLs, enum values, size limits, and secret-bearing keys.
- `src/main/mission-store.ts` persists validated mission JSON under app user data, never in the repo tree.
- `src/preload/preload.ts` exposes a narrow Mission API bridge: list, load, and save.
- `src/renderer/app.ts` adds Mission Control UI behavior, local Mission Tabs, layout switching, active-pane routing, and export preview.
- `scripts/verify-mission-tabs-security.mjs` statically blocks drift against the browser-side security boundary.

## Required verification

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:release-blockers
```

Windows installer packaging still requires local Windows verification.
