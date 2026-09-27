# Visual nested-condition editing

The Studio condition tree now exposes nested AND/OR/NOT comparisons without
requiring JSON edits. It supports replacement, wrapping, appending, group-kind
changes, sibling reordering, explicit removal/collapse and root removal. Source
is the same round-trip representation used by the existing workflow editor.
Rendering alone does not mutate it. No runtime semantics or authority changed.

The new resource is separated from the main WebUI source. Text is rendered using
textContent, controls have labels and nested fieldsets, focus returns after edits,
and layout rules accommodate narrow widths. Protected inputs are excluded;
31-node/five-level/eight-member limits and the 64 KiB source limit remain enforced
by the workflow model. Detached, stale, wrong-step and read-only edits fail closed.
Native manifest validation remains authoritative before saving a profile draft.

## Evidence

Runner `out/tahai_ga_release_x64/workflow-checks-20260926-020023` finished
`2026-09-26T06:01:55.2715538Z`. Actual runner exit 0, native build exit 0,
source comparison exit 0; no compiler children remained after exit.
Production WebUI and browser-test objects compiled. All 10 actual journal cases
passed. All focused checks passed, including 230 Studio DOM checks (+21),
786 workflow model checks, creator/kit checks and 28 synthetic evidence guards.

Mandatory browser case
`TahaiWebUIBrowserTest.TahaiSkinStudioNestedConditionsEditSaveAndRejectStaleControls`
compiled but has NOT run. The DOM doubles do not prove browser rendering,
keyboard/Narrator behavior, native save/reopen or installed-package acceptance.
Synthetic fixtures now require 145 native/179 browser cases, not executed counts.

Source HEAD `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 47 captured overrides.
Identity: `6a1c76d7ed9ff371a8621779eb5097971b136f6ee7d2f810e25262190f52f7bd`.
Snapshot ZIP: `e12f57234baf81f8c3710b9d673ea2d11558badbb1110566666958cbf289560a`.
Build args: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
Creator kit: `1fc9e3ed23e9e98e7c3c92a0c13c5a06dfcd45d05bc8a59b558068e4038e8589`.
This note is outside the captured snapshot. No full release build, MSIX,
commit/push, package validation or Store action occurred. Remaining B0–B7
implementation, trust review and final runtime/security/package gates still block GA.
