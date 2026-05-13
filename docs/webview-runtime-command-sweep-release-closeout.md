# WebView Runtime Command Sweep + Release Closeout

PASS232 closes the runtime class that produced this boot diagnostic:

```text
Renderer error: Uncaught Error: The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```

PASS231 guarded the primary navigation/history/reload/print/DevTools paths. PASS232 goes wider: every existing and future `<webview>` gets a runtime command gate that patches risky WebView commands behind attachment and `dom-ready`.

## Guarded command class

The runtime gate patches these WebView command/probe paths:

- `loadURL`
- `reload`
- `reloadIgnoringCache`
- `stop`
- `goBack`
- `goForward`
- `print`
- `openDevTools`
- `closeDevTools`
- `executeJavaScript`
- `capturePage`
- `send`
- `insertCSS`
- `setZoomFactor`
- `setZoomLevel`
- `canGoBack`
- `canGoForward`
- `isDevToolsOpened`
- `isLoading`
- `getURL`
- `getTitle`

Async/void commands queue until the WebView is attached and `dom-ready` has fired. Sync probes fail closed with safe fallback values until ready.

## Release rule

This error is a release blocker. If it appears again during local installed-app smoke, do not publish the release, do not submit to Store, and do not claim GA. Capture the diagnostic, identify the command path, and extend the runtime gate or source call-site guard before release.

## Diagnostics

PASS232 exposes non-secret renderer diagnostics on `document.body.dataset`:

- `pass232RuntimeObserver`
- `pass232LastPatchedWebview`
- `pass232LastQueuedRuntimeCommand`
- `pass232QueuedRuntimeCommandCount`
- `pass232LastRuntimeGateFlush`
- `pass232LastRuntimeGateError`
- `pass232LastRuntimeGateTimeout`

Do not place URLs, tokens, cookies, auth headers, customer data, or page content in these diagnostics.
