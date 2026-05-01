# Release Draft: v1.8.30 Linux RC1

Use this as the GitHub Release body for the first Linux RC1 artifact set.

## TAHAI Web Services Browser 1.8.30 — Linux RC1

This release candidate adds reproducible Linux packaging for TAHAI Web Services Browser.

### Artifacts

Windows preview:

- `TAHAI-Web-Services-Browser-1.8.30-x64.exe`
- `TAHAI-Web-Services-Browser-1.8.30-x64.msi`

Linux RC1:

- `TAHAI-Web-Services-Browser-1.8.30-x64.AppImage`
- `TAHAI-Web-Services-Browser-1.8.30-x64.deb`
- `TAHAI-Web-Services-Browser-1.8.30-x64.rpm`

### Linux install examples

AppImage:

```bash
chmod +x TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
./TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
```

Ubuntu/Debian-family:

```bash
sudo apt install ./TAHAI-Web-Services-Browser-1.8.30-x64.deb
```

Fedora/RHEL-family:

```bash
sudo dnf install ./TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

### Build notes

Linux packages were generated from Ubuntu 24.04 WSL using a Linux-native mirror folder under `$HOME`, not from `/mnt/c/.../node_modules`.

The build script now:

- rejects Windows node/npm interop inside WSL,
- mirrors source into `~/tahai-browser-linux-build`,
- runs Linux-native `npm ci`,
- checks `dist/main/main.js` before packaging,
- builds AppImage/deb/rpm,
- verifies the packages are non-empty,
- copies canonical release names back to `release/linux/`.

### Important preview notices

- Windows installers are unsigned preview artifacts until the approved signing lane is active.
- Windows SmartScreen may warn on unsigned builds.
- macOS public signing/notarization is not yet configured.
- IT Docs and PSA integration surfaces are browser-side contracts only in this repository.
- Do not store provider/API/PSA/customer secrets in this browser repo or mission files.

### SHA256 checksums

Paste generated SHA256 checksums here before publishing:

```text
<sha256>  TAHAI-Web-Services-Browser-1.8.30-x64.exe
<sha256>  TAHAI-Web-Services-Browser-1.8.30-x64.msi
<sha256>  TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
<sha256>  TAHAI-Web-Services-Browser-1.8.30-x64.deb
<sha256>  TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```
