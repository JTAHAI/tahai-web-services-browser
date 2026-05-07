# PASS 61 — Windows-to-WSL Linux Installer Wrapper

This pass adds a Windows PowerShell wrapper for Linux installer builds without weakening the PASS 60 Linux-native guard.

## Canonical Windows command

```powershell
Set-Location C:\dev\browser\app
powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\windows\build-linux-installers-wsl.ps1
```

Equivalent npm script:

```powershell
npm run wsl:linux:release
```

## What the wrapper does

- Verifies `wsl.exe` exists.
- Defaults to `Ubuntu-24.04`.
- Converts `C:\dev\browser\app` to `/mnt/c/dev/browser/app`.
- Checks Linux-native `node` and `npm` from inside the distro.
- Calls `bash scripts/build-linux-installers.sh AppImage deb rpm` inside WSL.
- Lets the bash script mirror the repo into `~/tahai-browser-linux-build` before packaging.
- Verifies copied artifacts in `release\linux`.

## Expected artifacts

```text
release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.deb
release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.rpm
release\linux\TAHAI-Linux-installers-manifest.txt
```

## Guardrail preserved

The wrapper does not run Windows `node`, Windows `npm`, or `electron-builder`. It only invokes WSL and hands control to `scripts/build-linux-installers.sh`, which refuses mounted-path packaging and builds from a Linux-native mirror.
