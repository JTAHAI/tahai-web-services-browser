# Studio workflow outline — implementation and focused evidence

This is the next B5 implementation slice after Studio/grant-review hardening.
The approved B0–B7 scope remains unchanged. This is not a GA or MSIX declaration.

## Implemented behavior

Studio now has a selectable visual outline of the currently selected workflow.
It shows authored order, conditions and their true/false/unresolved meanings,
explicit native actions, assignment destinations, timed waits/deadlines and
bounded repeat ranges. The summary distinguishes authored and expanded counts.
The outline describes the admitted ordered workflow; it does not introduce
arbitrary jumps, an external-action engine or an execution trace.

Step cards select the existing condition/assignment/wait inspector. Up/Down and
Home/End provide roving keyboard selection; Enter/click focuses the inspector.
Inspector selection updates the selected card. Existing validated step-order
controls remain authoritative. Source edits, workflow switches and reloads
refresh the outline; invalid source clears it. Stale detached controls cannot
select a replacement workflow. Selection never edits source, grants permission,
dispatches a native action or starts simulation. Read-only inspection cannot
write a draft. Rendering uses text for authored labels and conditions.

The dedicated resource header is
`chrome/browser/ui/webui/tahai/tahai_skin_studio_workflow_outline.h`.
Styles preserve order at narrow widths, wrap long labels, retain native focus
and add forced-color selection styling without animation. Actual Windows
rendering, keyboard/UIA/Narrator and scaling acceptance remain pending.

The author reference and deterministic creator kit now document this feature.
An older contradictory assignment sentence was also corrected against the
native validator: protected sources may copy only into protected destinations,
with no type conversion or privacy downgrade. No assignment behavior changed.

## Verification

Runner: `tools/tahai/verify_native_workflow_batch.ps1` with the recovered release
settings, no GN regeneration, no competing build and no source changes during
compilation/source comparison.

First evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-213910`.
The WebUI and browser-regression objects compiled (2/2 actions), runner/build
and source comparison exited 0, and all ten real journal runtime tests passed.

Final evidence, including updated author guide/creator archive:
`out/tahai_ga_release_x64/workflow-checks-20260925-214249`.
Finished UTC: `2026-09-26T01:43:46.445022Z`.
Runner **0**, build **0**, source comparison **0**; resource generation/repacking
completed successfully. The intermediate `214125` documentation run also passed.

Passing checks: 733 workflow model, **186 Studio DOM-double** (12 added outline
checks), 143 Mission DOM/message-double, 12 capability-review DOM-double,
30 placement, 10,034 geometry, 29 creator tests, creator-kit/Guard consistency,
28 synthetic packaging-evidence checks, and **10 actual journal runtime tests**.
No zero-selected suite is accepted.

The new actual-browser case is mandatory in release evidence:
`TahaiWebUIBrowserTest.TahaiSkinStudioWorkflowOutlineTracksInspectorWithoutMutatingDraft`.
It covers renderer-backed outline/inspector selection, keyboard focus, persisted
reload and invalid-source/stale-control handling. It **compiled but has not run**.
Full Mission/browser test executables were not linked or executed by this batch.
The synthetic evidence fixture now contains 137 native/172 browser results;
those counts are not actual tests executed here.

## Provenance and limits

- Branch: `codex/ga-2.0.33-chromium-152`.
- Native HEAD: `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 22 captured overrides.
- Source identity: `54eb3fe6e06f1824e1e05269da671219b5da2fde54b3ac0f832562c7201939b7`.
- Exact source snapshot ZIP: `07f4f39f6672659c75f6edbd329f05a1a541e9d162c3f2f529427844c42c802c`.
- Creator kit ZIP: `8b8573b5c75f81ffdc452142aff5bd97dbd47dd169117c5f2561038b2a9a905a`.
- Unchanged build arguments: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.

This evidence note was added after verification, outside that snapshot. Prior
uncommitted implementation was preserved. No full browser build, MSIX creation,
installation, desktop interaction, Store upload, commit or push occurred.

This does not close all of B5: the complete template/build/sign/trust flow and
full visual-component authoring still need implementation/acceptance. The other
remaining B0–B7 scope, independent B1 trust review, exact-binary native/browser
gates and isolated exact-package install/upgrade checks remain required. There
is still no final GA MSIX.
