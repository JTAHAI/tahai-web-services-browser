# PASS351 - Daily-Driver Surface And Workbench Toggle

PASS351 adds a real browser-surface toggle so the TAHAI Browser can present itself either as the full TAHAI workbench or as a cleaner daily-driver shell with TAHAI branding hidden from the top chrome.

## Scope

- Add a persisted `surfaceMode` UI setting with `tahai-workbench` and `daily-driver` values.
- Add a persisted `showWorkbenchTools` UI setting so operators can hide or restore the TAHAI workbench buttons from the main toolbar.
- Keep managed-policy lock support for both settings.
- Reflow the responsive toolbar when the shell surface changes so hidden workbench buttons do not leave stale More Tools counts.
- Route the preferred new tab and launchpad-style startup path through a safer daily-driver fallback when branding and workbench chrome are hidden.

## Acceptance

- `Settings > Shell` exposes a browser-surface selector and a workbench-buttons toggle.
- `daily-driver` mode can hide TAHAI branding from the top chrome.
- Hiding workbench buttons removes the main-toolbar TAHAI workbench controls without weakening browser security.
- The responsive overflow owner re-measures after the surface mode changes.
- The preferred new tab path uses the normal home page when the browser is in an unbranded daily-driver surface with workbench buttons hidden.
- Managed policy can lock both settings.
- PASS351 writes machine-readable verifier evidence under `release-candidate/generated/`.

## Security Truth

- This pass does not add `allowpopups`, Node in remote content, raw IPC exposure, or `webSecurity: false`.
- The browser keeps the existing TAHAI security and Electron/webview guardrails even when the UI is presented as a cleaner daily-driver surface.
