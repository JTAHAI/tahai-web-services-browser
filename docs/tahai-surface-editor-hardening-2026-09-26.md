# Surface editor stale-control and preview hardening

Read-only review found two concrete gaps: detached outline/order controls could
apply their captured node index to a newly selected surface, and a pending trial
was not cancelled when source changed before its preview reply arrived.

## Implemented

- Outline roles/directions, ratios, child swaps and keyboard-order edits require
  a connected enabled control, the exact source snapshot and the same surface.
  A stale control cannot edit a replacement tree, another surface or a read-only
  source. Disabled boundary-order moves cannot be invoked synthetically.
- Surface admission rejects duplicate/invalid IDs, malformed JSON, wrong schema
  and source above 64 KiB UTF-8. Pretty-print expansion is bounded before changing
  source. Complete native manifest validation remains authoritative on save.
- Studio assigns positive document-local request IDs to preview/reset. Keep,
  revert and state queries name the exact trial. Changing source/surface or
  leaving Studio cancels both pending and acknowledged trials. Stale responses
  cannot re-enable Keep; a delayed polling response cannot undo a Keep response.
- The native handler correlates these IDs with its existing browser-owned
  transaction and document. Stale keep/revert cannot affect a newer trial;
  replayed preview/reset requests are rejected. Legacy zero-ID calls cannot
  commandeer a newer identified trial. A new document may restart its counter;
  the high-water mark is bound to a WeakDocumentPtr, not a reused handler.
- Existing native profile, policy, gesture, active window/document, pane count,
  expiry and unguessable transaction checks remain. No tabs are created or
  navigated, and this grants no website/workflow authority.
- Added 32 actual shipped-listener checks in deterministic DOM/timer doubles,
  including source quota, UTF-8, detached edits, response order, pending cancel,
  read-only transitions, expiry, pagehide and reset. The focused runner now runs
  this file and explicitly compiles the existing surface handler object target.

## Verification

Final runner: `out/tahai_ga_release_x64/workflow-checks-20260926-021249`.
Finished `2026-09-26T06:14:17.9204161Z`. Actual runner exit 0, build exit 0,
source comparison exit 0; no compiler children remained afterward.
All 10 actual journal tests passed, along with 786 workflow model, 230 Studio
DOM, 35 history, 35 editor-response, 143 Mission DOM, 12 capability-review DOM,
30 placement, 10034 geometry, 32 surface-event, 30 creator and 28 synthetic
release-evidence checks. Creator-kit and Guard consistency also passed.

Mandatory case
`MultiContentsViewBrowserTest.TahaiSurfaceStudioRejectsStaleEditsAndTrialRequests`
compiled but has NOT run. It covers native trial replacement, stale keep/revert/
preview/reset, duplicate keep and a fresh Studio document starting at request 1.
The existing `TahaiSurfaceStudioEditsPreviewsAndRevertsOnNavigation` regression
now uses the shipped Keep button and its identified protocol. Neither has new
runtime evidence from this batch. Synthetic gates require 145 native/180 browser
cases; these counts are NOT suite execution claims.

## Source provenance

HEAD `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 51 captured overrides.
Source identity: `1d3241a5a992dfa61d85c1890b42ee0618d0e17bda5894f1a6bbbf906f881819`.
Snapshot ZIP: `6818a696e40744092bba5f167e949dcd1791ce5fa9afb2320414ae136655cf76`.
Build args: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
Creator kit: `9d3de6dd4e806e37b2f7959f41be05771e13903b97921b8fe2d894bab447f892`.
This note was added after verification, outside that snapshot. No full release
build, MSIX, new commit/push, package validation or Store action occurred.

Remaining B0–B7 implementation, exact-binary workflows, independent B1 trust
review and final security/accessibility/performance/recovery/package gates still
block GA. These focused checks do not close those requirements.
