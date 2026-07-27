# PASS344 - Microsoft Store Repo Cleanup Closeout

## Purpose

PASS344 closes the source-side cleanup gap before Microsoft Store handoff. It verifies that the repo can be prepared for Partner Center without accidentally claiming Store submission, Store approval, trusted signing, or public GA from source checks alone.

## Bug Found

The tracked Store evidence file could preserve stale local package/source metadata from an earlier dirty working tree. That made `npm run verify:store:submission` report obsolete source-provenance blockers instead of only the current real blockers: Partner Center identity, public URL review, listing screenshots, final package review, installed smoke, known-issues review, and operator approval.

## Fix

- Replaced the tracked Store evidence JSON with a sanitized fail-closed placeholder.
- Kept live package scans under ignored generated evidence: `release-candidate/generated/store-submission/package-evidence.generated.json`.
- Added `verify:pass-344-microsoft-store-repo-cleanup-closeout`.
- Wired PASS344 into the enterprise release-blocker contract after PASS343 and before build/runtime E2E.

## PASS344 Verifies

- Package artifacts, generated Store evidence, certificates, and private keys are ignored and not tracked.
- Tracked Store evidence cannot include stale dirty-tree dumps or old release tag/source metadata.
- Tracked Store evidence cannot claim submission, approval, public GA, signed MSI, signed EXE, or trusted Store release.
- MSIX version tracks `package.json` as `2.0.18.0`.
- Partner Center identity remains a placeholder until a real reserved identity exists.
- Store submission gate still requires real Partner Center, URL, listing, installed-smoke, known-issues, and release-truth evidence.
- Electron/webview security guardrails remain intact.
- Runtime feature coverage remains tied to the PASS337-PASS343 and runtime E2E chain.

## Acceptance Commands

```powershell
npm run verify:pass-344-microsoft-store-repo-cleanup-closeout
npm run verify:release-blockers
npm run build
npm run test:runtime-e2e
```

## Store Truth

As of this pass, the source repo is cleaner for Microsoft Store handoff, but the app is still not submitted, not approved, and not public GA from source evidence alone. Final Store upload remains blocked until Partner Center identity, final package evidence, installed smoke, public URL review, screenshots/listing assets, known-issues review, and operator approval are completed.
