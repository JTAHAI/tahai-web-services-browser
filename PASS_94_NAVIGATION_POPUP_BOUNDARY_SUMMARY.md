# PASS94 — Navigation / Popup Boundary Guard

PASS94 hardens the browser-side navigation and window-open boundary for Mission panes, remote webviews, shell popups, and external-open handoffs.

## Scope

Browser-side only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets or generated runtime artifacts added.

## Hardened surfaces

- Added a shared `navigation-boundary` module for URL normalization and fail-closed URL decisions.
- Blocks `javascript:`, `data:`, `vbscript:`, `ftp:`, `gopher:`, `about:`, and `blob:` navigation targets before browser tabs/panes consume them.
- Blocks overlong navigation targets and strips control characters before URL parsing.
- Blocks HTTP(S) URLs with embedded username/password credentials.
- Allows packaged `file://` TAHAI shell pages only when they match the trusted local shell URL list.
- Renderer address-bar/tab navigation now uses the shared normalization boundary instead of ad hoc URL handling.
- Webview `will-navigate`, `did-navigate`, `did-navigate-in-page`, and `new-window` flows now sanitize or block before updating tab state or creating a tab.
- Remote webview popup handling no longer creates a tab from a raw `/^https?:\/\//` string match.
- BrowserWindow shell popup handling now sends only normalized safe URLs into renderer tabs.
- `shell.openExternal` remains behind the safe wrapper and now reuses the same shared external-navigation sanitizer.

## Verifier

Added:

```bash
npm run verify:pass-94-navigation-popup-boundary
```

Wired into:

```bash
npm run verify:release-blockers
```

The verifier checks the shared boundary module, renderer webview navigation/popup hardening, main-process shell popup normalization, and safe external-open wrapper reuse.
