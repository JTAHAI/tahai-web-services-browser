# PASS248 — MSIX Local Blocker Repair

Status: source repair complete.
Version: 2.0.0 unchanged.

## Why this pass exists

Local PASS247 validation proved the source gate and build were good, but two store-lane blockers appeared when running the real Windows commands:

- `v2.0.0` already existed locally, but the current `HEAD` was not tagged.
- `packaging/windows/build-windows-msix.ps1` had a stray leading character before `param(...)`, causing Windows PowerShell to parse parameter defaults as invalid assignments.

## What changed

- Repaired `packaging/windows/build-windows-msix.ps1` so `param(...)` is the first executable content.
- Hardened the MSIX PowerShell script with explicit `$LASTEXITCODE` checks after external commands.
- Fixed WinApp CLI invocation to use the PowerShell call operator: `& npx @packArgs`.
- Added `npm run repair:store-tag:v2.0.0` for the local pre-existing tag mismatch.
- Improved `npm run verify:store:git` so it explains whether the tag is missing or points at the wrong commit.
- Upgraded PASS247 verification so it catches the PowerShell parse issue before packaging.
- Added PASS248 verification and release-blocker wiring.
- Swept text/source files for escaped Windows path control-character drift from `C:\dev\browser\app` snippets.

## Store truth

Store submission remains blocked until installed smoke, Partner Center identity, package evidence, live privacy/support links, screenshots, and release evidence are clean.
