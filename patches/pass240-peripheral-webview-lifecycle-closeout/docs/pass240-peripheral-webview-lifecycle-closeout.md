# PASS240 — Peripheral WebView Lifecycle Closeout

PASS240 hardens the remaining renderer-side WebView API callers outside the primary navigation wrapper.

## Scope

- Guarded bookmark title/URL reads so `getURL()` and `getTitle()` only run after the WebView is attached and `dom-ready` has fired.
- Guarded Site View Mission Rail `getURL()`, `getTitle()`, `reload()`, and `capturePage()` paths.
- Guarded DevTools open/close state checks through the existing PASS238 lifecycle gate.
- Added a PASS240 verifier and release-blocker hook.

## Runtime intent

The boot shell must not throw Electron's lifecycle error when a peripheral surface touches a WebView too early:

`The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.`

Until a WebView is ready, peripheral features fall back to DOM attributes, toolbar commands, or safe no-ops.
