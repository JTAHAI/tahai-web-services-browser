# PASS 21 — Bookmark Folder View Repair

## Purpose

Repair the Chromium-style bookmarks UX where clicking a folder from the main bookmarks surfaces did not present a readable folder view.

## Changes

- Folder clicks now open an in-app folder view.
- Folder view lists direct child bookmarks and subfolders.
- Added explicit **Open folder as tabs** action.
- Added folder-scoped **Add current here** and **New subfolder** actions.
- `Esc` now closes the bookmark folder view.
- Added Pass 21 verifier and wired it into `verify:release-blockers`.

## Guardrails

- No generated artifacts committed.
- No secrets added.
- Bookmark URL protocol validation remains enforced.
- Normal browsing simplicity preserved.
