# PASS260 — Installed Recipe + Quad Store Smoke Evidence Gate

## Goal

Prevent Microsoft Store submission claims until the installed Windows app proves that Recipe launch, Split/Tri/Quad/Focus layout switching, pane geometry, and export preview are clean.

## Store posture

**Blocked by default.** PASS260 adds the evidence gate and template. It does not claim that installed smoke passed. The Store path remains blocked until a real installed app produces `release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json` with PASS results.

## Required installed smoke

1. Install the current package candidate.
2. Launch the installed app, not the dev server.
3. Confirm no renderer boot error, WebView DOM-ready error, unhandled rejection, blank pane, bottom-only webview, orphaned webview, or hidden active pane.
4. For each flagship recipe, select recipe, start mission, verify mission fields, verify pane count, switch through all layouts, and open export preview.
5. Run at small restored, restored laptop, and maximized 1080p sizes.
6. Preserve truthful signing and Store status: not submitted, not approved, direct MSI/EXE unsigned-preview unless separately signed with evidence.

## Source verification

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass260-installed-recipe-quad-store-smoke-evidence.mjs
npm run verify:pass-260-installed-recipe-quad-store-smoke-evidence
```

## Store gate verification

This gate is expected to fail until real installed-app evidence exists:

```powershell
Set-Location C:\dev\browser\app
npm run gate:pass-260-installed-recipe-quad-store-smoke
```

## Hard boundaries

- Browser-side only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, or signed-release claim without evidence.
