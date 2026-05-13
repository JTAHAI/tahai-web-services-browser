# PASS247 — Windows Store / MSIX Readiness v1

PASS247 corrects 2.0.0 version truth and prepares the Microsoft Store/MSIX lane without claiming Store approval or trusted direct-download signing.

Run:

```powershell
Set-Location C:\devrowserpp
npm ci
npm run verify:pass-247-windows-store-msix-readiness
npm run build
npm run package:win:msix
```

Store submission remains blocked until installed smoke, Partner Center identity, Store assets/screenshots, support/privacy links, package evidence, and release-truth gates are clean.
