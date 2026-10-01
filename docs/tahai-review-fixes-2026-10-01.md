# Review follow-up — 2026-10-01

The attached review targeted publication `2090b34610`; its first five findings
were already repaired in the tree published at `23c0fc4e03442f85297df1e0a70cfc0d75dca69d`.
This follow-up closes the remaining source/release-chain gaps, not native
Chromium 154 or package acceptance.

- Added source-only push/PR CI with full Royal render coverage, immutable action
  pins, read-only credentials and exact-commit evidence artifacts.
- Added an explicitly dispatched dedicated self-hosted native acceptance workflow.
  It requires a clean prepared tree matching the dispatch, keeps compilation
  serialized and defaults to BuildOnly. No native workflow was dispatched here.
- Centralized the source suite/evidence contract and added fail-closed fixtures
  for missing, duplicate, skipped, failed and zero selections, hash tampering,
  version loss, changed script/source identity and invalid timing.
- Made full source preflight mandatory before GN/compilation, including BuildOnly.
  Source provenance now separately binds the tree/source-only identity and build
  arguments. Mutation during source checks, generation or compilation is rejected.
- The assembler copies the complete source summary and hashed suite logs;
  version-3 release evidence and the packager require the same source snapshot.
  Old/incomplete release manifests are rejected. Receipts include source tree
  and the preflight summary hash/count.

Native scope is unchanged: complete mission/browser/Windows-service suites,
operational smoke, trust/security, source provenance, and exact isolated package
installation/upgrade/state retention still require actual new binary evidence.
The user will build on another workstation. No binary, MSIX, Store certification
or successful native execution is claimed by these source and synthetic checks.

The full local source preflight passed **29/29 suites, actual exit 0** in
`out/source-review-20261001-014929-c45f4274/source-preflight-summary.json`.
It includes 41 packaging-contract fixtures, 32 source-preflight-contract fixtures
and 64 isolated stock-Edge CSS/keyboard/CSP checks. Both workflow files also pass
actionlint 1.7.12. Historical failed count-parser/tool-selection runs remain in
their separate evidence directories. Clean-checkpoint and hosted GitHub results
are recorded separately after publication; these are still not native evidence.

The first hosted run caught an actual Windows fresh-checkout gap: `.css` was
missing `text eol=lf`, so Git's CRLF conversion changed `studio.css` embedded in
the offline creator ZIP. A fresh Git export reproduced the exact mismatch.
Added the missing source attribute and a regression that exports a finite
creator fixture with `core.autocrlf=true` and verifies byte-for-byte kit
reproduction from that new tree. No creator artifact was regenerated to mask
the defect, and no Python version was downgraded. The failed hosted artifact
remains preserved at Actions run `36822146463` and locally under
`out/review-fixes-20261001/ci-first-run`.

## Iterative source repair after the next review

The user requested repeated repair/review cycles before compiling elsewhere.
The review of native `c32b793b057f1e04538e98c8edbec3def52754e5` found
additional coding defects; the following source repairs do not claim native
execution or a finished RC/MSIX:

- Guarded the skin manager's apply/reset/preview/revert, review teardown,
  cancellation and notification continuations against synchronous deletion or
  retargeting. Profile appearance cleanup now uses weak-owner restoration rather
  than an AutoReset writing to an invalid owner. Policy generations and reviewed
  tokens are rechecked across appearance notifications.
- Added a read-only `PrefService::GetRawUserPrefValue` API. Chromium's existing
  type-filtered accessor returns null for a wrong-typed user value, so earlier
  guards using that accessor were ineffective. Mode, custom-mode, workspace,
  Local OI, capability, mission, encrypted-keyring and appearance guards now
  validate actual user storage; existing tests no longer dereference the hidden
  wrong-typed value through the filtered accessor.
- Mission mutations reject unwritable storage before changing cached progress.
  A cached owner also refuses to replace an externally changed durable snapshot.
  Authenticated capsule imports are constructed fully and committed once, not
  chained through CHECK-protected mutations across preference callbacks.
  Loaded collections with unsupported/duplicate records, unknown record fields
  or rejected operational snapshots are read-only so a
  subsequent edit cannot silently erase skipped data; over-quota collections
  are rejected before cloning or restoring an unbounded mission list.
- Synchronous deadline settlement now stops continuation if preference
  notification deletes or shuts down the mission owner; ordinary mutations
  recheck storage policy afterward. Borrowed mutation arguments are owned across
  notifications. Queued workflow launches are consumed before mission creation,
  preventing callback replay and continuation after deletion at either boundary.
  Queue writes/consumption reject managed, wrong-typed and unknown-version
  storage, recheck actual state after notification and preserve a replacement
  launch rather than clearing or consuming it under stale authority.
- Keyring operations recheck raw storage after asynchronous encryption-provider
  completion, survive owner deletion at authorization/persistence boundaries,
  and report a decrypted key/record-ID mismatch as corruption, never success.
- Environment-rule writes validate the existing collection, exact canonical
  origins, known classifications, quota and native enum values before mutation.
- A window presentation restore rejects an observer's replacement even when
  that replacement did not release a skin lease or advance its generation.
- Smoke assembly verifies the original hashes and build-relative timestamps,
  copies unchanged report bytes/timestamps, checks the copied hashes and rejects
  collisions. Its validator is shared with the final package evidence gate.
  Passing retries and repeated test iterations are rejected as well as failures.

Added **27 native regression cases** (18 mission/key/storage/workflow tests and 9 browser
appearance/presentation tests), required by the release evidence gate. These
cases have **not been compiled or executed** here. The packaging guard now runs
54 synthetic checks, including actual shared smoke-copy helper calls; none of
these is browser runtime evidence. The prior clean snapshot's 33 new native
cases also remain pending on the build workstation.

