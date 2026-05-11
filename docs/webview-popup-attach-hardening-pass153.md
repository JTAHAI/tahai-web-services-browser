# PASS153 — Enterprise WebView Popup/Attach Hardening

PASS153 removes renderer-owned popup permission from TAHAI Browser webviews and moves attach/popup enforcement into the main process.

## Why this pass exists

Electron `webview` popup permission is a boolean attribute. A renderer-created `allowpopups="false"` attribute is still present and can behave as enabled permission. Enterprise browser grade requires the attribute to be absent and for the privileged main process to police webview attachment.

## Implemented boundaries

- Renderer-created `webview` elements no longer set an `allowpopups` attribute.
- Webview `new-window` events are denied by default and no longer create tabs from remote popup attempts.
- Main process installs a default-deny `setWindowOpenHandler` for created web contents.
- The shell window keeps its trusted app-level routing for explicit safe tab creation.
- Main process handles `will-attach-webview` and sanitizes attach options before any guest is attached.
- Unsafe attach options are stripped or forced safe: popup permission params, preload params, Node integration variants, disabled web security, unsafe partition values, and webpreferences overrides.
- Only trusted TAHAI profile partitions are accepted; untrusted partition values are normalized to the default TAHAI profile partition.
- Only `http:`, `https:`, and known local TAHAI shell file pages can be used as webview attach sources.

## Non-regression boundaries

- Tabs, close buttons, plus buttons, address controls, KB, Guide, More Tools, Mission Control, and titlebar drag regions remain renderer/UI concerns.
- Popups and privileged webview attachment are not renderer policy decisions.
- No generated release artifacts, package outputs, profiles, evidence outputs, or runtime data are introduced.
