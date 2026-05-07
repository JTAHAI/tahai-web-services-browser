# Downloads and Checksums

Official release artifacts should be distributed through GitHub Releases or official TAHAI Web Services download pages.

Generated binaries are intentionally not committed to this source repository.

## Current artifact names

Version: `1.8.30`

Windows:

```text
TAHAI-Web-Services-Browser-1.8.30-x64.exe
TAHAI-Web-Services-Browser-1.8.30-x64.msi
```

Linux RC1:

```text
TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
TAHAI-Web-Services-Browser-1.8.30-x64.deb
TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

macOS developer builds, when built locally on macOS:

```text
TAHAI-Web-Services-Browser-1.8.30-x64.dmg
TAHAI-Web-Services-Browser-1.8.30-arm64.dmg
TAHAI-Web-Services-Browser-1.8.30-x64.zip
TAHAI-Web-Services-Browser-1.8.30-arm64.zip
```

macOS public releases should not be treated as trusted until Apple Developer signing and notarization are configured.

## Generate SHA256 checksums

Windows PowerShell:

```powershell
Set-Location C:\dev\browser\app
Get-FileHash .\release\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256
Get-FileHash .\release\TAHAI-Web-Services-Browser-1.8.30-x64.msi -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.AppImage -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.deb -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.rpm -Algorithm SHA256
```

Linux/macOS:

```bash
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.deb
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

On macOS, use `shasum -a 256` if `sha256sum` is unavailable.

## Verify SHA256 checksums

Windows PowerShell example:

```powershell
$expected = "PASTE_EXPECTED_SHA256_HERE"
$actual = (Get-FileHash .\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw "SHA256 mismatch" }
"SHA256 OK"
```

Linux example:

```bash
echo "PASTE_EXPECTED_SHA256_HERE  TAHAI-Web-Services-Browser-1.8.30-x64.AppImage" | sha256sum -c -
```

## Install notes

Windows:

- The current preview installers may be unsigned.
- Windows SmartScreen may warn until the approved signing lane is active.
- Only install preview builds from official TAHAI download pages or this repository's GitHub Releases.

Linux AppImage:

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

## Release publishing checklist

Before publishing artifacts:

1. Run source and release verifiers.
2. Build Windows artifacts on Windows.
3. Build Linux artifacts from WSL/native Linux using the Linux-native mirror script.
4. Generate SHA256 hashes.
5. Publish artifacts and hashes together.
6. Clearly label unsigned preview status where applicable.
7. Manually install and launch on each target OS before broad announcement.
