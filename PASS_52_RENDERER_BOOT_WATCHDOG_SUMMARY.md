# PASS 52 — Renderer boot watchdog and strict ready marker

## Scope
- Added a first-party `boot.js` renderer preflight that runs before `app.js` and records script load/runtime failures in the visible diagnostic panel.
- Added explicit renderer lifecycle events from `app.ts` so boot readiness is based on the real application bundle, not just static HTML presence.
- Tightened the main-process renderer heartbeat to require `data-tahai-shell-ready="1"` instead of accepting a static `.app-shell` node.
- Incremented the package version to `1.8.26`.

## Guardrails
- No Node integration was added to renderer or webviews.
- No raw IPC exposure was added.
- No IT Docs/PSA backend or connector work was added.
- The browser remains local-first with strict renderer boot diagnostics.

## Local verification
```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:pass-52-renderer-boot-watchdog
npm run dev
```
