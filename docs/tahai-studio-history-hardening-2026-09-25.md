# Studio editing-history hardening

Continuation after the local workflow-starter gallery. Approved B0–B7 scope,
release settings, recovered toolchain and Store identity remain unchanged.

## Concrete correction

The former page-wide Ctrl/Command+Z handler intercepted undo while editing
other fields, including protected simulation inputs, and restored whole-draft
source instead of allowing ordinary text undo. Studio now leaves input,
textarea, select and editable-content shortcuts alone unless the target is the
source editor itself. Shadow-event paths, composition, already-handled events
and Alt-modified shortcuts are accounted for. Undo/Redo buttons continue to act
on source explicitly. No simulation value enters source history.

The extracted maintained resource is
`chrome/browser/ui/webui/tahai/tahai_skin_studio_history.h`.
History retains at most 50 states, 64 KiB UTF-8 per state, and 2 MiB of retained
UTF-8 text in aggregate. These are logical text budgets, not measured total JS
heap consumption. Oldest states are removed first. Oversized current edits are
not added to history: Undo first returns to the last retained state, without
skipping it, and Redo cannot resurrect the oversized edit. A new edit truncates
the old redo branch. Read-only/disabled drafts cannot replay changes. Restores
still use normal source validation/autosave, never package execution or grants.

The author guide and deterministic creator kit document keyboard ownership,
retention, oversized edits and the lack of a durable history backup.

## Tests and actual evidence

Added `tools/tahai/studio_history_test.js`, run by the existing focused runner.
All **35** real-resource event/budget checks pass in a DOM double: keyboard
ownership (including protected/editable fields and shadow paths), source
undo/redo, branching, entry/aggregate byte limits, multibyte text, invalid source,
oversized edits and read-only/disabled controls. This is not browser runtime.

Added mandatory browser case:
`TahaiWebUIBrowserTest.TahaiSkinStudioUndoRespectsTextFieldsAndRestoresSource`.
It uses real key presses for text-field undo and source undo/redo, and tests
oversized-edit recovery. The typed-character assertion is keyboard-layout
independent. It **compiled but has not executed**; real Windows focus/editing
and accessibility acceptance remain outstanding.

First successful focused run:
`out/tahai_ga_release_x64/workflow-checks-20260925-225816`.
Final run including the layout-independent assertion and final guide:
`out/tahai_ga_release_x64/workflow-checks-20260925-230017`.
Finished: `2026-09-26T03:01:48.3497147Z`.
Runner **0**, build **0**, source comparison **0**. The WebUI/browser regression
objects compiled and resources regenerated incrementally, with no GN/settings
change or concurrent input edits.

Also passed: 760 workflow-model, 194 Studio DOM-double, 143 Mission DOM/message,
12 capability-review, 30 placement, 10,034 geometry, 29 creator tests,
creator-kit/Guard consistency and 28 synthetic release-evidence checks.
All **10 actual journal executable tests** ran and passed again. No zero-test
selection is accepted. Full Mission/browser executables were not linked/run.
The positive synthetic package-evidence fixture now has 137 native/174 browser
results; those counts are not runtime execution totals for this batch.

## Provenance and release limits

- Native HEAD: `ead51c1f7ad8f8d0803184bbc610820766a4bb28` on
  `codex/ga-2.0.33-chromium-152`, plus 28 captured overrides.
- Source identity: `bf0b3f8af72a272d7fc0e95c03ff17b50f22f646f525e63b6f42a2184655b793`.
- Exact snapshot ZIP: `6a609977f2f568bd33707bb0fc29a551cceae2c94cc6b994f3699b0edfe07381`.
- Creator-kit ZIP: `0c1417b91cafb1892d8b850d53262519044ca1e8232494484fe1ef45809ed54b`.
- Unchanged build arguments: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.

This note was added after verification, outside that snapshot. All earlier
uncommitted implementation remains intact. No full browser build, MSIX,
installation, actual desktop interaction, upload, commit or push occurred.
Remaining functionality, independent trust review, exact-binary runtime gates
and isolated exact-package installation/upgrade acceptance remain required.
No final GA MSIX exists.
