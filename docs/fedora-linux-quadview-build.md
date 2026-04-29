# Fedora Linux Quad View Build

This delta prepares TAHAI Web Services Browser for a Fedora-friendly Linux build lane.

## Adds

- RPM target for Fedora-family systems.
- AppImage target remains available for portable testing.
- `npm run package:linux:rpm`
- `npm run package:linux:fedora`
- `npm run verify:fedora-linux-build`
- Release-blocker hook for Fedora build configuration.
- Quad View / Mission Control verification guard so Linux artifacts are not cut from a build missing Quad View.

## Build dependencies on Fedora

```bash
sudo dnf install -y nodejs npm rpm-build rpmdevtools desktop-file-utils libarchive p7zip p7zip-plugins libxcrypt-compat nss gtk3 libnotify libXScrnSaver libXtst xdg-utils at-spi2-core libuuid
```

## Build on Fedora / Fedora WSL

```bash
cd /mnt/c/dev/browser/app
npm ci
npm run typecheck
npm run build
npm run verify:fedora-linux-build
npm run verify:release-blockers
npm run package:linux:fedora
```

## Expected outputs

Outputs land in:

```text
C:\dev\browser\app\release
```

Expected artifacts:

```text
TAHAI Web Services Browser-1.8.7-linux-x86_64.AppImage
TAHAI Web Services Browser-1.8.7-linux-x86_64.rpm
```

Exact names may vary slightly by Electron Builder version and architecture.

## AppImage smoke test

```bash
cd /mnt/c/dev/browser/app/release
chmod +x ./*.AppImage
./*.AppImage
```

For constrained WSL/test environments only, AppImage may need:

```bash
./*.AppImage --no-sandbox
```

## RPM smoke test

```bash
cd /mnt/c/dev/browser/app/release
sudo dnf install -y ./TAHAI*.rpm
```

Then launch from the desktop app menu or inspect the installed files:

```bash
rpm -ql tahai-web-services-browser
```

## Feature smoke tests

- Mission button opens Mission Control.
- 4-Up Quad layout is visible and usable.
- Active pane routing works for address bar, back, forward, and reload.
- Site View / Site Rail button opens the rail if that delta is present.
- `Ctrl+Alt+V` toggles Site View Rail.
- `Ctrl+Alt+K` opens Credentials Manager.
