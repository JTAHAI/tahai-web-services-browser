# PASS177 — Website Pane Viewport Recovery

Version remains `1.8.30`.

## Fixed

The browser chrome was allowed to grow as a layout participant during compact/non-maximized windows, which could starve the website/webview stage and leave only a horizontal sliver of page content visible at the bottom.

## Source changes

- `src/renderer/index.html`
- `src/renderer/responsive-toolbar.ts`
- `src/renderer/styles/responsive-toolbar.css`
- `docs/pass-177-website-pane-viewport-recovery.md`
- `scripts/verify-pass-177-website-pane-viewport-recovery.mjs`
- `package.json`

## Verification

Run:

```powershell
npm run verify:pass-177-website-pane-viewport-recovery
npm run build
```

The pass does not claim Windows installed-app visual proof from this environment; it adds source-level viewport recovery and runtime diagnostics for local visual confirmation.
