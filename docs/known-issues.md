# Known Issues

## 1.8.30 PASS145 documentation closeout

- This is still a public-RC / preview lane, not enterprise GA. Do not describe the browser as enterprise GA until the PASS150 final ship candidate / GA manifest is completed and verified.
- Unsigned Windows preview packages may trigger Windows SmartScreen or enterprise endpoint warnings until the approved signing lane is active. Publish SHA256 checksums beside every public Windows artifact.
- Windows EXE/MSI packages still need manual installed-app smoke before broad announcement: installed launch, desktop shortcut, Start Menu shortcut, taskbar icon, Mission Control pane routing, keyboard shortcuts, mouse Button 4/5 where applicable, Evidence Pack redaction, and local-only Mission restore/export.
- Linux AppImage, Linux deb, and Linux rpm packages now have handoff manifests and checksum UX, but broad announcement still requires manual installed-app smoke on representative Linux targets.
- TAHAI OS/SENTINEL RPM consumption should use the PASS139 Linux handoff manifest instead of filename guessing.
- macOS packages must be built on macOS. Signed/notarized public macOS releases require Apple Developer signing and notarization configuration.
- IT Docs and PSA integration surfaces are browser-side contracts only. They intentionally do not perform server-side IT Docs writes or direct PSA API calls from this browser repo.
- Mission export and Evidence Pack workflows are redaction-aware, but users must still avoid placing secrets, copied cookies, credentials, private customer data, or unredacted support material into public issue reports.
- Privacy Policy and Support docs were closed out in PASS145 so public users know what is local, what is third-party, how manual updates work, and what not to post in support channels.

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
