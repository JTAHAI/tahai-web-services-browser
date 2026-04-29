# Pass 05 — Boot Stability

Purpose: remove unsupported renderer `prompt()` calls that can crash or block Electron shell startup/runtime paths.

Changes:
- Replaced Mission pane quick assignment `window.prompt()` with an in-app `<dialog>` input flow.
- Replaced Workspace Snapshot naming `window.prompt()` with the same renderer-safe input flow.
- Replaced Chromium bookmark add/edit/folder `window.prompt()` calls with in-app `<dialog>` inputs.
- Added shared premium modal styling in `src/renderer/styles/browser.css`.
- Added release verification guard so renderer `prompt()` usage fails the enterprise release verifier.

Validation target:
- `grep -RIn "\bprompt\s*(" src` returns no renderer matches.
- `npm run verify:release-blockers` includes the new prompt guard through `scripts/verify-enterprise-release.mjs`.

Manual Windows gate:
- Start app with `npm run dev`.
- Confirm startup has no `prompt() is and will not be supported` crash.
- Right-click a tab to send it to a Mission pane and confirm the in-app modal appears.
- Save a workspace snapshot and confirm the in-app modal appears.
- Add/edit bookmarks and folders and confirm the in-app modal appears.
