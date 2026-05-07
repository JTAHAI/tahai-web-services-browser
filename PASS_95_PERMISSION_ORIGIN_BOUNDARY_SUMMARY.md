# PASS95 — Permission Origin Boundary

PASS95 moves browser permission decisions from a global toggle-only posture to an origin-aware main-process boundary.

## Hardened surfaces

- Camera/microphone, geolocation, notifications, and clipboard-read are denied unless both conditions are true:
  - the matching local setting is enabled; and
  - the requesting origin is HTTPS or localhost.
- `camera` and `microphone` aliases normalize to Electron's `media` permission lane.
- Unknown permissions fail closed.
- Fullscreen remains narrowly allowed for secure, localhost, or trusted shell origins.
- Renderer settings copy now tells operators that permission toggles remain origin-gated by the main process.

## Verification

- Added `verify:pass-95-permission-origin-boundary`.
- Wired PASS95 into `verify:release-blockers`.
- Verifier checks the shared boundary, main-process session handlers, renderer copy/CSS, and package wiring.
