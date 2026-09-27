# Storage integrity and interrupted-write hardening

This continues the September 25 source checkpoint without changing its branch,
toolchain, release settings, Store identity or B0–B7 scope. It is not GA acceptance.

## Implementation

Both the native-action replay journal and skin package store now require their
exact versioned table definition and reject unexpected non-internal SQL objects.
A matching database version and table name alone are insufficient: a trigger can
otherwise acknowledge an insert without retaining intent, or discard a previous
skin revision during an apparently successful update. Unfamiliar databases are
preserved, not repaired, migrated or erased. The journal also requires exactly
one changed row before accepting an intent insert.

The native-action journal retains its existing contract: only a successfully
committed new intent permits dispatch. Existing intent, dispatched and rejected
records cannot authorize a replay. This does not promise protection against an
administrator deleting/restoring the entire profile or hardware that lies about
durable writes.

## Actual runtime evidence

Final runner: `tools/tahai/verify_native_workflow_batch.ps1`.
Evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-200705`.
Finished UTC: `2026-09-26T00:08:03.8123692Z`.
Build exit **0**, source-comparison exit **0**, no missing/zero-selected test success.

All ten discovered `TahaiWorkflowJournalTest.*` tests executed and passed.
The four added tests are:

- `UnexpectedSchemaCannotAcknowledgeUnpersistedIntent`: rejects a trigger or
  weakened table definition and preserves the database bytes.
- `BlockedRollbackJournalCannotAuthorizeOrEraseAttempts`: an actual temporary
  filesystem obstruction prevents SQLite journal I/O; no new action is authorized
  and the earlier dispatched/uncertain records survive reopening.
- `ExclusiveWriterCannotAuthorizeOrEraseAttempts`: an actual competing SQLite
  write lock fails closed and preserves prior replay protection.
- `AbruptWriterExitRollsBackWithoutReplay`: a hidden test child exits immediately
  with an open transaction and dirty spilled pages. Reopening recovers the hot
  rollback journal, preserves the previous dispatched and uncertain states, and
  removes the uncommitted rows. This is process-interruption coverage, not a
  simulated machine power cut.

The six prior journal tests also passed: intent/reopen, rejected replay, bounded
identity, corruption preservation, future-version preservation and quota/replay.
Every profile/database in these tests was a newly created disposable fixture;
the user's everyday browser/profile was not opened or changed.

The same runner passed 733 workflow-model, 174 Studio DOM-double, 143 Mission
DOM/message-double, 30 placement, 10,034 geometry and 29 creator checks, generated
creator-kit/Guard consistency, and 28 synthetic release-evidence checks. These
model/double/fixture results are not operational browser runtime evidence.

## Skin-store tests: compiled, execution pending

The production store and its unit-test object compiled successfully (2/2 final
incremental actions). The new tests are:

- `TahaiSkinStoreTest.UnexpectedSchemaCannotDiscardRollbackOrAcknowledgeUpdate`.
- `TahaiSkinStoreTest.DiskFullUpdatePreservesCurrentAndRollbackAfterReopen`.
- `TahaiSkinStoreTest.DiskFullRemovalPreservesCurrentAndRollbackAfterReopen`.

The disk-full cases inject SQLite `SQLITE_FULL` through Chromium's existing test
filesystem. They verify current/previous revisions and explicit retry after
reopening; they do not exhaust the user's physical disk. **They have not yet run**:
the full Mission test executable is not linked by this focused batch. This portion
of the B1 acceptance gate remains open until their actual runtime results pass.

All ten journal cases, these three store cases and the existing operational-skin
rollback case are now mandatory in final release evidence. A new negative fixture
proves omission of the actual interrupted-writer result rejects packaging. The
positive synthetic fixture contains 129 native and 167 browser results; those
counts are not real Chromium tests executed by this batch.

## Provenance and preserved diagnostics

- Native HEAD: `ead51c1f7ad8f8d0803184bbc610820766a4bb28`, plus seven verified source
  overrides. This note was added after verification; it was not a compiled input.
- Source identity SHA-256:
  `d12962d68bc8e455ca9e28194691cf6a1221861fd29fc10a52762ee283941120`.
- Exact override snapshot ZIP SHA-256:
  `fcfc5c0d8b435d364bc5d865296fefcd6624afecdca33bae9558ee21f3365851`.
- Journal test executable SHA-256:
  `67628aa66c4f588e3c45e5274ca38faa73b376151498cb50ee6c7a69dd78a592`.
- Unchanged build-arguments SHA-256:
  `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.

The initial journal compile at `workflow-checks-20260925-200159` failed because
the test passed a raw pointer to the SQL API's bounded-string argument. The test
now supplies `std::string`; diagnostics remain preserved. The journal-only rerun
at `workflow-checks-20260925-200343` compiled and ran all ten tests successfully.
The final run above adds the skin-store changes and reruns all ten journal tests.

No expensive full browser build, GN regeneration, package creation, installation,
Store upload or additional GitHub push occurred. The checkpoint/publication
histories remain separate as previously documented. Independent trust review,
full native/browser runtime gates, remaining functionality, operational workflows
and exact MSIX install/upgrade validation remain release blockers.
