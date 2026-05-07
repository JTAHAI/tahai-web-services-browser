# PASS 60 — Linux Native Installer Build Guard

This pass hardens Linux packaging so AppImage, `.deb`, and `.rpm` builds cannot accidentally use Windows `node`, Windows `npm`, or `/mnt/c/.../node_modules` through WSL interop.

## Canonical command from Windows PowerShell

```powershell
wsl -d Ubuntu-24.04 --cd /mnt/c/dev/browser/app -- bash scripts/build-linux-installers.sh AppImage deb rpm
```

The script intentionally mirrors the source into a Linux-native folder before packaging:

```text
~/tahai-browser-linux-build
```

It excludes generated and host-specific paths:

```text
node_modules/
dist/
release/
.git/
```

## Hard gates

- Refuses to package from `/mnt/...`.
- Sanitizes `PATH` before resolving `node` and `npm`.
- Requires Linux-native Node 22.12+ and npm.
- Fails if `node`, `npm`, `npm_execpath`, or `PATH` point to Windows/interop locations.
- Deletes stale Linux build output with a sudo fallback for permission-broken prior `node_modules` folders.
- Runs `npm ci --include=dev` in the Linux-native mirror.
- Requires `typescript`, `electron-builder`, and `yargs` to resolve before build.
- Fails if `dist/main/main.js` is missing before electron-builder runs.
- Verifies AppImage, `.deb`, and `.rpm` outputs are present and non-trivially sized.
- Copies normalized artifacts back to `C:\dev\browser\app\release\linux` when launched from the Windows-mounted source.

## Expected copied artifacts

```text
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm
release/linux/TAHAI-Linux-installers-manifest.txt
```

## Verification

```bash
npm run verify:linux-installers-config
npm run verify:linux-native-build-guard
npm run package:linux:release
```
