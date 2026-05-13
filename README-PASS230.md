# PASS230 — GA / Store Deploy Decision Gate

PASS230 adds the final source-side GA / Store Deploy Decision Gate for TAHAI Web Services Browser. It validates the release decision packet, keeps the default release decision blocked until manual/external evidence exists, and prevents false public GA, Microsoft Store, broad installer push, or direct-download trusted-signing claims.

Run after overlay:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass230-ga-store-deploy-decision-gate.mjs
npm run prepare:win:msix-manifest
npm run prepare:store-submission-packet
npm run prepare:ga-store-deploy-decision-gate
npm run verify:pass-230-ga-store-deploy-decision-gate
npm run verify:release-blockers
npm run build
```

Boundary: PASS230 is an evidence gate only. It does not add features, does not change version `1.8.30`, does not submit to Microsoft Store, does not create `.msixupload`, does not reserve Partner Center identity, does not load Partner Center credentials, does not add signing material, does not claim Store approval, and does not claim direct-download trusted signing.


Exact release-truth phrases for verification: PASS230 does not add features; PASS230 does not create `.msixupload`; PASS230 does not claim Store approval; PASS230 does not claim direct-download trusted signing.
