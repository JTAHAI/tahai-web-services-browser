# PASS 51 — Renderer boot bundle repair

Goal: fix the installed-app/runtime hang where the diagnostic screen remains visible because the browser renderer is compiled as CommonJS while the Electron renderer correctly runs with `nodeIntegration: false`.

Changes:
- Added `scripts/bundle-renderer-cjs.mjs`, a local-only renderer bundler that runs after `tsc` and replaces `dist/renderer/app.js` with a browser-safe bundle.
- Updated `npm run build` so the bundler runs before static assets are copied.
- Kept the Electron security posture intact: `nodeIntegration: false` and `contextIsolation: true` remain required.
- Added `scripts/verify-pass-51-renderer-boot-bundle.mjs` and wired it into release blockers.
- Bumped source version to `1.8.25`.

Local validation to run on Windows:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run dev
```

Expected: the boot diagnostic disappears and the normal browser shell renders.
