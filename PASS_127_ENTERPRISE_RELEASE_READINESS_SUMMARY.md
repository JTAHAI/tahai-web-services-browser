# PASS127 — Enterprise Release Readiness Evidence

PASS127 consolidates the late enterprise-release hardening lane after the Linux RPM handoff manifest and makes the release gate easier to audit without committing generated artifacts.

## What changed

- Added `scripts/generate-release-evidence-report.mjs`, a source-only release evidence report generator.
- Added `scripts/verify-pass-127-enterprise-release-readiness.mjs` to verify the PASS112–PASS127 guardrail ledger, release-blocker ordering, source ZIP hygiene policy, and package target boundaries.
- Added `generate:release-evidence` for optional local report generation under ignored output folders such as `artifacts/` or `.pass-runs/`.
- Added `verify:pass-127-enterprise-release-readiness` and wired it into `verify:release-blockers` after PASS126 and before the final build gate.
- Tightened `.gitignore` and `verify:public-repo` coverage for generated installer/package outputs: ZIP, EXE, MSI, DMG, AppImage, DEB, RPM, and blockmap files.
- Added `docs/enterprise-release-readiness-pass127.md` as the human-readable release-readiness ledger for PASS112 through PASS127.
- Refreshed `NEXT_CHAT_STARTER.md` so the handoff no longer points back to PASS119 and preserves the older release-continuity markers required by prior verifiers.

## Guardrails covered

- PASS112–PASS123 chrome/overlay guardrails remain represented in `verify:release-blockers`.
- PASS124–PASS126 Linux RPM/toolchain/package handoff guardrails remain represented in `verify:release-blockers`.
- PASS127 now verifies that package/build targets are not falsely required by source-only release blockers.
- RPM handoff manifest files remain generated build outputs under `release/linux`, not source files.
- Source ZIP hygiene excludes `node_modules`, `dist`, `release`, `artifacts`, `.git`, `.pass-runs`, runtime profiles, local browser data, and installer outputs.

## Operator commands

```powershell
npm run generate:release-evidence -- --markdown --output artifacts/release-evidence/tahai-browser-release-evidence.md
npm run verify:pass-127-enterprise-release-readiness
npm run verify:release-blockers
```

## Scope

Browser-side release-readiness hardening only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets. No generated installers, package outputs, runtime profiles, or local data committed.

Version remains `1.8.30`.
