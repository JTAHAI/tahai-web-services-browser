# PASS249 — MSIX WinApp CLI npm Invocation Repair

PASS249 repairs the local MSIX lane failure where `npm run package:win:msix` reached the WinApp CLI pack step but PowerShell executed bare `npx winapp`, causing npm to search for a non-existent `winapp` package.

The Store/MSIX lane now:

- Prefers an installed `winapp` command if WinApp CLI is already on `PATH`.
- Falls back to the scoped npm package with `npm exec --yes --package @microsoft/winappcli -- winapp ...`.
- Keeps certificates and generated MSIX output out of source.
- Keeps Store submission blocked until installed smoke, Partner Center identity, package evidence, privacy/support links, and release-truth gates are clean.

Run after overlay:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run verify:pass-249-msix-winappcli-npm-invocation-repair
npm run build
```

Then commit and package:

```powershell
git status --short
git add .
git commit -m "PASS249: repair WinApp CLI MSIX invocation"

npm run verify:store:git
npm run package:win:msix
```

If `verify:store:git` fails because `v2.0.14` no longer points at `HEAD`, run this after the PASS249 commit:

```powershell
npm run repair:store-tag:2.0.14
npm run verify:store:git
npm run package:win:msix
```
