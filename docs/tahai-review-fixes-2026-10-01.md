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

Added **17 native regression cases** (8 mission/key/storage tests and 9 browser
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
