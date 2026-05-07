# PASS 53 — Renderer asset preflight and preload diagnostics

Goal: stop boot-hang ambiguity by failing closed before the renderer shell loads when generated runtime assets are missing or stale.

Changed:
- Added a main-process renderer asset preflight for `dist/renderer/index.html`, `boot.js`, `app.js`, primary renderer CSS, and `dist/preload/preload.js`.
- Added explicit `preload-error` and `dom-ready` heartbeat diagnostics to the renderer shell loader.
- Bumped package version to `1.8.27`.
- Added `verify:pass-53-renderer-asset-preflight` and included it in release blockers.

Verification:
- `node scripts/verify-pass-50-mission-export-safety.mjs`
- `node scripts/verify-pass-51-renderer-boot-bundle.mjs`
- `node scripts/verify-pass-52-renderer-boot-watchdog.mjs`
- `node scripts/verify-pass-53-renderer-asset-preflight.mjs`

Local Windows gate still required:
- `npm ci`
- `npm run build`
- `npm run dev`
