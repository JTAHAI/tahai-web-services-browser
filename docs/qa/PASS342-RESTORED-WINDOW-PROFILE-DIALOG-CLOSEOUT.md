# PASS342 - Restored Window Profile Dialog Closeout

## Purpose

PASS342 closes a restored-window-only bug where the `Default` profile button could briefly open the profile dialog and then close it immediately.

## Root Cause

The PASS122 overlay viewport reflow guard treated all non-Mission overlays like chrome-anchored flyouts. In a restored window, a centered modal dialog can legitimately start near the top of the app viewport. PASS122 then considered the profile dialog clipped because it was not below the toolbar chrome stack and dismissed it after the open-settle delay. Fullscreen had enough vertical slack, so the same dialog stayed open there.

## Runtime Fix

`src/renderer/app.ts` now separates centered modal dialogs from toolbar/flyout overlays:

- `profile-dialog`, `settings`, `command-palette`, and `shortcut-dialog` validate against the full restored-window viewport.
- Modal detection uses overlay source ownership plus dialog tag/capability checks, not only `instanceof HTMLDialogElement`, because Electron renderer realms can make constructor checks unreliable.
- DevOps, IT Tools, More Tools, Ops Panel, site-view rail, and Mission Control keep their existing stricter overlay bounds.
- The modal path stamps `PASS342_RESTORED_WINDOW_MODAL_DIALOG_VIEWPORT_CLOSEOUT` so runtime E2E can prove the intended owner handled the dialog.
- Profile open schedules a deterministic viewport reflow after `refreshProfiles()` hydrates the dialog, avoiding stale measurements from the pre-render modal frame.
- Runtime E2E waits past the PASS122 delayed reflow window and fails if the profile dialog flashes closed or is dismissed as `profile-dialog` by PASS122.

## Acceptance

Run:

```powershell
Set-Location D:\dev\browser\app
npm run verify:pass-342-restored-window-profile-dialog-closeout
npm run build
npm run test:runtime-e2e
```

Manual restored-window check:

1. Launch with `npm run dev`.
2. Keep the app restored, not fullscreen.
3. Click `Default`.
4. Confirm the profile dialog remains open.
5. Close the dialog and confirm toolbar/webview clicks still work.
6. Repeat fullscreen as a parity check.

## Guardrails

- No unsafe `allowpopups` behavior.
- No Node integration in remote content.
- No raw IPC exposure.
- No direct PSA/API/provider secrets.
