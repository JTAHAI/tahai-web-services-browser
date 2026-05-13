We are continuing TAHAI Web Services Browser after PASS247 — Windows Store / MSIX Readiness v1.

Repo:
C:\devrowserpp

Public repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current version:
2.0.0

Latest completed pass:
PASS247 — Windows Store / MSIX Readiness v1

Latest patch ZIP:
TAHAI-browser-pass247-windows-store-msix-readiness-patch-20260513.zip

Latest full source ZIP:
TAHAI-browser-pass247-windows-store-msix-readiness-full-source-20260513.zip

PASS247 completed:
- Corrected package/release truth to 2.0.0.
- Added Windows-only MSIX build lane: npm run package:win:msix.
- Added MSIX manifest template, Store readiness config, Store listing packet, Store/MSIX assets, installed Windows smoke checklist, git/tag verifier, and PASS247 verifier.
- Preserved release truth: Store submission remains blocked until installed smoke, Partner Center identity, package evidence, privacy/support links, and release-truth gates are clean.

Run first after overlay:
Set-Location C:\devrowserpp
npm ci
npm run verify:pass-246-devops-tool-dialog-closeout
npm run verify:pass-247-windows-store-msix-readiness
npm run build

Then on the real git repo:
git status --short
git tag --points-at HEAD
npm run verify:store:git

Next goal:
Run installed Windows smoke and MSIX build locally, then replace manifest placeholder identity with Partner Center reserved identity when available.
