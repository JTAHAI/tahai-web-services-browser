# Chromium Bookmarks hardening pass 1.8.8A

This pass keeps the Chromium-style Bookmarks feature Windows-first and browser-repo scoped.

## Source changes

- Hardened bookmark URL handling with a single `parseSafeBookmarkUrl` path.
- Blocked unsafe bookmark protocols: `javascript:`, `data:`, `vbscript:`, `file:`, `about:`, `chrome:`, `devtools:`, `view-source:`, and `tahai-browser:`.
- Stripped username/password material from URLs before local bookmark persistence.
- Added import size and node-count limits.
- Kept Ctrl+D, Ctrl+Shift+B, and Ctrl+Shift+O owned by bookmarks.
- Added outside-click close behavior for the bookmarks menu.
- Added CSS protection so the bookmarks controls remain visible without crushing the address bar.

## Guardrails

No IT Docs backend code, no PSA connector code, no PSA/API/provider secrets, no raw IPC, and no generated artifacts are added by this pass.