# PASS151 Enterprise Release Grade Checklist

Use this checklist after PASS151 lands and before public release publication.

## 1. Source gate

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:public-repo
npm run verify:release-blockers
```

Expected: all source gates pass, including PASS138, PASS139, PASS149, PASS150, and PASS151.

## 2. Windows packaging gate

```powershell
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run package:win:release
npm run verify:windows-installer-handoff -- all
```

Expected:

- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe`
- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi`
- `release/windows/TAHAI-Windows-installers-SHA256SUMS.txt`
- `release/windows/TAHAI-Windows-installers-manifest.json`
- `release/windows/TAHAI-Windows-installers-manifest.txt`

## 3. Linux packaging gate

```powershell
wsl -d FedoraLinux-43 --cd /mnt/c/dev/browser/app
```

```bash
/usr/bin/npm ci
/usr/bin/npm run build
/usr/bin/npm run diagnose:linux:rpm-toolchain
/usr/bin/npm run package:linux
/usr/bin/npm run verify:linux-installer-handoff -- all
```

Expected:

- `release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm`
- `release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb`
- `release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage`
- `release/linux/TAHAI-Linux-installers-SHA256SUMS.txt`
- `release/linux/TAHAI-Linux-installers-manifest.json`
- `release/linux/TAHAI-Linux-installers-manifest.txt`

## 4. Installed-app gate

Windows:

```powershell
npm run evidence:windows-installed-smoke -- -InstallerType nsis -Launch
```

Linux:

```bash
npm run evidence:linux-installed-smoke -- --package-type rpm --installed-bin /usr/bin/tahai-web-services-browser --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm --launch
```

## 5. Manual smoke gate

```powershell
npm run evidence:cross-size-regression -- --platform windows --operator "Justin"
```

Confirm at minimum:

- 960x640, 1024x768, 1366x768, 1920x1080, and 2560x1440 surfaces.
- Guide / KB remains reachable when moved into More Tools.
- Mission Control opens at small windows.
- 2-Up, Tri-view, Quad, and Focus Pane enter and recover cleanly.
- Active-pane routing remains correct.
- Empty topbar/tab-strip regions drag the app window.
- Tabs, tab close buttons, `+`, and native caption buttons remain clickable.
- Evidence export redaction still warns/redacts.

## 6. Enterprise evidence aggregation

```powershell
npm run evidence:enterprise-all-surfaces -- --strict
```

Expected:

- `artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json`
- `artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.md`

## 7. Release decision

Only publish as enterprise release grade when all prior gates pass and the PASS151 strict evidence report is not blocked.

After evidence is collected, remove generated source-local outputs before creating source zips or commits:

```powershell
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item .\dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item .\artifacts -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item .\.pass-runs -Recurse -Force -ErrorAction SilentlyContinue
git status --short
```
