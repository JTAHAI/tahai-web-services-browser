# PASS191 — Address Bar Enterprise Reliability

PASS191 hardens the address bar as an enterprise navigation surface instead of a loose text box.

## Fixed surface

- Address submissions now resolve through an explicit address-bar decision path before any `loadURL` call.
- Plain host shorthand such as `example.com` normalizes to HTTPS.
- Local development shorthand such as `localhost:3000` normalizes to HTTP localhost.
- Plain text routes to the configured search provider.
- Explicit unsafe protocols such as `javascript:`, `data:`, `vbscript:`, `file:` outside trusted packaged pages, and embedded-credential URLs are blocked instead of silently navigating elsewhere.
- Oversized or empty address input safely no-ops with a clear status message.
- Pasted/input control characters are stripped before submission.
- Address routing records the target tab and Mission pane so wrong-pane navigation is diagnosable.
- Address loading/idle state is reflected on the address input for runtime QA.

## Enterprise acceptance

The operator should be able to trust that pressing Enter in the address bar affects exactly the active tab or visible active Mission pane, never a hidden pane or unrelated tab. Unsafe/malformed input should fail closed with an understandable message, while normal browser shorthand and search behavior still feels familiar.
