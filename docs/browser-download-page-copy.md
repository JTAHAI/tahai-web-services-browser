# Browser downloads page copy — v1.8.30 preview

## TAHAI Web Services Browser v1.8.30 Preview

A Chromium-compatible command browser for developers, DevOps operators, IT engineers, support desks, and builders.

TAHAI Browser keeps normal browsing clean, then opens into Mission Control when the work needs more context.

### What is new

- Quad View and Mission Control for large monitors, support desks, and engineering workflows.
- Mission Tabs with role-aware panes for consoles, docs, runbooks, logs, tickets, evidence, monitoring, and live validation targets.
- First-run walkthrough and in-app KB guidance for Mission Control, 3-Up, Quad View, and evidence workflows.
- Windows installer handoff and Linux RPM/AppImage/DEB handoff manifests for release operators.
- Evidence Pack v3 for local handoff packets with redaction awareness.
- SHA256-first download UX so users can verify packages before installing.
- IT Docs and PSA reference contracts designed for future authorized server-side integration without storing provider secrets in the browser.

### Download

Publish downloads only on official TAHAI pages such as `browser.tahai.net`, `browser.tahaiportal.com`, or the official GitHub Releases page.

| Package | Best for | Verify with |
| --- | --- | --- |
| `TAHAI-Web-Services-Browser-1.8.30-x64.exe` | Windows x64 normal preview install | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| `TAHAI-Web-Services-Browser-1.8.30-x64.msi` | Managed/enterprise MSI testing | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| `TAHAI-Web-Services-Browser-1.8.30-x64.AppImage` | Portable Linux preview | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| `TAHAI-Web-Services-Browser-1.8.30-x64.deb` | Ubuntu/Debian-family package testing | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| `TAHAI-Web-Services-Browser-1.8.30-x64.rpm` | Fedora/RHEL-family and TAHAI OS/SENTINEL testing | `TAHAI-Linux-installers-SHA256SUMS.txt` and `TAHAI-Linux-installers-manifest.json` |

### Copy checksum verification

Windows PowerShell:

```powershell
$Expected = "REPLACE_WITH_64_CHARACTER_SHA256_FROM_TAHAI-Windows-installers-SHA256SUMS.txt"
$Actual = (Get-FileHash .\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($Actual -ne $Expected.ToLowerInvariant()) { throw "SHA256 mismatch" }
"SHA256 OK"
```

Linux:

```bash
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.deb' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.rpm' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
```

### Install commands

Windows:

```powershell
Start-Process .\TAHAI-Web-Services-Browser-1.8.30-x64.exe
```

Linux AppImage:

```bash
chmod +x TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
./TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
```

Ubuntu/Debian:

```bash
sudo apt install ./TAHAI-Web-Services-Browser-1.8.30-x64.deb
```

Fedora/RHEL:

```bash
sudo dnf install ./TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

### Preview warning

This is an Unsigned preview build / unsigned preview build. Windows may show a SmartScreen warning until the approved code-signing lane is active. Only install downloads from the official TAHAI site or the official GitHub Releases page.

### Best fit

- DevOps engineers switching between CI logs, cloud consoles, runbooks, and live targets.
- IT admins using Microsoft 365, Entra, Google Workspace, Cloudflare, registrars, ticket systems, and documentation in the same operational context.
- Builders using big monitors, ultrawides, or TV-style workstations who want browser panes that preserve useful aspect ratios.
- TAHAI OS/SENTINEL packaging flows that need a deterministic RPM handoff instead of filename guessing.

### Source posture

The project is open source under Apache-2.0 with TAHAI trademark attribution. Generated installers, generated handoff manifests, runtime profiles, caches, credentials, and local Mission data are not committed to the source repository.
