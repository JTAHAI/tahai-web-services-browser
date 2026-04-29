# Chromium Bookmarks Default Repair

Pass 11 hardens the default bookmark seed behavior for the TAHAI Web Services Browser.

The browser now repairs both missing default folders and missing default bookmarks inside those folders. This keeps the IT Admin, DevOps, TAHAI, and AI Workbench launch surfaces available after local storage imports, manual edits, or accidental deletion.

Rules:

- User-created bookmark folders and custom bookmarks are preserved.
- Unsafe protocols are still blocked by the bookmark URL parser.
- Default folder repair does not store secrets or provider credentials.
- The `verify:chromium-bookmarks` gate checks the repair helpers and the IT Admin seed entries.
