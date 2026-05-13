# PASS237 — Full Repo Review Closeout

This pass is the follow-up to the uploaded full local repo review.

It closes:

- PASS236 not actually applied in the uploaded full repo.
- Direct renderer `webview.loadURL(...)` crash path still present.
- Missing `build/icon.ico` and `build/icon.png` source packaging inputs from the repo pull.
- PASS236 `NEXT_CHAT_STARTER.md` overwrite breaking legacy release-blocker continuity verifiers.
- PASS204 Operator Command Center v2 source present but not installed from `src/renderer/app.ts`.

Run after overlay:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass237-full-repo-review-closeout.mjs
npm run verify:pass-236-dom-ready-direct-loadurl-elimination
npm run verify:pass-204-operator-command-center-v2
npm run verify:pass-237-full-repo-review-closeout
npm run verify:release-blockers
npm run build
npm start
```

Installed-app hard blocker remains the exact Electron lifecycle diagnostic:

```text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
```
