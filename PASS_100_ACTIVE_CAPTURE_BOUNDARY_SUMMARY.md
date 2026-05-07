# PASS100 — Active Capture Boundary

PASS100 hardens the browser-side evidence/diagnostics capture surface that consumes output from remote webviews.

## What changed

- Added `src/shared/active-capture-boundary.ts` as the shared sanitizer for active-page capture output.
- Redacts secret-like text before preview, pinning, copy, or save.
- Normalizes and sanitizes active-page URLs before diagnostics and handoff metadata.
- Removes embedded credentials, hashes, and sensitive query values from captured URLs.
- Sanitizes origins, paths, route candidates, links, form actions, resource names, page titles, headings, metadata, CSP meta, user agent text, and permission labels.
- Caps hostile or oversized webview-returned numbers, lists, strings, and resource arrays.
- Keeps PASS93 main-process export redaction in place as a second boundary.
- Keeps PASS97 local filesystem path hiding in place.

## Security result

Remote page content and `webview.executeJavaScript(...)` return values are treated as untrusted. They are no longer allowed to flow raw into capture preview/status/source metadata or downstream Markdown handoffs.
