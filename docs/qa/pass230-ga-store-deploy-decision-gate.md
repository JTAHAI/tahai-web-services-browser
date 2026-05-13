# PASS230 QA — GA / Store Deploy Decision Gate

## Purpose

PASS230 verifies that the final GA / Store Deploy Decision Gate is source-side, evidence-driven, and honest. It prevents premature public GA, Microsoft Store submission, broad installer push, and direct-download trusted-signing claims when the required manual evidence and external approvals are not present.

## Commands

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

## Must pass

- `config/ga-store-deploy-decision-gate.example.json` exists and validates.
- `scripts/render-ga-store-deploy-decision-gate.mjs` validates the gate without writing output by default.
- `scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs` is wired into `package.json` and `verify:release-blockers`.
- PASS227 `package:win:msix` wiring remains intact.
- PASS228 `prepare:win:msix-manifest` wiring remains intact.
- PASS229 `prepare:store-submission-packet` wiring remains intact.
- PASS230 docs explain G1, G2, G3, and G4 gate ownership.
- PASS230 default source-side decision blocks public GA, Store submission, broad installer push, and direct-download trusted-signing claims.
- `.gitignore` excludes generated GA / Store decision outputs.



Exact release-truth phrases for verification: PASS230 does not add features; PASS230 does not create `.msixupload`; PASS230 does not claim Store approval; PASS230 does not claim direct-download trusted signing.

## Must not happen

- PASS230 does not add browser features.
- PASS230 does not change the version from `1.8.30`.
- PASS230 does not submit to Microsoft Store.
- PASS230 does not create `.msixupload`.
- PASS230 does not reserve Partner Center identity.
- PASS230 does not load Partner Center credentials.
- PASS230 does not commit generated installers, release packages, signing files, or Store output.
- PASS230 does not add secrets, `.pfx`, `.cer`, private keys, tokens, or certificates.
- PASS230 does not claim Store approval.
- PASS230 does not claim direct-download trusted signing.
- PASS230 does not claim public GA readiness without manual evidence.
- PASS230 does not add IT Docs backend code or PSA connector code.

## Manual decision checklist

The release owner must keep the gate blocked unless all of the following are externally attached and reviewed:

- Installed Windows smoke evidence.
- Installed Linux smoke evidence.
- Enterprise Support Bundle v2 sample from an installed app.
- SBOM/provenance/checksum evidence.
- Windows installer package evidence.
- Linux package evidence.
- Store screenshots with sanitized demo data.
- Store identity and upload evidence handled outside source.
- Known-issues, privacy, support, security, and code-signing links checked.
- Direct-download signing status checked and accurately stated.
