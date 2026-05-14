# PASS247 — Windows Store / MSIX Readiness v1

PASS247 starts the Microsoft Store/MSIX lane after the 2.0.0 polish release. It is a source-side readiness pass only. Store submission remains blocked until installed smoke testing, Partner Center identity, package evidence, privacy/support links, and release-truth gates are clean.

## What changed

- Corrected source version truth to `2.0.0` in `package.json`, `package-lock.json`, and `src/shared/release-truth.ts`.
- Added a Windows-only `package:win:msix` lane that builds the app, creates a Windows unpacked app, copies Store/MSIX assets, renders a manifest, and delegates MSIX packing to Microsoft WinApp CLI.
- Added MSIX readiness config and manifest template with placeholder Store identity values.
- Added Store listing/submission packet source draft for 2.0.0.
- Added Store/MSIX placeholder assets derived from the TAHAI spider icon.
- Added `verify:store:git` for real-repo clean status and `v2.0.0` tag verification.
- Added generated-artifact exclusions for MSIX, APPX, Partner Center, and signing files.

## Commands

```powershell
Set-Location C:\dev\browser\app
git status --short
git tag --points-at HEAD
npm ci
npm run verify:store:git
npm run verify:pass-246-devops-tool-dialog-closeout
npm run verify:pass-247-windows-store-msix-readiness
npm run build
npm run package:win:msix
```

## Release truth

The MSIX lane can prepare a local package, but source checks do not approve Microsoft Store submission. Direct MSI/EXE/MSIX downloads remain unsigned-preview unless a trusted signing path is completed separately. Do not commit `.msix`, `.msixupload`, `.appx`, `.appxupload`, `.pfx`, `.cer`, private keys, Partner Center files, package identity files, or generated Store output.

## Blockers before Store submission

- Real repo must be clean and tagged `v2.0.0` at the submitted commit.
- Installed Windows smoke must pass from the installed package, not just source.
- Partner Center app name and package identity must be reserved.
- Placeholder manifest publisher values must be replaced with final Partner Center identity.
- Store screenshots must use sanitized demo data.
- Privacy, support, security, known-issues, and code-signing policy links must be live and accurate.
- Package hashes, SBOM/provenance, and support bundle evidence must be coherent.
