We are continuing TAHAI Web Services Browser full UX/security/package hardening after PASS240.

Repo:
C:\dev\browser\app

Public repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current version:
1.8.30 unless explicitly incremented.

Latest patch ZIP:
TAHAI-browser-pass240-peripheral-webview-lifecycle-closeout-patch-20260512.zip

Latest completed pass:
PASS240 — Peripheral WebView Lifecycle Closeout

PASS240 changed:
- Gated peripheral renderer WebView API callers that can still throw before attach/dom-ready.
- Guarded bookmark getURL/getTitle reads.
- Guarded Site View Mission Rail getURL/getTitle/reload/capturePage calls.
- Guarded DevTools open/close/state calls through the existing PASS238 lifecycle gate.
- Added PASS240 verifier and release-blocker hook.

Run first after overlay:
Set-Location C:\dev\browser\app
node scripts\apply-pass240-peripheral-webview-lifecycle-closeout.mjs
npm run verify:pass-240-peripheral-webview-lifecycle-closeout
npm run verify:release-blockers
npm run build
npm start

Remaining planned passes: 0
Remaining check: installed smoke for the DOM-ready runtime diagnostic.
