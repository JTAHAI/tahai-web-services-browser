# Local workflow-starter gallery — focused implementation evidence

Continuation of the B5 Studio implementation in the existing native release
tree. The approved B0–B7 scope is unchanged; this is not GA/package acceptance.

## Implemented

Studio now previews six local workflow starters: Research desk, Creator studio,
Personal planning, Learning space, Operations console and Blank focus checklist.
An explicit Add action clones a starter under a unique workflow ID and selects
the independent copy for editing. Preview alone does not change source.

Existing definitions, mode bindings, surfaces and capabilities are preserved.
There are no entered values, native actions, website references, grants,
credentials, connector configuration or live run state in the starters. The
creator and learning examples include bounded boolean conditions; other examples
include typed local inputs and named outputs. All steps are manual instructions
or explicit checkpoints. Simulated false/true branches complete without effects.

The normal source validation, autosave, undo/redo and reload path is reused.
Unknown templates, read-only/invalid source, the 24-workflow quota and oversized
source reject addition without replacing existing work. Repeated additions use
distinct IDs. Returned catalog objects are copies, not mutable internal state.

These are **workflow starters**, not the complete B7 operational-skin templates.
Research capture, publishing adapters, calendar access, diagnostics, full surface
templates, package/screenshot walkthroughs and end-to-end acceptance remain
separate outstanding work. The UI and author guide explicitly describe manual
work rather than claiming disconnected integrations. The creator kit was rebuilt
deterministically with the updated guide; this is not an MSIX package.

## Verification

Runner: `tools/tahai/verify_native_workflow_batch.ps1`.
Evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-221948`.
Finished: `2026-09-26T02:21:26.4840958Z`.
Runner exit **0**, focused build exit **0**, source comparison exit **0**.
The WebUI and browser-regression objects compiled and resources were regenerated
under the preserved build settings. No inputs changed during compilation.

Passed: **760** workflow model/validation/simulation checks (27 added), **194**
Studio DOM-double checks (8 added), 143 Mission DOM/message-double checks,
12 capability-review DOM-double checks, 30 placement checks, 10,034 geometry
checks, 29 creator tests, creator-kit/Guard consistency and 28 synthetic
release-evidence checks. All **10 actual journal executable tests** also passed.

The required browser case is:
`TahaiWebUIBrowserTest.TahaiSkinStudioLocalStartersPersistWithoutAuthorityOrBindingChanges`.
It exercises all six starters through the renderer, native validated save,
reload, unchanged grant state and unchanged pre-existing definitions/bindings.
It **compiled but has not run**. Full Mission/browser executables were not linked
or executed. The positive packaging fixture now has 137 native/173 browser
results; those synthetic counts are not actual runtime execution totals.

## Provenance

- Branch: `codex/ga-2.0.33-chromium-152`.
- Native HEAD: `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 25 captured overrides.
- Source identity: `63e4b5896d40c80315772518569f5e91e5268b0a96db6d9cb01d56040947473b`.
- Source snapshot ZIP: `061f0a3db8be375c809cadecf7edd5cc4ff6c2b0e93235cda4654d648b7e194e`.
- Creator kit ZIP: `6952d683ec178cff064d41389c3e54b5c281fa228e8b555e8543d99a24dfce9b`.
- Unchanged build arguments: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.

This note was added after verification and is outside that snapshot. All prior
uncommitted implementation was preserved. No full browser build, MSIX, install,
desktop interaction, Store upload, commit or push occurred. Remaining roadmap
functionality, independent trust review, exact-binary operational/security gates
and isolated exact-package install/upgrade validation remain release blockers.
There is still no final GA MSIX.
