# PASS268 — WebView DOM-Ready Lifecycle Hardening

Purpose: prevent flagship Mission Control release failures caused by calling Electron `webview` methods before the element is attached and `dom-ready` has fired.

Scope:
- Browser-side only.
- No Store submission or approval claim.
- No IT Docs backend code.
- No PSA connector/API code.

Adds:
- Renderer lifecycle guard for WebView attachment, dom-ready, destroy/crash, and safe method execution.
- Runtime matrix and real installed-app evidence template.
- Fail-closed gate requiring proof that the prior DOM-ready error class is gone.

Next pass: PASS269 — Active Pane Routing + Input/Focus Regression Closeout.
