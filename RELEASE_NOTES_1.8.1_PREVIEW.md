# TAHAI Web Services Browser 1.8.1 Preview

This is an early friend-feedback preview build.

## Navigation parity hardening

- Added Electron `app-command` handling for `browser-backward` and `browser-forward`.
- Mouse Button 4 now routes to the active browser tab/webview `goBack()` only when that webview can go back.
- Mouse Button 5 now routes to the active browser tab/webview `goForward()` only when that webview can go forward.
- Existing `Alt+Left`, `Alt+Right`, toolbar Back/Forward, and History menu Back/Forward continue to share the same active-tab safe navigation path.

## Important Windows note

This preview installer is currently unsigned. Windows SmartScreen may show a warning. Only install this build if you downloaded it directly from TAHAI Web Services or this official GitHub repository.

Open-source publication is complete and code-signing work is in progress.

## Verification

```powershell
npm ci
npm run verify:public-repo
npm run verify:release-blockers
```

## Installed Windows verification

1. Install or launch the Windows preview build.
2. Open a normal website in a browser tab.
3. Navigate at least two pages deep in the same tab.
4. Press mouse Button 4 and confirm the active tab goes back, like Chrome/Edge.
5. Press mouse Button 5 and confirm the active tab goes forward, like Chrome/Edge.
6. Open a new tab with no history and confirm both buttons safely no-op without an error.