Repeated reviews covered the repaired paths and their storage, notification,
policy and evidence consumers. No global absence-of-bugs claim is made. Source
preflight results and final Git identities are recorded in the ignored run
evidence after checkpointing. A fresh Chromium 154 compile and exact no-retry
native/browser/service gates, isolated operational/trust/security smoke and
eventual exact-package installation/upgrade/state-retention checks remain the
next acceptance stages. Historical Chromium 152 binaries and accessibility
diagnostics cannot establish acceptance of this source.

## Callback-boundary and nested-schema repair

The next source review found four additional issues in native `5aef3747ced1`:

- Queued keyring work re-entered the real OS Crypt provider while its first
  initialization callback was still on the stack. Queue advancement is now
  posted non-nestably after the client callback returns, with the operation reserved across
  preference and client callbacks. Completion stays FIFO, including reentrant
  requests and a client pumping a nested event loop; deletion cancels queued work.
  An additional encryption consumer pumping a nested loop during initialization
  also cannot run the queued advance before the provider's task unwinds.
- Native workflow callers retained raw service/handler/target pointers across
  synchronous mission preference notifications. Completion now owns its ID and
  checks a weak service after notification. Launch reserves its invocation
  before Begin, checks weak lifetimes and current document/window/mode/trust/
  durable-storage authority afterward and again after journal work. Cancellation
  clears the invocation before notifying observers, preventing recursive teardown
  from touching stale handler state.
  Begin exposes the pending token before notification; the handler cannot adopt
  a notification's newer token as if it belonged to the rendered invocation.
- The borrowed-ID deadline test tried to delete an unarchived fixture, which the
  product correctly rejects. It now archives that fixture before arranging the
  deadline and synchronous deletion boundary.
- Unknown fields within otherwise supported mission records could be discarded
  by Save. Nested workflow source/step/input/variable/output, evidence/note/
  timeline and link records now participate in read-only schema protection.
  Fixed-family steps also reject ignored operational metadata. The original
  durable collection is preserved rather than reconstructed from a projection.

Added seven native tests and one real browser regression, all required by the
release evidence gate, covering real-provider initialization, FIFO reentry,
owner deletion, durable policy/deadline changes, nested-field preservation and
document teardown during Begin/cancellation, retargeting and a changed mission
token during Begin notification. These eight new tests and the
corrected native fixture have not been compiled or executed here. Source-only
preflight evidence is recorded separately; compilation and native/runtime
acceptance remain on the build workstation. No binary or MSIX build was started.

## Main WebUI, Local OI and persistence-boundary repair

The review of native `6b84b65aff638f7290ff9f5f352cdbd8df3237a0`
identified four more source defects. This follow-up repairs those boundaries
and their related callers:

- Main WebUI mutation handlers now keep their continuation checks in local
  callbacks, checking weak handler/service lifetimes and the original document
  before every post-write response, projection refresh or reload. Checks also
  reject a pending replacement navigation, not just an already-invalidated
  document. Mission, Mode and Local OI references held by the WebUI are weak. The same
  protection covers Guard/policy/grant/studio writers and mode/identity replies.
  The broader caller pass also found Local OI HTML rendering continued through
  a notifying projection write with cached permission and raw owner pointers.
  Rendering now checks all three service lifetimes after refresh and re-reads
  policy before building any record snapshot. Teardown returns an inert page;
  policy revocation renders the disabled surface without local records.
  Creation and duplication consume their document opportunity before notifying;
  capsule import consumes its verified payload before commit and cannot replay
  or overwrite a newer verification from reentrant notification.
- Local OI direct writers and retained commits stop after synchronous deletion,
  shutdown or disabled collection policy. Environment classification cannot
  continue to the independent native rule write after teardown or operations
  policy revocation. Safe report generation rechecks reports/export permission
  after its notifying commit, before returning text to the clipboard caller.
- Native workflow Begin pins the reviewed token before deadline settlement and
  rechecks it after notifications. The handler explicitly supplies its original
  rendered token; it cannot adopt an observer's newer review as dispatch consent.
  Assignment, wait, checkpoint, run-state, input and archive controls likewise
  supply an owned reviewed token for post-settlement validation. Legacy trusted
  local service calls retain their explicit state-transition semantics.
- Generated capsule keys are returned only when the exact persisted ciphertext
  snapshot still exists, remains unmanaged and the document-owned authorization
  lease remains valid after notification. Clearing/replacing storage or revoking
  authority reports failure without exposing the generated key or clobbering
  the observer's replacement. Existing queue serialization remains intact.

Added **six native and five browser regressions**, all required by the release
evidence gate. They cover direct/projection/ingestion deletion, shutdown and
policy changes, stale native review during another run's deadline settlement,
key persistence/lease replacement and recovery, WebUI closure and pending
navigation, policy UI closure, capsule import reentry/closure and clipboard
preservation after key removal, and policy/shutdown during document-source
projection refresh. The synthetic evidence fixture now expects 211
native and 204 browser sentinel attempts; those counts are validator fixtures,
not actual runtime results or narrowed execution filters.

These eleven tests have **not been compiled or executed** here. Source preflight
and repeated source review are recorded separately. No further actionable defect
was found in the final reviewed patch and caller paths; this is not a global
absence-of-bugs or RC/runtime acceptance claim. Compile the exact published tree
and run the complete no-retry native/browser/service scopes and isolated
operational/trust/security gates on the build workstation before packaging.
