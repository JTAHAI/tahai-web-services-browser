# Terminal Mission recovery review

Failed and cancelled operational Missions now allow manual acknowledgement of
their generated recovery checklist once no native attempt or wait is pending.
This never executes rollback, changes forward progress, replays an action or
turns a terminal run into success. Author-defined compensation remains separate
unfinished scope, not something supplied by this checklist.

The service validates the stored workflow and preserves archived, managed and
shutdown restrictions. A deadline settling an action during a review request
invalidates that request; the updated outcome must be reviewed first. The WebUI
retains current-document, user-gesture and mutation-token checks. Recovery events
are admitted by timeline integrity validation and survive restart.

## Focused verification

Existing runner: `out/tahai_ga_release_x64/workflow-checks-20260926-015002`.
Finished `2026-09-26T05:51:14.1049725Z`; actual runner exit 0, build exit 0,
source comparison exit 0. No compiler children remained after exit.
All 10 actual workflow-journal tests passed. All model/DOM, creator-kit, Guard
consistency and 28 synthetic release-evidence checks passed. These do not replace
native Mission or rendered-browser runtime evidence.

The following mandatory regressions compiled but have NOT executed:

- `MissionServiceTest.TerminalRecoveryReviewPersistsWithoutResumingOrChangingRunProgress`
- `MissionServiceTest.CancelledRecoveryWaitsForNativeOutcomeAndNeverReplaysIt`
- `MissionWaitTest.RecoveryReviewRequiresFreshStateAfterDeadlineSettlement`
- `TahaiWebUIBrowserTest.TahaiFailedMissionRecoveryReviewRequiresFreshGestureAndNeverResumes`

Synthetic release fixtures now require 145 native and 178 browser cases; those
fixture counts are not claims that these suites ran.

## Provenance

HEAD `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 45 captured overrides.
Source identity: `903ee319b904a803402c29f584764859c54aa552ee96bfa5117046378e7e3137`.
Snapshot ZIP: `fa6c2e578ddb79e2954c7619ba94b281484b55b9c61c830c6dbfec6507284c04`.
Build args: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
Creator kit: `4f65b6b35eb74737562598ee3c302e7b35c8e8d62b73c464aac0a860fa3b975d`.
This note was added after the capture and is outside that snapshot.

No full release build, MSIX, package validation, new commit/push or Store action
occurred. Remaining B0–B7 implementation, full runtime gates, B1 trust review and
final security/accessibility/performance/recovery/package evidence still block GA.
