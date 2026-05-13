# PASS232 — WebView Runtime Command Sweep + Release Closeout

PASS232 is a release-blocker hotfix pass after PASS231. It treats the WebView attach/dom-ready boot diagnostic as a hard release blocker and installs a runtime command gate on every existing and future `<webview>`.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass232-webview-runtime-command-sweep-release-closeout.mjs
npm run verify:pass-232-webview-runtime-command-sweep-release-closeout
npm run verify:release-blockers
npm run build
npm start
```

## Scope

- Source-side runtime hardening only.
- No version increment.
- No generated installers, MSIX packages, signing certificates, runtime profiles, or release artifacts committed.
- Does not claim Microsoft Store submission, trusted signing, or GA approval.

## Manual release note

If `Renderer error: Uncaught Error: The WebView must be attached to the DOM...` still appears after PASS232, release remains blocked and the next pass must target the remaining WebView call path.
