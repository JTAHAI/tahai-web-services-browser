# PASS239 — WebView Boot Lifecycle Closeout

PASS239 closes the remaining installed-app boot diagnostic path where renderer code could still touch WebView lifecycle methods before the WebView was attached and `dom-ready` had fired.

## Hardening

- Replaced the PASS187 navigation truth direct `canGoBack` / `canGoForward` probes with the PASS238 safe lifecycle wrappers.
- Deferred initial WebView `src` assignment until after the element is attached and all lifecycle event handlers are registered.
- Added verifier coverage so the boot path cannot regress to direct pre-attach WebView method/source calls.

## Runtime target

This pass targets the installed runtime diagnostic:

`The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.`
