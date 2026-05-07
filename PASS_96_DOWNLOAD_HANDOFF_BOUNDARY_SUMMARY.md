# PASS96 — Download Handoff Boundary

PASS96 hardens the browser download handoff path without adding a decorative runtime doctor.

## Hardened surface

- Electron `will-download` handling in `src/main/runtime-security.ts`.
- Download status events exposed through preload and renderer status UI.
- Download filename/source metadata normalization in `src/shared/download-boundary.ts`.
- Settings dialog copy/CSS for the download boundary.

## Security result

- Download events are routed to the trusted shell window, not directly back to the initiating remote/webview `webContents`.
- Renderer download status no longer receives or renders full local filesystem paths.
- Download filename handling now strips path fragments, control characters, bidi controls, Windows-unsafe filename characters, reserved Windows device names, and overlong names.
- User-selected save paths are normalized through the same filename sanitizer before `setSavePath`.
- Default configured download directories must be absolute existing directories, otherwise the browser falls back to the OS Downloads folder.
- Executable/installer-like downloads are flagged in download status/dialog copy.
- Download source metadata is origin-only and rejects embedded credentials and non-HTTP(S) protocols.

## Verification

Added:

```bash
npm run verify:pass-96-download-handoff-boundary
```

Wired into:

```bash
npm run verify:release-blockers
```
