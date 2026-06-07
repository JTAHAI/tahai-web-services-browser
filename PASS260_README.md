# PASS260 — Installed Recipe + Quad Store Smoke Evidence Gate

Version target: **2.0.14**

PASS260 adds a fail-closed Store smoke evidence gate for the installed Windows app. It does **not** claim installed smoke passed from source-only checks.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass260-installed-recipe-quad-store-smoke-evidence.mjs
```

## Verify source gate infrastructure

```powershell
npm run verify:pass-260-installed-recipe-quad-store-smoke-evidence
```

## Run Store smoke gate when installed-app evidence exists

```powershell
npm run gate:pass-260-installed-recipe-quad-store-smoke
```

The gate is expected to block until this real evidence file exists and passes:

```text
release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json
```

Start from:

```text
docs/store/pass260-installed-recipe-quad-smoke-evidence.template.json
```

## Store posture

Microsoft Store submission remains blocked until installed Windows Recipe + Split/Tri/Quad/Focus smoke proves:

- no blank panes
- no bottom-only webview rendering
- no orphaned webviews
- no hidden active pane
- useful placeholders for intentionally empty panes
- focus restore passes
- active pane routing passes
- all eight flagship recipes launch and open export preview

Hard scope remains browser-side only: no IT Docs backend code, no PSA connector code, no direct PSA API calls, and no secrets.
