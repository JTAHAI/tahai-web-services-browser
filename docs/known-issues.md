# Known Issues

## 1.8.30 Linux RC1 / public source baseline

- Linux RC1 packaging now builds AppImage, `.deb`, and `.rpm` from Ubuntu 24.04 WSL using a Linux-native mirror folder under `$HOME`.
- The Linux build script copies Electron Builder's native architecture names back into canonical release names under `release/linux/`.
- Linux install/run validation is still manual before broad public announcement: launch AppImage, install `.deb` on Ubuntu/Debian-family, and install `.rpm` on Fedora/RHEL-family.
- Windows installers remain unsigned until the approved signing lane is active. Windows SmartScreen may show a warning; publish SHA256 checksums with every public artifact.
- macOS packages must be built on macOS. Signed/notarized public macOS releases require Apple Developer signing and notarization configuration.
- Public release packaging must still be manually verified on the target OS before broad announcement: installed launch, shortcuts/menu entries, taskbar/dock icon, Mission Control pane routing, keyboard shortcuts, mouse Button 4/5 where applicable, Evidence Pack redaction, and local-only Mission restore/export.
- IT Docs and PSA integration surfaces are browser-side contracts only. They intentionally do not perform server-side IT Docs writes or direct PSA API calls from this browser repo.

## Linux build footguns now guarded

- Running Linux packaging from `/mnt/c/.../node_modules` is blocked.
- Windows `node.exe`, Windows `npm.cmd`, UNC paths, and Windows PATH interop are rejected by the Linux-native environment verifier.
- `dist/main/main.js` is checked before Electron Builder packages the app.
- Linux package verification accepts Electron Builder's native architecture suffixes: `x86_64.AppImage`, `amd64.deb`, and `x86_64.rpm`.

## 1.8.21 public release candidate

- Windows installers remain unsigned until the approved signing lane is active. Windows SmartScreen may show a warning; publish SHA256 checksums with every public RC artifact.
- Public RC packaging must still be manually verified on Windows before broad announcement: Start Menu, desktop shortcut, installed executable launch, taskbar icon, Mission Control pane routing, keyboard shortcuts, mouse Button 4/5, Evidence Pack redaction, and local-only Mission restore/export.
- IT Docs and PSA integration surfaces are browser-side contracts only. They intentionally do not perform server-side IT Docs writes or direct PSA API calls from this browser repo.

## 1.8.12 preview

- Mouse Button 4 / Button 5 navigation is wired through Electron app-command events for Windows parity. It still requires installed-app hardware verification on Windows before broad distribution.
- The initial friend-feedback Windows build is unsigned. Windows SmartScreen may show a warning. The project has been published publicly on GitHub, and SignPath Foundation open-source code signing has been submitted/in progress.
- Windows installer packaging must still be verified on Windows before broad public release.
