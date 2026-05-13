# PASS230 — GA / Store Deploy Decision Gate

PASS230 is the final evidence gate for the PASS201–PASS230 hardening lane. It does not add features, does not submit to Microsoft Store, does not create an `.msixupload`, does not load Partner Center credentials, and does not claim that direct-download packages are signed.

The default source-side decision is intentionally blocked. Public GA, Microsoft Store submission, broad public installer push, and trusted direct-download signing language require proof that lives outside the source tree: installed-app smoke evidence, package hashes, SBOM/provenance, screenshots, privacy/support/known-issues links, Store identity, Store review status, and signing status.

## What PASS230 owns

PASS230 owns the final decision packet and release-truth guard for:

- Full UX hardening gate completion.
- Enterprise security and data gate completion.
- Release evidence gate completion.
- External distribution and signing gate completion.
- Microsoft Store submission readiness language.
- Direct-download signing and unsigned-preview truth.
- Known-issues and support posture before broad distribution.



Exact release-truth phrases for verification: PASS230 does not add features; PASS230 does not create `.msixupload`; PASS230 does not claim Store approval; PASS230 does not claim direct-download trusted signing.

## What PASS230 does not do

PASS230 does not:

- Add user-facing browser features.
- Change the version from `1.8.30`.
- Submit anything to Microsoft Store.
- Create `.msix`, `.msixupload`, `.appx`, `.appxupload`, installer, or release artifacts.
- Reserve Partner Center identity.
- Load Partner Center credentials.
- Add signing certificates, `.pfx`, `.cer`, private keys, or tokens.
- Claim Store approval.
- Claim direct-download trusted signing.
- Claim public GA readiness without manual evidence.

## Gate model

### G1 — Full UX Hardening Gate

This gate covers restored, small, maximized, and installed-app UX behavior. It requires evidence for normal browsing, website/content pane budget, one-click overlay/tool entry, Mission Control layouts, More Tools, Settings, Guide/KB, DevOps tools, IT tools, keyboard/focus accessibility, installed Windows UX, and installed Linux UX.

### G2 — Enterprise Security and Data Gate

This gate covers Electron security, webview/window/popup boundaries, IPC contract freeze, mission import fuzzing, managed policy truth, local data inventory, secrets/redaction gates, crash recovery, and session durability.

### G3 — Release Evidence Gate

This gate covers SBOM/provenance/checksums, Windows installer closeout, Linux package closeout, Enterprise Support Bundle v2, MSIX build lane readiness, MSIX manifest/Store identity readiness, Microsoft Store listing packet readiness, and generated-artifact exclusion.

### G4 — External Distribution and Signing Gate

This gate covers Partner Center identity, MSIX upload handling outside source, Store review status, direct-download signing status, public copy, and known-issues/support posture. Source verification can prepare this gate, but external approvals and signing proof cannot be truthfully manufactured by source code.

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

## Default decision

The default PASS230 decision is:

- `publicGaAllowed: false`
- `microsoftStoreSubmissionAllowed: false`
- `broadPublicInstallerPushAllowed: false`
- `directDownloadTrustedSigningClaimAllowed: false`

That default is not a product failure. It is the correct source-side posture until external/manual evidence exists.

## Required manual evidence before changing the decision

Before anyone changes the decision to allow release or Store submission, the release owner must attach evidence outside the repo for:

- Fresh installed Windows smoke evidence.
- Fresh installed Linux package smoke evidence.
- Support bundle generated from an installed app and reviewed for redaction.
- SBOM, checksums, release manifest, package hashes, and source-to-artifact traceability.
- Privacy, support, security, known issues, and code-signing policy pages being live.
- Store screenshots using sanitized demo data only.
- Partner Center identity and package upload handled outside source.
- Direct-download signing status accurately described.
- Known blockers resolved or explicitly documented with mitigation.

## Source hygiene

PASS230 adds ignore rules for generated decision output. These outputs are optional and must remain outside committed source:

- `ga-store-deploy-decision-generated/`
- `ga-store-deploy-decision-summary.json`
- `store-deploy-decision-output/`
- `production-release-output/`
- `public-ga-generated/`
- `store-review-generated/`

## Final anti-drift rule

If evidence is missing, the gate stays blocked. Do not substitute confidence, intent, screenshots without provenance, or source-side checks for installed-app, signing, Store, and manual operator proof.
