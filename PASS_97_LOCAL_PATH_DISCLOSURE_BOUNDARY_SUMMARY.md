# PASS97 — Local Path Disclosure Boundary

PASS97 closes the remaining local filesystem path leakage seam after PASS96 hid download paths.

## Hardened

- Mission load/save/export responses now return `savedLabel` instead of local mission/export paths.
- DevOps capture save IPC now returns a saved label instead of the selected local file path.
- Browser config now returns `userDataLabel` / `settingsLabel` instead of `userDataPath` / `settingsPath`.
- Browser profile state now returns `storageLabel` instead of the local profile-store path.
- Renderer save status/result messages no longer render `result.path`.
- Added shared `local-path-boundary` helpers and scrubber for Windows, UNC, macOS, Linux, and WSL-style paths.
- Export/save UI copy now states that save handoffs hide local paths from renderer status.

## Verification

- Added `verify:pass-97-local-path-disclosure-boundary`.
- Wired PASS97 into `verify:release-blockers` immediately after PASS96.

## Guardrail

First-party renderer IPC remains available for explicit user actions, but local filesystem path disclosure is no longer part of normal mission/profile/export/save handoff payloads.
