# PASS337 - Cursor Root-Cause Closeout

Scope: browser-side source only.

Cursor findings applied:
- PASS271_R9 GPU/compositor disable made opt-in only.
- PASS271_R4 normal-webview repair MutationObserver/interval made opt-in only.
- PASS271_R9 blank-surface retry loop made opt-in only.
- Emergency recovery imports PASS329-PASS336 are quarantined when active, except PASS333 diagnostic.
- Runtime-loaded stylesheet `src/renderer/styles/browser.css` now owns the chrome-safe webview stage contract.

Verification:
```powershell
npm run verify:pass-337-cursor-root-cause-closeout
npm run build
npm run dev
```

Manual runtime check:
- tahaiportal.com should remain painted after first load.
- toolbar/chrome buttons should remain clickable.
- console should not require PASS271_R9 GPU disable to paint.
- PASS333 diagnostic may remain active for hit-test sampling only.
