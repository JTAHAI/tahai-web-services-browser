We are continuing TAHAI Web Services Browser 2.0.14 after the runtime/browser recovery work and the current Store/MSIX release-truth cleanup.

Repo:
`C:\dev\browser\app`

Current state:
- `npm run build` passes.
- `npm run test:runtime-e2e` passes with 11 live scenarios.
- PASS337, PASS338, PASS339, PASS340, and PASS341 verifiers pass.
- Browser runtime recovered from the black/unclickable normal-browsing failure.
- Current follow-up work is Store / MSIX / enterprise-GA source-truth alignment for 2.0.14.

Useful commands:

```powershell
Set-Location C:\dev\browser\app
npm run build
npm run test:runtime-e2e
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run verify:pass-249-msix-winappcli-npm-invocation-repair
npm run verify:pass-159-enterprise-signing-provenance-sbom
npm run verify:pass-162-enterprise-ga-decision-gate
```

Store lane notes:
- PASS248: current-version store tag repair and local MSIX blocker cleanup.
- PASS249: WinApp CLI invocation repair for the MSIX packaging lane.
- Store submission remains blocked until real installed-package evidence, Partner Center identity, privacy/support links, listing assets, hashes, and manual signoff exist.

Hard scope:
- Browser-side only.
- No IT Docs backend.
- No PSA connector.
- No direct PSA/API calls.
- No secrets.
- No false Store/GA/signed claims.
