# Chromium Bookmarks Menu + Bookmarks Bar

This pass adds a Chromium-style bookmark system without removing existing TAHAI functionality.

## Added

- `Bookmarks` toolbar button.
- Star button for adding the active site.
- Bookmarks bar under the toolbar.
- Folder dropdowns on the bookmarks bar.
- Bookmark manager dialog.
- Import / export JSON.
- Legacy local bookmark migration.
- Searchable bookmarks menu.
- Keyboard shortcuts:
  - `Ctrl+D` add current page.
  - `Ctrl+Shift+B` show/hide bookmarks bar.
  - `Ctrl+Shift+O` open bookmark manager.

## Non-removal rule

This feature is additive. It does not remove Mission Control, Site View Mission Rail, Ops Panel, DevOps tools, IT tools, Credentials, or existing browser controls.

## Storage

Bookmarks are stored locally under:

```text
tahai-browser:chromium-bookmarks:v1
```

The renderer attempts read-only migration from common older local bookmark keys, then writes to the new store.

## Validation

```powershell
npm run verify:chromium-bookmarks
npm run verify:release-blockers
```
