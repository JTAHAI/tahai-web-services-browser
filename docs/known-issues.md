# Known Issues

## 1.8.30 public source baseline

- Windows installers remain unsigned until the approved signing lane is active. Windows SmartScreen may show a warning; publish SHA256 checksums with every public artifact.
- Linux packaging must be run from a Linux-native folder. Do not reuse `/mnt/c/.../node_modules`; use `bash scripts/build-linux-installers.sh` from WSL/native Linux so the script mirrors source into `~/tahai-browser-linux-build` first.
- macOS packages must be built on macOS. Signed/notarized public macOS releases require Apple Developer signing and notarization configuration.
- Public release packaging must still be manually verified on the target OS before broad announcement: installed launch, shortcuts/menu entries, taskbar/dock icon, Mission Control pane routing, keyboard shortcuts, mouse Button 4/5 where applicable, Evidence Pack redaction, and local-only Mission restore/export.
- IT Docs and PSA integration surfaces are browser-side contracts only. They intentionally do not perform server-side IT Docs writes or direct PSA API calls from this browser repo.

## 1.8.21 public release candidate

- Windows installers remain unsigned until the approved signing lane is active. Windows SmartScreen may show a warning; publish SHA256 checksums with every public RC artifact.
- Public RC packaging must still be manually verified on Windows before broad announcement: Start Menu, desktop shortcut, installed executable launch, taskbar icon, Mission Control pane routing, keyboard shortcuts, mouse Button 4/5, Evidence Pack redaction, and local-only Mission restore/export.
- IT Docs and PSA integration surfaces are browser-side contracts only. They intentionally do not perform server-side IT Docs writes or direct PSA API calls from this browser repo.

## 1.8.12 preview

- Mouse Button 4 / Button 5 navigation is wired through Electron app-command events for Windows parity. It still requires installed-app hardware verification on Windows before broad distribution.
- The initial friend-feedback Windows build is unsigned. Windows SmartScreen may show a warning. The project has been published publicly on GitHub, and SignPath Foundation open-source code signing has been submitted/in progress.
- Windows installer packaging must still be verified on Windows before broad public release.
