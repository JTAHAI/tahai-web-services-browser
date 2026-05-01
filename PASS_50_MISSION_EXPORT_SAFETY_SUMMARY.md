# PASS 50 — Mission Export Safety

Implemented validated Mission packet copy/save flow.

## Changes
- Bumped app version to 1.8.24.
- Added typed MissionExportResult for redacted Mission packet operations.
- Added main-process validated Mission export preview/copy/save helpers.
- Mission copy/save writes the redacted packet only.
- Mission IPC channels now assert first-party browser-shell sender before local mission operations.
- Added Mission Control buttons for Copy Redacted Packet and Save Redacted Packet.
- Renderer preview is redaction-scanned before display.
- Added PASS 50 verifier and release-blocker wiring.

## Verification
- `npm run verify:pass-50-mission-export-safety`
- `npm run typecheck`
- `npm run build`

Windows installer packaging remains local-machine verification.
