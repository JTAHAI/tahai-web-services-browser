# Build Troubleshooting

This document covers common build and packaging issues for TAHAI Web Services Browser.

## Windows npm/node leaked into WSL

Symptoms:

```text
UNC paths are not supported. Defaulting to Windows directory.
Cannot find module 'C:\Windows\scripts\verify-linux-installers-config.mjs'
Could not read package.json: C:\Windows\package.json
```

Cause:

Windows `node.exe` or `npm.cmd` was used inside WSL through interop.

Fix:

```bash
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r
which node
which npm
node -v
npm -v
```

Expected:

```text
/usr/bin/node
/usr/bin/npm
```

Then run Linux packaging through the guarded script:

```bash
cd /mnt/c/dev/browser/app
bash scripts/build-linux-installers.sh
```

## Permission denied removing app-builder-lib

Symptoms:

```text
EACCES: permission denied, rmdir '/home/<user>/tahai-browser-linux-build/node_modules/app-builder-lib'
rm: cannot remove ... Permission denied
```

Fix from WSL Ubuntu:

```bash
cd ~
sudo chown -R "$USER:$USER" "$HOME/tahai-browser-linux-build" 2>/dev/null || true
sudo chmod -R u+rwX "$HOME/tahai-browser-linux-build" 2>/dev/null || true
sudo rm -rf "$HOME/tahai-browser-linux-build"
```

Then rerun:

```bash
cd /mnt/c/dev/browser/app
bash scripts/build-linux-installers.sh
```

## tsc: not found

Symptoms:

```text
sh: 1: tsc: not found
DIST_MAIN_MISSING
```

Cause:

`npm ci` did not complete, usually due to a permission failure or Windows npm interop.

Fix:

Clean the Linux-native build folder and rerun the build script. Do not run `npm run build` manually from a half-installed mirror folder.

## dist/main/main.js missing from app.asar

Symptoms:

```text
Application entry file "dist/main/main.js" ... was not found in this archive
```

Cause:

Electron Builder ran after a failed or skipped TypeScript build.

Fix:

The Linux build script now checks `dist/main/main.js` before packaging. Rerun the guarded script after fixing `npm ci`.

## Linux artifact names do not match x64

Electron Builder may emit native Linux names:

```text
TAHAI-Web-Services-Browser-1.8.30-x86_64.AppImage
TAHAI-Web-Services-Browser-1.8.30-amd64.deb
TAHAI-Web-Services-Browser-1.8.30-x86_64.rpm
```

The verifier accepts those names, and the WSL copy-back step writes canonical release names:

```text
TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
TAHAI-Web-Services-Browser-1.8.30-x64.deb
TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

## CRLF or BOM broke a Bash script

Symptoms:

```text
#!/usr/bin/env: No such file or directory
$'\r': command not found
```

Fix from PowerShell:

```powershell
Set-Location C:\dev\browser\app
$scriptPath = ".\scripts\build-linux-installers.sh"
$text = [System.IO.File]::ReadAllText((Resolve-Path $scriptPath))
$text = $text -replace "^\uFEFF", "" -replace "`r`n", "`n" -replace "`r", "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $scriptPath), $text, $utf8NoBom)
```

The repository `.gitattributes` enforces LF for `.sh`, `.mjs`, `.js`, `.ts`, `.json`, `.yml`, `.yaml`, and `.md` files going forward.

## Accidentally pasted Linux commands into PowerShell

Symptoms:

```text
Set-Variable : A parameter cannot be found that matches parameter name 'euo'
Sudo is disabled on this machine
Cannot find path 'C:\mnt\c\dev\browser\app'
```

Fix:

Run Bash commands through WSL:

```powershell
wsl -d Ubuntu-24.04 --cd /mnt/c/dev/browser/app -- bash -lc 'set -euo pipefail
bash scripts/build-linux-installers.sh
'
```

Or open WSL first:

```powershell
wsl -d Ubuntu-24.04 --cd ~
```

Then run Linux commands inside Ubuntu.
