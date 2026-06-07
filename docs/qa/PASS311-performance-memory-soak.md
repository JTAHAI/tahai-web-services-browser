# PASS311 — Performance / Memory / Long Session Soak

## Purpose

Close the performance / memory / long session soak gate for the TAHAI Web Services Browser enterprise reliability lane.

## Browser-side scope

This pass is an overlay/source contract only. It does not add IT Docs backend code, PSA connector code, direct PSA API calls, runtime secrets, generated installers, Store credentials, or signing material.

## Acceptance evidence

- `longSessionSoakContractExists`
- `tabOpenCloseCycleCovered`
- `missionLayoutSwitchCycleCovered`
- `overlayCycleCovered`
- `evidenceCaptureCycleCovered`
- `popupCycleCovered`
- `downloadCycleCovered`
- `detachedListenersGuarded`
- `zombieWebviewsGuarded`
- `mutationObserverStormGuarded`
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

This pass requires `PASS310` to remain PASS before its own gate can pass.
