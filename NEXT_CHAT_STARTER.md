We are continuing TAHAI Web Services Browser after PASS248 — MSIX Local Blocker Repair.

Repo:
C:\dev\browser\app

Public repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current version:
2.0.0

Latest completed pass:
PASS248 — MSIX Local Blocker Repair

Latest patch ZIP:
TAHAI-browser-pass248-msix-local-blocker-repair-patch-20260513.zip

Latest full source ZIP:
TAHAI-browser-pass248-msix-local-blocker-repair-full-source-20260513.zip

PASS248 completed:
- Fixed the Windows PowerShell parser blocker in packaging/windows/build-windows-msix.ps1.
- Hardened MSIX build script exit-code handling.
- Fixed WinApp CLI invocation to use PowerShell call operator: & npx @packArgs.
- Added local v2.0.0 tag repair helper: npm run repair:store-tag:v2.0.0.
- Improved verify:store:git output for existing-tag-but-not-HEAD cases.
- Upgraded PASS247 verifier so this parse issue is caught before packaging.
- Added PASS248 verifier and release-blocker wiring.
- Fixed text/source control-character drift in C:\dev\browser\app command snippets.

Run first after overlay:
Set-Location C:\dev\browser\app
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run build

after committing PASS248:
git status --short
git add .
git commit -m "PASS248: repair MSIX local blockers"
npm run repair:store-tag:v2.0.0
npm run verify:store:git
npm run package:win:msix

Important:
repair:store-tag:v2.0.0 moves the local v2.0.0 tag only. Push or force-push the public tag only deliberately after confirming the public release/tag plan.

Next goal:
Run the MSIX packaging lane locally. If package tooling succeeds, produce installed Windows smoke evidence from the installed package and keep Store submission blocked until Partner Center identity/manifest/assets/listing evidence is clean.
