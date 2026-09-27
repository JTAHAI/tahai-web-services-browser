# Studio validation and save-response hardening

This is an implementation/evidence note, not B5 completion or GA acceptance.

## Implemented

- Native draft validation now returns only fixed diagnostic categories and JSON
  syntax line/column positions. It never returns raw parser error text or a
  rejected source snippet. Non-object JSON has a specific root-object category.
  Manifest diagnostics identify broad validator sections, not exact field paths.
- Studio's maintained editor resource moved out of `tahai_ui.cc`. It correlates
  replies with bounded per-document request IDs and the exact submitted text.
  Every source input invalidates the pending reply, even after an undo restores
  identical text. Duplicate/stale/unidentified replies cannot mark newer edits
  saved. Explicit Save cancels the queued autosave.
- Error text uses fixed strings and textContent. Last-valid-draft persistence,
  size limits, managed/private-profile boundaries and separate package authority
  remain unchanged. The one-source-argument native message remains compatible;
  the current editor uses the correlated two-argument form.
- Added deterministic shipped-JavaScript checks, two native persistence tests,
  and an actual browser regression definition. The new native/browser cases are
  mandatory final-release evidence, not marked passed by this focused run.
- Updated author guidance and regenerated the bundled creator kit.

## Verification

Evidence: `out/tahai_ga_release_x64/workflow-checks-20260925-234256`.
The existing runner finished at `2026-09-26T03:44:32.7339351Z`, actual exit 0.
Affected production/native-test/browser-test objects compiled. All 10 actual
workflow-journal tests executed and passed. Source comparison exit 0.

Other checks: 760 workflow-model, 194 Studio DOM, 35 history, 35 editor-response,
143 Mission input DOM, 12 capability-review DOM, 30 native-placement,
10034 geometry, 29 creator tests, 28 synthetic evidence guards, plus creator-kit
and Guard-list consistency. DOM checks are test doubles, not rendered-browser
or native-save execution. Synthetic evidence fixtures now contain 139 native
and 175 browser attempts; these are not runtime results.

Source: `ead51c1f7ad8f8d0803184bbc610820766a4bb28` plus 32 captured overrides.
Identity: `5ccc7e8ab8d356a2355309767f5d03f3ad196b5503c5d269ecbeaa30a83057ae`.
Snapshot ZIP: `d532102475f01aa861287a1c7b8add57654aca8e112bff290b5d3e3f002fda91`.
Build args: `63001589edd467ae64bfa661300d3f348934f9935a7fe462f25e65e6ef7f7a98`.
Creator kit: `f827b1a1732d5811f62b797510dbf133b83d73c4fca8e55a410822af627f15e5`.
This note was added after verification and is outside that source snapshot.

Pending runtime cases:

- `TahaiSkinStudioDraftTest.JsonDiagnosticsNeverEchoRejectedSource`
- `TahaiSkinStudioDraftTest.ManifestDiagnosticsIdentifyBoundedSections`
- `TahaiWebUIBrowserTest.TahaiSkinStudioDiagnosticsStayBoundToSubmittedSource`

No full browser release build, MSIX, package validation, Store action, new commit
or push occurred. The approved B0–B7 scope and trust/security blockers remain.
