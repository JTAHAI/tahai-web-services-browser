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
