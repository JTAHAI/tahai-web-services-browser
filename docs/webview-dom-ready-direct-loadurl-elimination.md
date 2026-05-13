# PASS236 — WebView DOM-Ready Direct loadURL Elimination

PASS236 is a release-blocker fix for the installed-app boot diagnostic:

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

## Why PASS236 exists

PASS231 through PASS235 attempted queueing/prototype/instance lifecycle hardening. The installed app still hit the same Electron WebView lifecycle error, which means one or more renderer fallback paths continued to call `webview.loadURL(...)` before the WebView was attached and `dom-ready` had fired.

PASS236 takes the stricter route: **renderer fallback navigation must not call `loadURL` directly at all.** It replaces direct renderer `webview.loadURL(...)` calls with a `src` assignment wrapper.

## What changed

- Adds `PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION` marker.
- Adds `pass236SafeLoadURL(...)`, which uses `webview.setAttribute('src', target)` instead of Electron's `loadURL` method.
- Marks created WebViews as DOM-ready pending until their `dom-ready` event fires.
- Records local, non-secret lifecycle diagnostics in `document.body.dataset.pass236*`.
- Adds a verifier that fails if direct renderer `webview.loadURL(...)` calls remain.
- Wires the verifier into `verify:release-blockers`.

## Release rule

If the exact WebView attach/dom-ready diagnostic appears after PASS236, the release is still blocked. Do not ship preview, Store, signed, or GA claims until the installed app boots without this diagnostic.
