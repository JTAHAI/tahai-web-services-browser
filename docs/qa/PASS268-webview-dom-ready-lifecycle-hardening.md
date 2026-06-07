# PASS268 — WebView DOM-Ready Lifecycle Hardening

PASS268 hardens the WebView lifecycle class that previously caused:

> The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.

## Required runtime behavior

Every Mission Control pane webview must be treated as unavailable until all conditions are true:

1. The element is connected to the DOM.
2. The element has emitted `dom-ready`.
3. The element has not been destroyed, crashed, detached, or removed.
4. The requested method exists on the live webview element.

Unsafe method calls must fail as safe no-ops with a diagnostic marker, never as unhandled renderer errors.

## Required installed evidence

The real evidence file must prove:

- recipe launch does not trigger pre-dom-ready webview calls;
- Split/Tri/Quad/Focus layout switching does not trigger the WebView DOM-ready error;
- resize/maximize/restored changes do not trigger the error;
- reload/back/forward/focus/openDevTools paths are guarded;
- no unhandled renderer errors or promise rejections occur during the test window.

Store posture remains blocked: not submitted, not approved, no GA claim.
