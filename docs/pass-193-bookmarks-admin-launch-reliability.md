# PASS193 — Bookmarks and Admin Launch Reliability

PASS193 hardens the bookmark/admin launch surface so operator launch actions are predictable in normal browsing and Mission Control.

## Closed weak surface

Before this pass, bookmark-folder Mission events were routed through a string event name and trusted too much of the renderer detail payload. Admin Console Profile and launch-recipe buttons also depended on direct ID lookup at the moment of launch, which made missing IDs look like a silent no-op.

PASS193 adds a source-truth contract and verifier for:

- bookmark bar URL launches through the address/router path;
- bookmark-folder Mission launches through a named event contract;
- revalidation of bookmark Mission event detail before tabs, panes, evidence, or notes are created;
- launch-recipe/admin-profile ID resolution before profile switching or tab closeout;
- visible diagnostics on launch surface, target kind, target ID, and result;
- no wrong-pane replacement from bookmarks or admin launchers.

## Runtime behavior

Bookmark and admin launch controls now mark their launch source/kind using `data-pass193-*` diagnostics. These markers are intentionally lightweight and support manual QA, support bundles, and future runtime automation without changing user-facing behavior.

Bookmark-folder Mission details are treated as untrusted. The app revalidates URLs, deduplicates entries, caps payload size, normalizes titles, and redacts the manifest before creating Mission tabs, pane assignments, evidence, and timeline notes.

Admin Console Profile and Mission Recipe launches now resolve through `pass193FindLaunchRecipe()` before any profile switch or tab close happens. Missing, disabled, duplicate, or coming-soon launch IDs fail visibly and safely without closing existing operator work.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-193-bookmarks-admin-launch-reliability
npm run verify:release-blockers
```

PASS193 is wired into `verify:release-blockers` after PASS192.

## Manual Windows QA

- Open bookmarks from the bar, menu, folder view, and manager.
- Start a Mission from an IT Admin bookmark folder.
- Start a Mission from a single bookmark.
- Open Admin Console Profiles from Ops Panel and Command Palette.
- Confirm missing/deprecated recipe IDs do not close tabs or replace a Mission pane.
- Confirm launch diagnostics update on `<body>` under `data-pass193-*`.
