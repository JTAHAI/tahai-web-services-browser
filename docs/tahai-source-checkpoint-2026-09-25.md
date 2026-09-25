# TAHAI source checkpoint — 2026-09-25

This is an implementation checkpoint, **not a GA release or an MSIX candidate**.
The user requested a checkpoint, commit and GitHub push at the next good stopping
point. No full release build, packaging, installation or Store upload accompanies
this checkpoint. The approved B0–B7 scope is unchanged.

## Source and completed batch

Active tree: `C:\src\TAHAI-GA\src`.
Branch: `codex/ga-2.0.33-chromium-152`.
Pre-checkpoint HEAD: `72a40778d721edb4e3521c842e78a510080edde0`.
The checkpoint preserves the accumulated native browser, skin, mode, surface,
workflow, Studio, trust, regression-test, release-tooling and website changes.
Historical website download metadata is not a newly built release.

The final batch adds typed native-action dispatch-status bindings to ordinary
text/selection workflow variables, with preceding-action validation, explicit
checkpoint completion, iteration-specific references, revision pinning, Studio
authoring/simulation, and persistence without replay. This exposes only a closed
browser dispatch status, not page contents, credentials, provider responses or
proof of successful work on a website. Failure/unknown outcomes remain terminal;
this is not a general external-action result or compensation engine.

The preceding hardening work covers active-document and mutation-token checks,
single-use Mission mutations, reviewed Evidence Pack confirmation, and bounded,
revocable encrypted-capsule operations. These implementations still require the
complete browser and security acceptance gates below.

## Verification and provenance

Runner: `tools/tahai/verify_native_workflow_batch.ps1`, using the recovered release
configuration without GN regeneration, toolchain replacement or a competing build.

Final local evidence directory:
`out/tahai_ga_release_x64/workflow-checks-20260925-181721`.

- Runner and focused Ninja build exit: **0**; final incremental build: 4/4 actions.
- Finished: `2026-09-25T22:20:33.5498064Z`.
- Source comparison exit: **0**, including all 206 pre-checkpoint overrides.
- Source identity SHA-256:
  `5aad9997573492287fa6e16c448cb66df44abbc88b4102cd8ae531ffadfb7ef7`.
- Exact dirty-source snapshot ZIP SHA-256:
  `8ef5254bb7756ff2f0cf4d3bdd5de4f3d0747367b7ae1f175a4c853a66c825e7`.
- Build arguments SHA-256:
  `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
- Creator-kit ZIP SHA-256:
  `38c2005593cb36e3a95ee0a1c06c25df3c29c1f787f8bb3097aab750b039cd88`.

Passing checks: 733 workflow model/validation/simulation; 174 Studio DOM-double;
143 Mission DOM/message-double; 30 mode-placement model; 10,034 geometry;
29 creator Python tests; creator-kit and Guard generated-data consistency;
27 synthetic packaging-evidence checks. An additional 11 runner/provenance tests
passed (log in the preceding `workflow-checks-20260925-181154` directory).

Six actual `TahaiWorkflowJournalTest` executable tests ran and passed:
`IntentSurvivesReopenAndCannotReplay`, `RejectedAttemptCannotBeRetried`,
`KeysAreBoundedAndSeparateRunsRevisionsAndSteps`,
`CorruptFileIsPreservedWithoutDispatch`,
`FutureVersionIsPreservedAndNotExecuted`, and
`QuotaCannotDiscardOldAttemptToAllowReplay`.

The new Mission, native-binding, manifest and browser regression sources compiled.
The full Mission/browser test executables were **not linked or executed** in this
batch. DOM doubles and synthetic release fixtures are not browser runtime evidence.
The six new action-status regression cases are mandatory in the release-evidence
allowlists, but are not claimed as passing runtime tests.

The first focused attempt (`workflow-checks-20260925-181154`) exited 1 because a
new test accessed optional validation without constructing it. The test now uses
`validation.emplace().max_bytes`; the successful incremental rerun above supersedes
that failure without deleting its diagnostics.

The provenance identity describes the dirty pre-commit tree, not HEAD alone.
This document was added after verification. Committing changes HEAD/index identity;
it does not retroactively turn this compile into a build of a clean commit or a
fully verified browser. Raw logs and source archives remain in ignored local output.

## Remaining release blockers

The September 13 roadmap remains authoritative. The September 20 completion
matrix is historical, not evidence that later source work passed runtime gates.

- B0: exact new browser baseline and full required runtime regressions.
- B1: independent trust/security review, interrupted-write/disk-full recovery,
  accessibility and current package-lifecycle runtime acceptance.
- B2–B3: the general mode/component configuration and surface/docking/breakpoint,
  typography/artwork scope beyond the implemented finite controls and pane tree.
- B4: general action-result data bindings, event/origin waits, per-step errors,
  compensation and remaining typed-expression/runtime scope.
- B5: complete palette/canvas/graph/inspector/template and build/sign/trust creator
  flow, including maintained resources and end-to-end acceptance.
- B6: complete reviewed origin-grant UI, credential references, provider-neutral
  connectors/extension protocol, isolated widget SDK, budgets and recovery.
- B7: completed templates/documentation/listing plus accessibility, performance,
  recovery, upgrade/state-retention and exact-package validation.

Required operational verification still includes modes; skin import, preview,
apply, revert and persistence; Studio; Mission launch/panes/focus/restore/notes and
restart recovery; actual Guard filtering/exceptions; Local OI privacy/disable;
evidence redaction/confirmed export/failures; Finder, mouse side buttons,
active-pane routing and supported window sizes/scaling.

Only after implementation and pre-package gates pass may the established pipeline
produce the final candidate. A designated isolated Windows package-validation
environment is still required. Preserve Justin's everyday installation/profile.

Preserve Store identity `TAHAIWebServices.TAHAIWebServicesBrowser`, publisher
`CN=D75EE668-B409-45ED-87E5-E37AA5FE3868`, application `TAHAIBrowser`, x64
`chrome.exe`, and the approved 2.0.33.0 / Chromium 152.0.7977.83 release settings.
The existing pipeline produces an unsigned Store candidate; no signed or certified
package is claimed here. No intermediate feature MSIX or old-binary repackaging.
