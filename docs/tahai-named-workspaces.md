# Native named workspaces — source contract

Status: source implementation and regression definitions only. No fresh native
compilation, runtime pass, packaged-install verification, or GA claim.

## User workflow

The native app menu exposes Saved workspaces in every normal work mode. The
Daily Driver workspace action and saved-workspaces rail module use that same
browser command. Repeated activation reuses the owning browser's manager.

- Enter a name and Save current window to add a new record. This never silently
  replaces a same-name record or discards an older record to make room.
- Cards display the saved name and counts of tabs, groups and pane layouts.
- Open in new window restores into the same regular profile, without closing,
  reordering, or navigating the source window.
- Rename changes only the name. Cancel rename returns to creating a new record.
- Delete requires native confirmation and removes the saved record only, not
  open tabs, cookies, bookmarks or browser history.

The manager subscribes to record/policy preferences, so another window's edits
and policy changes refresh its contents. Every operation re-reads current
storage; a removed or invalid ID is not acted on through a stale UI snapshot.

## Data and privacy

`tahai.named_workspaces` is a non-syncable, profile-local dictionary with schema
version 1 and an entries array. Records contain a random UUID, user name,
ordered navigation URLs, pinned state, tab-group title/color/collapsed state,
2/3/4-pane membership, orientation and divider ratios, active tab, mode, rail
state and expanded width. These URLs can contain private query data. Saving is
explicit, with a privacy notice; storage is **not** separately encrypted from
the browser profile and is not a Mission Capsule or a sync implementation.

No cookies, page bodies, form values, POST bodies, navigation history, arbitrary
scripts or account authority are captured. Reopening revisits URL references;
it does not resurrect unsaved work or transport a signed-in session. Chromium
still owns navigation and site permissions. Background entries use Chromium's
deferred, no-renderer restore path rather than fetching every saved URL at once.

Private, guest and non-regular profiles cannot read or persist these records.
No implicit original-profile fallback is used. Presentation is applied as a
window-local snapshot; restoring a saved rail does not overwrite the profile
default or a sibling window. Explicitly choosing a mode leaves this workspace's
rail override and returns to that mode's profile preferences.

## Validation and bounds

- At most 24 records, 64 tabs per record, and 4 MiB of serialized store JSON.
- Names: nonempty valid UTF-8, at most 120 bytes, no ASCII control characters.
  Group titles: at most 256 UTF-8 bytes; colors must be valid Chromium colors.
- HTTP(S), New Tab, blank tabs and exact browser-owned TAHAI routes only;
  embedded URL credentials and oversized URLs are rejected. Unknown internal
  routes, query-bearing TAHAI routes, file/data/javascript/blob URLs are rejected.
- TAHAI public aliases restore through their fixed trusted `chrome://tahai`
  counterparts, not arbitrary custom-scheme navigation or renderer privileges.
- Pinned tabs form a prefix; groups and splits are contiguous and internally
  consistent. Splits cannot overlap, cross groups or mix pinned/unpinned tabs.
- Invalid indices, unknown fields/versions, duplicate IDs, invalid UTF-8,
  invalid orientation and nonfinite/out-of-range ratios fail closed. An invalid
  store is not rewritten or implicitly reset.

A saved active group is expanded when reopened so its active pane is reachable.
Failure during window creation leaves any newly created partial window intact;
the original window is not destructively used as a restore target.

## Enterprise control

`TahaiNamedWorkspacesEnabled` (downstream policy ID 1470, atomic group 66) maps
to `tahai.named_workspaces_enabled`, default true. Mandatory policy overrides
the profile preference. False disables feature reads, saves, opens, renames and
deletes on subsequent operations and refreshes an open manager. It does not
erase records or affect already open tabs, bookmarks, or Chromium session
restore. Existing records become available if the policy is reenabled.

The downstream Windows policy definition, policy handler and mapping test are
source changes. Managed Windows deployment has not been exercised. The fork's
existing Chromium policy registry root is retained; do not claim a separately
deployed TAHAI management service.

## Required runtime evidence

New focused native test definitions:

- `MissionServiceTest.TahaiNamedWorkspaceCodecPreservesLayoutsAndGroups`
- `MissionServiceTest.TahaiNamedWorkspaceRejectsUnsafeUrlsAndPartitions`
- `MissionServiceTest.TahaiNamedWorkspaceOperationsReadLatestProfileState`
- `MissionServiceTest.TahaiNamedWorkspaceLimitsAndCorruptionPreserveData`
- `MissionServiceTest.TahaiNamedWorkspacePrivateAndManagedPolicyBoundaries`

New browser test definitions:

- `MultiContentsViewBrowserTest.TahaiNamedWorkspaceRestoresIntoIndependentWindow`
- `MultiContentsViewBrowserTest.TahaiNamedWorkspaceDoesNotCrossPrivateProfiles`
- `MultiContentsViewBrowserTest.TahaiNamedWorkspaceNativeManagerSavesFromButton`
- `SessionRestoreTest.PRE_TahaiNamedWorkspaceSurvivesProcessRestart`
- `SessionRestoreTest.TahaiNamedWorkspaceSurvivesProcessRestart`

The strict package gate requires these named results and a binary-bound
`named-workspaces` smoke record. Also verify process restart, all three rail
states and six modes, collapsed/noncollapsed groups, keyboard-only rename/
delete, Narrator, RTL/translated strings, narrow windows, 100–200% DPI,
cross-window edits, policy refresh, and installed-package upgrade. Header
dependency checks and policy/XML parsing do not establish any of those results.

This slice contributes real named-workspace persistence and native management
to upgrades 021/022. It does not complete suspend/resume with form preservation,
workspace thumbnails, external import/export, editable templates, startup
shortcuts, crash-history versions or automatic tenant routing.
