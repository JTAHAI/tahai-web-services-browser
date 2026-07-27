# PASS248 — MSIX Local Blocker Repair

PASS248 closes the first local execution blockers in the Microsoft Store/MSIX lane.

## Blockers found locally

PowerShell parser blocker repaired: `build-windows-msix.ps1` now starts directly with `param(...)`.


- `git tag -a v2.0.18 ...` failed because `v2.0.18` already existed.
- `npm run verify:store:git` correctly failed because the current `HEAD` was not tagged `v2.0.18`.
- `npm run package:win:msix` failed before doing packaging because `build-windows-msix.ps1` did not parse in Windows PowerShell.

## Repair

- `packaging/windows/build-windows-msix.ps1` now starts directly with `param(...)`.
- The script uses `& npx @packArgs` for the WinApp CLI command and checks `$LASTEXITCODE` after external commands.
- `scripts/verify-store-git-readiness.mjs` now distinguishes a missing tag from an existing tag that points at the wrong commit.
- `scripts/repair-store-v2-tag-to-head.mjs` provides a local-only retag helper after the pass is committed.
- `scripts/verify-pass-247-windows-store-msix-readiness.mjs` now checks the PowerShell parser-sensitive shape.
- `scripts/verify-pass-248-msix-local-blocker-repair.mjs` validates the blocker repairs and scans text/source files for Windows-path control-character drift.

## Local command sequence

```powershell
Set-Location C:\dev\browser\app
Expand-Archive "$env:USERPROFILE\Downloads\TAHAI-browser-pass248-msix-local-blocker-repair-patch-20260513.zip" -DestinationPath . -Force
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run build
git status --short
git add .
git commit -m "PASS248: repair MSIX local blockers"
npm run repair:store-tag:2.0.18
npm run verify:store:git
npm run package:win:msix
```

## Store gate remains blocked

This pass repairs the local build lane only. Microsoft Store submission remains blocked until installed Windows smoke, package identity, Partner Center identity, Store screenshots, privacy/support links, and release evidence are clean.
