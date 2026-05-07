# PASS102 — Ops Diagnostics Network Boundary

PASS102 hardens browser-side DevOps / IT diagnostics so main-process network checks do not inherit browser session context or echo sensitive diagnostic output.

## Hardened surfaces

- `runUrlDiagnostics(...)` now uses Node `http` / `https` HEAD requests instead of Electron `net.request`.
- Diagnostics requests are cookie-free by construction and send only explicit safe headers:
  - `User-Agent`
  - `Accept`
  - `Cache-Control`
- Diagnostic targets are normalized through `src/shared/diagnostics-boundary.ts`.
- `file:`, non-HTTP(S), embedded-credential URLs, oversized URLs, control characters, and bidi controls fail closed.
- Diagnostic response headers are allowlisted and redacted before reaching the renderer.
- `Cookie`, `Set-Cookie`, `Authorization`, `Proxy-Authorization`, `WWW-Authenticate`, and `Proxy-Authenticate` are never returned in diagnostic output.
- Redirect `Location` values are passed through evidence URL sanitization before renderer handoff.
- Status messages and errors are redacted and size-capped.

## Files changed

- `src/shared/diagnostics-boundary.ts`
- `src/main/main.ts`
- `src/renderer/index.html`
- `src/renderer/styles/browser.css`
- `scripts/verify-pass-102-ops-diagnostics-network-boundary.mjs`
- `package.json`
- `NEXT_CHAT_STARTER.md`

## Verification

Added:

```powershell
npm run verify:pass-102-ops-diagnostics-network-boundary
```

Wired into:

```powershell
npm run verify:release-blockers
```
