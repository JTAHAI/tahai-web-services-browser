# PASS235 — WebView Prototype Lifecycle Hard Close

PASS235 closes the remaining release-blocking WebView lifecycle crash class:

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

## Why another pass was required

PASS231 and PASS232 guarded normal created WebView instances and many command paths, but the installed app still produced the boot diagnostic. That means at least one method call was still racing the instance guard or firing before `dom-ready` from a fallback navigation path.

PASS235 hardens this class at two levels:

1. **Prototype gate:** patch the WebView prototype as early as the renderer can reach it, so direct calls are intercepted even if they happen before the per-instance patch is complete.
2. **src-first loadURL fallback:** `loadURL` is special during boot. When a WebView is not attached/dom-ready, PASS235 uses the declarative `src` attribute instead of calling the Electron method that throws.

## Guarded method surface

The pass covers load/navigation, reload, back/forward, print, DevTools, capture, JavaScript execution, CSS injection, zoom, send, and sync probes such as `canGoBack`, `canGoForward`, `getURL`, and `getTitle`.

## Release rule

If the exact diagnostic appears after PASS235 in an installed app, the release remains blocked. Capture the runtime diagnostics dataset from `document.body.dataset.pass235*` and add the exact call site to the verifier before shipping.
