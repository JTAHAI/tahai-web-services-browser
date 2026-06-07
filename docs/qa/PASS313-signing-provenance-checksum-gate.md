# PASS313 — Signing / Provenance / Checksum Gate

## Purpose

Close the signing / provenance / checksum gate gate for the TAHAI Web Services Browser enterprise reliability lane.

## Browser-side scope

This pass is an overlay/source contract only. It does not add IT Docs backend code, PSA connector code, direct PSA API calls, runtime secrets, generated installers, Store credentials, or signing material.

## Acceptance evidence

- `releaseManifestContractExists`
- `sourceCommitRequired`
- `packageHashesRequired`
- `unsignedPreviewDisclosureRequired`
- `signingStatusTruthRequired`
- `signPathPacketReadinessDocumented`
- `signedReleaseNotClaimed`
- `storeSubmissionNotClaimed`
- `gaReleaseNotClaimed`
- `browserSideOnlyScopePreserved`

## Brand truth

- Primary browser accent: `.navLinkBrowser`
- Value: `rgba(96, 255, 218, 0.92)`

## Release truth

- Microsoft Store submission: not submitted / not approved
- Signed release claim: false
- GA claim: false

## Regression anchor

This pass requires `PASS312` to remain PASS before its own gate can pass.
