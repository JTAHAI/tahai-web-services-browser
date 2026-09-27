# Typed boolean assignments — implementation and focused evidence

This extends B4/B5; it does not close either batch or establish GA readiness.

## Connected implementation

- `assign-variable` accepts exactly one `boolean_expression`, using the existing
  bounded predicate grammar (`all`/`any`/`not`, ordinary boolean/selection equality
  and numeric comparisons). Destination must be an ordinary boolean variable.
  Protected sources/destinations, ambiguous representations, missing references,
  unsupported types, excess nodes/depth and unknown operations fail validation.
- Native parsing, serialization, exact revision comparison, profile-local Mission
  persistence, creator-package validation, Studio round-trip and simulation all
  recognize the same declaration. No arbitrary expression code or new authority.
- The native runtime evaluates all references and returns the fixed diagnostic
  `missing-condition-value` when a valid expression lacks a value. Missing data
  never becomes false by short-circuiting. Explicit assignment alone changes the
  variable/checkpoint; failure leaves prior value, progress and freshness token
  unchanged. False is a valid stored value. Completed assignments never replay
  or recompute after input changes/restart.
- Studio has an advanced expression editor and a no-JSON conversion button using
  the existing condition controls. Conversion explicitly moves the selected
  step's availability condition into its boolean assignment, allowing either
  truth value to be stored. Run-command steps cannot be converted. Normal source
  validation/autosave/history and read-only controls remain in use. Reference
  deletion guards include boolean assignment trees.
- Mission labels identify yes/no calculations and display fixed errors through
  the existing explicit assignment UI. No connector, page read, grant, credential
  or external effect was added.
- Review found and corrected the prior expression adapter's fallback-to-boolean
  type mapping: it now recognizes all six exact wire types and rejects unknown
  types. Dates/URLs cannot become boolean predicate sources. Added native
  regressions for date/URL/unknown-type snapshots.
- Updated author guide and generated bundled creator kit.

## Verification (not full runtime acceptance)

Initial focused runner `out/tahai_ga_release_x64/workflow-checks-20260926-002521`
exited 0 at `2026-09-26T04:29:51.1931108Z`: 22 incremental resource/native objects,
all focused checks and 10 actual journal runtime tests passed. While it ran,
review was read-only. The type-mapping correction was applied only after the
runner and compiler children exited.

Final evidence: `out/tahai_ga_release_x64/workflow-checks-20260926-003015`.
Runner finished `2026-09-26T04:31:27.3223756Z`, actual exit 0. Affected Mission
production/unit-test objects rebuilt; build and source comparison both exit 0.
All 10 actual journal tests executed and passed with nonzero discovery.

Other checks: 786 workflow-model (+26), 202 Studio DOM (+8), 35 history,
35 editor-response, 143 Mission input DOM, 12 capability-review DOM, 30 placement,
10034 geometry, 30 creator tests (+1), 28 synthetic release-evidence checks,
creator-kit consistency and Guard-list consistency. DOM tests are doubles, not
rendered browser or native persistence execution. Synthetic fixture counts of
142 native and 176 browser attempts are not actual runtime results.

New mandatory final runtime gates compiled, but did NOT execute in this batch:

- `TahaiOperationalSkinManifestTest.BooleanAssignmentsAreBoundedTypedAndExcludeProtectedSources`
- `MissionServiceTest.BooleanAssignmentsFailClosedPersistFalseAndNeverReplay`
- `TahaiWorkflowNativeTest.BooleanAssignmentsRemainExactlyRevisionPinnedBeforeNativeDispatch`
- `TahaiWebUIBrowserTest.TahaiBooleanAssignmentsAuthorSaveAndRunWithoutAutomaticEffects`

## Exact source provenance

HEAD: `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 42 captured overrides.
Source identity: `29c12d88f7fe21d9e8517ea81fbae5932d78bb110c6802cf4960e487d5f52e2e`.
Snapshot ZIP: `03f59fba7b7c3f40968e3b9d0547ff85459320456d870c4ddd77d65bc54d261c`.
Build args: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
Creator kit: `805f18e58bcd62692e371966b4eb8f468ea28822f7dfe1fbe89ca4ce5a041b27`.
This note was added after final verification, outside that captured snapshot.

No full release/browser build, MSIX, package validation, new commit/push or Store
operation occurred. Remaining B0–B7 implementation, trust review, exact-binary
operational/security/accessibility/recovery and isolated package gates remain
release blockers. Boolean assignments do not implement action-result payloads,
event/origin waits, compensation, provider adapters or widgets.
