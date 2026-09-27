# Studio persistence/privacy and capability revocation

This continues the existing native release tree and approved B0–B7 scope.
It is implementation/verification evidence, not GA or package acceptance.

## Studio

- Canonical JSON must fit the same 64 KiB budget as input and reload. A compact
  source that expands beyond that budget during formatting is rejected without
  replacing the last reloadable draft. Serialization failure also fails closed.
- An oversized stored draft can produce a safe default editor view without
  overwriting the original stored bytes.
- Private/non-regular Studio pages no longer read the inherited regular-profile
  draft. They present an empty read-only source; native save still rejects them.
- Added native cases `CanonicalGrowthCannotReplaceLastReloadableDraft` and
  `OversizedStoredDraftFallbackNeverOverwritesOriginalBytes`, and browser case
  `TahaiSkinStudioPrivateSurfaceNeverReadsRegularDraft`. These compiled; actual
  Mission/browser execution remains pending. The existing validated-save browser
  case and the new cases are now mandatory in release evidence.

Studio focused evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-205121`.
Runner/build/source comparison exited 0; ten actual journal tests passed.
Source identity: `967a4579990742481c52b6dbffa82ede712db0d514c1d94b024dcb826378dd8a`.
Snapshot: `ca74c28c8e70dc6502973ab640f89df3b8fddc6d0a956545e32708992918cb04`.
Earlier attempts `204425` and `204757` preserved missing-include diagnostics;
the required PrefRegistrySimple and JSONReader headers were added.

## Browser-owned grant review and revocation

The Policy page now lists stored provider/revision/origin/operation grants and
offers explicit per-grant revocation. The native handler keeps the reviewed rows;
the renderer submits only a single-use opaque review token and bounded row index.
Tokens expire after five minutes and are bound to the current active primary
Policy document. Revocation requires a transient user activation. Denied attempts
consume the review too. Refresh invalidates previous tokens/listeners.

Grant reading/revocation remains available when skins are disabled, but granting
and capability use remain disabled. Private, foreign-document and managed grant
stores cannot be exposed or changed through this surface. Malformed/future stores
remain preserved and report unavailable, not an apparently empty valid store.
All displayed values are assigned as text, not HTML. No page data or credentials
are fetched, and revocation cannot undo earlier external effects.

This closes only the stored-grant review/revoke slice of B6. It does **not** add
the initial grant-approval dialog, connector invocation, credential references,
extension protocol, selected-content capture or widget runtime. Those remain
implementation/review blockers; this page has no granting or invocation channel.

Added native case:
`TahaiCapabilityBrokerTest.DisabledSkinsStillAllowReviewAndRevocation`.
Added browser cases:

- `TahaiWebUIBrowserTest.TahaiCapabilityReviewRevokesWhileDisabledAndHidesPrivateState`.
- `TahaiWebUIBrowserTest.TahaiCapabilityReviewRejectsUnreviewedAndGesturelessRevocation`.

All six broker cases and both browser cases are now required by release evidence.
The new UI resource is independently maintained in
`chrome/browser/ui/webui/tahai/tahai_capability_review_ui.h`, included by the
existing WebUI build target. No GN regeneration/settings changes were needed.

## Final focused verification

Runner: `tools/tahai/verify_native_workflow_batch.ps1`.
Evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-210050`.
Finished: `2026-09-26T01:02:17.1979287Z`.
Runner exit **0**, build exit **0**, source comparison exit **0**.
The preceding `205836` run also passed, compiling the broker, broker tests, WebUI
and browser tests. During review, the gestureless browser case was corrected to
avoid the general navigation helper's synthetic gesture; the final run recompiled
that corrected test and repeated all focused gates.

Actual runtime: all **10** discovered `TahaiWorkflowJournalTest.*` cases passed.
Other passing checks: 733 workflow model, 174 Studio DOM-double, 143 Mission
DOM/message-double, **12 capability review DOM-double**, 30 placement, 10,034
geometry, 29 creator tests, creator-kit/Guard consistency, and 28 synthetic
release-evidence checks. Synthetic fixture totals are 137 native/171 browser
results; those totals are not tests executed by this run.

The new Studio/broker/native/browser regression objects compiled, but the full
Mission and browser executables were **not linked or run**. DOM doubles are not
Chromium runtime, accessibility, layout, persistence or installed-package proof.

Provenance binds native HEAD `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus all
17 captured overrides, including the untracked UI resource and event test:

- Source identity: `7352f20d24640b80d115203612df59470ab44a379d6f2bf97f611740d8b8d837`.
- Exact snapshot ZIP: `6b9486ad58be514bd8eae5e27e40abdf1708f7ab2c31f88a676d69d173d1b5c1`.
- Unchanged build arguments: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
- Journal executable: `67628aa66c4f588e3c45e5274ca38faa73b376151498cb50ee6c7a69dd78a592`.

This note was added after verification and is not part of that frozen snapshot.
Existing storage changes and all other uncommitted implementation were preserved.
No full browser build, package, installation, desktop interaction, Store upload,
new commit or additional GitHub push occurred in this continuation. The prior
GitHub checkpoint remains published; these later changes are uncommitted.

The authoritative roadmap and September 25 checkpoint retain the remaining
functionality, independent B1 trust review, actual browser/native acceptance and
isolated exact-MSIX installation/upgrade requirements. No final MSIX exists.
