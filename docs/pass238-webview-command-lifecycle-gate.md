# PASS238 — WebView Command Lifecycle Gate

Purpose: prevent remaining Electron WebView lifecycle crashes after PASS236 by routing non-navigation WebView methods through readiness guards.

Hardened surfaces:

- history probes: `canGoBack`, `canGoForward`
- history commands: `goBack`, `goForward`
- toolbar commands: `reload`, `print`
- local capture/tool commands using `executeJavaScript`
- Mission view zoom normalization calls
- pending lifecycle truth when `src` navigation starts

Boundary:

- Source-side hardening only.
- No direct PSA/IT Docs backend work.
- No generated package artifacts committed.
- Installed-app smoke still required on Windows.

Verifier:

```powershell
npm run verify:pass-238-webview-command-lifecycle-gate
```
