We are continuing TAHAI Web Services Browser after PASS249.

Repo:
C:\dev\browser\app

Public repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current version:
2.0.0

Latest completed pass:
PASS249 — MSIX WinApp CLI npm Invocation Repair

Latest patch ZIP:
TAHAI-browser-pass249-msix-winappcli-npm-invocation-repair-patch-20260513.zip

Latest full source ZIP:
TAHAI-browser-pass249-msix-winappcli-npm-invocation-repair-full-source-20260513.zip

What PASS249 fixed:
- `npm run package:win:msix` had reached WinApp CLI packing but failed because bare `npx winapp` tried to fetch a non-existent `winapp` npm package.
- MSIX packaging now prefers installed `winapp` on PATH and falls back to `npm exec --yes --package @microsoft/winappcli -- winapp ...`.
- PASS247/PASS248/PASS249 verifiers now block the stale bare-winapp invocation.

Run first after overlay:
Set-Location C:\dev\browser\app
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run verify:pass-249-msix-winappcli-npm-invocation-repair
npm run build

git status --short
git add .
git commit -m "PASS249: repair WinApp CLI MSIX invocation"

npm run verify:store:git
npm run package:win:msix

If verify:store:git fails because v2.0.0 no longer points at HEAD after the PASS249 commit:
npm run repair:store-tag:v2.0.0
npm run verify:store:git
npm run package:win:msix

Store submission remains blocked until installed Windows smoke, Partner Center identity/manifest, package evidence, privacy/support links, and release-truth gates are clean.
