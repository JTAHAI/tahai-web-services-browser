# Windows Installed Smoke Evidence Template — TAHAI Web Services Browser 2.0.18

STATUS: INSTALLED_SMOKE_PENDING

Use this for the locally installed MSI/EXE smoke or the Store-package installed smoke after package identity is final. Do not mark Store submission ready until this is complete.

## Environment

- Tester:
- Date/time:
- Windows edition/build:
- Install artifact path:
- Package type: MSI / EXE / MSIX / MSIXUPLOAD / APPXUPLOAD
- Artifact SHA256:
- App version shown in UI:
- Source commit/tag:

## Required smoke checks

| Check | Result | Notes/evidence |
| --- | --- | --- |
| App launches from Start menu | PENDING | |
| App icon/branding is TAHAI, not Electron default | PENDING | |
| About/version shows 2.0.18 truth | PENDING | |
| Normal navigation works | PENDING | |
| Address bar navigation works | PENDING | |
| Back/forward/reload work | PENDING | |
| Mouse history buttons work or safely no-op | PENDING | |
| Ctrl+K command center opens and closes cleanly | PENDING | |
| Settings opens, persists, and closes | PENDING | |
| More Tools opens and closes | PENDING | |
| Mission Control opens and layout controls are usable | PENDING | |
| 1-Up/2-Up/Tri/Quad/Focus do not collapse content pane | PENDING | |
| Downloads handoff works without leaking unsafe local paths | PENDING | |
| Evidence export/redaction path works or blocks safely | PENDING | |
| Support bundle path works or is honestly disabled | PENDING | |
| Resize restored/small/maximized windows remains usable | PENDING | |
| No critical renderer/main-process console errors | PENDING | |
| Uninstall/repair path is documented or smoke-tested | PENDING | |

## Pass rule

All required checks must be `PASS`, or the known-issues truth file must explicitly identify the remaining blocker and the Store submission evidence must remain blocked.
