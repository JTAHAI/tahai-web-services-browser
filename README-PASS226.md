# PASS226 — Enterprise Support Bundle v2

This repo-root patch adds the PASS226 source-side Enterprise Support Bundle v2 gate.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass226-enterprise-support-bundle-v2.mjs
npm run verify:pass-226-enterprise-support-bundle-v2
npm run verify:release-blockers
npm run build
```

## What it adds

- Enterprise Support Bundle v2 contract
- redacted-support / internal-diagnostics / public-triage profiles
- required app version, OS/runtime, package type, policy truth, install truth, mission diagnostics, browser settings, local data inventory, and redaction report sections
- secret-class blocking and redaction helper utilities
- generated support-bundle artifact exclusion checks
- false-claim checks for no installed-app smoke success, no GA readiness claim, and no runtime one-click export claim
- QA doc for manual Windows/Linux support bundle proof

## Boundary

PASS226 is source-side hardening only. No installed-app smoke success, no one-click runtime export success, no public GA claim, no Store/MSIX claim, no signed package claim, and no generated support bundle artifact is included.
