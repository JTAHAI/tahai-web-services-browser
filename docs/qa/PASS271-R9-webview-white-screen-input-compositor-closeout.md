# PASS271-R9 — Webview White-Screen Input/Compositor Closeout

## Runtime blocker

After R8, the R7 script failure was fixed and the webview src was seeded before attach, but the Windows dev runtime still displayed a white, non-interactive website surface.

## Fix

- Disable Electron/GPU compositing by default for the release-confidence lane unless TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR=0 is set.
- Strip Electron from the webview user agent so ordinary sites see a Chromium-compatible browser identity.
- Force the sanitized src once before attach and again after did-attach / settle if dom-ready has not fired.
- Preserve main-process attach hardening, URL validation, popup-as-tab boundaries, and no direct PSA/API behavior.

## Scope

Browser-side only. No IT Docs backend. No PSA connector. No direct provider/API secrets. No Store, GA, or signing claim.
