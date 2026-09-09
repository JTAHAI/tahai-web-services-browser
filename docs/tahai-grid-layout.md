# Native adjustable Tri/Quad layout

Status: source implementation, not compiled or runtime-certified. This covers
the adjustable-divider workflow in upgrade 031 and part of restoration/keyboard
upgrades 008/039. It does not complete drag-to-arrange, linked scrolling, all
pane toolbars, named workspaces, or the rest of the approved roadmap.

## Interaction and ownership

- Tri View has one full-width row divider and a column divider confined to its
  two-pane row. The other reference pane is not covered by the column handle.
- Quad View has independently adjustable rows and columns. Divider thickness
  follows the native resize handle's preferred size, not page CSS.
- Dragging uses native Views mouse/touch handling. F6 reaches each divider;
  arrows resize in its axis. Home or double-click/double-tap resets that axis.
  No tab navigation, reload, account change, or renderer input mirroring occurs.
- Geometry reserves 200 DIPs per side where possible. Constrained viewports
  reduce that minimum symmetrically; dimensions never become negative, even
  below the divider thickness. Window resizing does not overwrite the user's
  preferred ratios. Screen-reader values reflect effective layout dimensions.
- A drag is bound to the original split ID and axis. Tab-set switches, focus
  mode, layout changes, and contents reassignment cancel it. Capture loss
  finishes at the last reported drag delta rather than a screen-coordinate
  fallback. Applying only a new orientation retains the split ID and active tab.
- `TabStripModel` owns the visual data and notifies native views through its
  existing split observer path. Intermediate drag events do not deliberately
  schedule persistence; the delegate commits at completion, including when
  the last delta is unchanged. Off-the-record windows do not obtain a regular
  SessionService for these writes.

## Persistence and migration

`SplitTabVisualData` stores independent row/column ratios alongside the existing
Dual View ratio. Values are finite and bounded to 0.1–0.9; non-finite direct
inputs reset to 0.5. Changing Dual/Tri/Quad presentation carries the ratios.

Session visual-data updates, recently closed split commands (after their pane
count), and recently closed tab split-data commands append the same trailer:

1. `uint32` marker/version `0x54414731`.
2. Row ratio as a double.
3. Column ratio as a double.

Old commands ending before the trailer restore balanced grid ratios. An
unknown, incomplete, non-finite, out-of-range, or extra-data trailer is rejected
without partially changing the destination visual data. Normal session command
framing remains unchanged; this is not a standalone import format.

## Required native evidence

Focused native test definitions:

- `MissionServiceTest.TahaiGridRatiosAreFiniteAndBounded`
- `MissionServiceTest.TahaiGridSessionTrailerRoundTripsAndReadsLegacy`
- `MissionServiceTest.TahaiGridSessionTrailerRejectsCorruptionAtomically`

Browser-test definitions:

- `MultiContentsViewBrowserTest.TahaiGridGeometryNeverOverlapsAtTinySizes`
- `MultiContentsViewBrowserTest.TahaiGridDividersResizeResetAndKeepTabs`
- `MultiContentsViewBrowserTest.TahaiGridResizeCannotCrossTabSetsOrFocusMode`
- `MultiContentsViewBrowserTest.TahaiGridCaptureLossAndOrientationKeepRatios`
- `SessionRestoreTest.TahaiGridRatiosSurviveBrowserRestart`

Existing SessionService split-data and recently-closed Quad tests now exercise
non-default grid ratios. The existing Incognito Quad browser case exercises the
production grid-resize delegate. All remain unexecuted against this source.
The packaging evidence gate requires the eight new named regressions, in
addition to its existing complete discovered-TAHAI selection.

Layout-count transitions now prepare replacement panes before removing the
existing split, retain existing sibling panes before unrelated tabs, and roll
back only newly created unchanged New Tab panes. A pane that acquires navigation
or unload state is preserved. Browser-owned creation callbacks cannot smuggle
an existing or foreign-profile tab into cleanup. Added mandatory source tests:

- `MultiContentsViewBrowserTest.TahaiLayoutFailureRetainsOriginalSplit`
- `MultiContentsViewBrowserTest.TahaiLayoutFailurePreservesChangedCreatedPane`
- `MultiContentsViewBrowserTest.TahaiLayoutRejectsExistingAndForeignCreationResults`
- `MultiContentsViewBrowserTest.TahaiLayoutShrinkKeepsExistingSiblingPanes`

These four failure/transition cases are not executed native test results yet.

Before release: execute these against fresh binaries; manually verify touch,
screen-reader announcements, keyboard exit/entry, RTL, high contrast, 100–200%
DPI, monitor transitions during dragging, 3→4→2→3 changes, closed-window restore,
and installed-package upgrade from the prior Store version. The new strings
use Chromium's localization resources; XML validity is not translation QA.
