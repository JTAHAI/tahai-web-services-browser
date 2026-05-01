# PASS 55 — Public RC hardening

- Removed the browser-side local Credential Vault from the public source lane.
- Replaced the IT Tools credential card with Secret Boundary / Ops Guard routing.
- Removed credential-vault IPC, preload APIs, renderer dialog, and main-process storage modules.
- Added trusted first-party sender checks to all current `ipcMain.handle` channels.
- Converted local About/offline/onboarding/error/new-tab pages away from inline CSS/script allowances.
- Added visual regression checklist and static fixture verifier for known Ops Panel / About / Mission Control regressions.
- Added source-package cleanliness verifier that fails if generated output directories are present in source zips.
- Bumped package version to 1.8.29.
