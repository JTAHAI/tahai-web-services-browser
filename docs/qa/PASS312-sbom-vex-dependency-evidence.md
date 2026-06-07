# PASS312 — SBOM / VEX / Dependency Evidence

## Purpose

Close the sbom / vex / dependency evidence gate for the TAHAI Web Services Browser enterprise reliability lane.

## Browser-side scope

This pass is an overlay/source contract only. It does not add IT Docs backend code, PSA connector code, direct PSA API calls, runtime secrets, generated installers, Store credentials, or signing material.

## Acceptance evidence

- `sbomContractExists`
- `dependencyAuditCaptureRequired`
- `licenseInventoryRequired`
- `vexNotesSupported`
- `sourceToArtifactTraceRequired`
- `noGeneratedInstallersCommitted`
- `browserSideOnlyScopePreserved`
- `storeSubmissionNotClaimed`
- `signedReleaseNotClaimed`
- `gaReleaseNotClaimed`

## Brand truth

- Primary browser accent: `.navLinkBrowser`
- Value: `rgba(96, 255, 218, 0.92)`

## Release truth

- Microsoft Store submission: not submitted / not approved
- Signed release claim: false
- GA claim: false

## Regression anchor

This pass requires `PASS311` to remain PASS before its own gate can pass.
