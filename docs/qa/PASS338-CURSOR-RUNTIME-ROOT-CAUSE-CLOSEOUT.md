# PASS338 - Cursor Runtime Root-Cause Remediation Closeout

PASS338 converts the Cursor PASS337 findings into direct source remediation. This is not another audit-only pass and does not add another broad runtime sentry.

## Source changes

- `src/renderer/app.ts`
  - Gates `PASS271_R4` normal-webview hard repair behind `TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR=1`.
  - Adds fail-closed stale-marker cleanup when the R4 repair is disabled.
  - Prevents the R4 inline repair path from writing white background, high z-index, pointer ownership, or full-stage geometry unless the env flag is explicitly enabled.
  - Gates the legacy `PASS271_R9` white-screen dataset behind `TAHAI_BROWSER_ENABLE_PASS271_R9_WHITE_SCREEN_CLOSEOUT_DATASET=1`.
  - Removes the end-of-`createTab()` duplicate `pass236SafeLoadURL(webview, safeUrl)` load kick so the pre-attach src path is the single default source owner.

- `src/renderer/styles/browser.css`
  - Replaces the loaded R4/R8/R9 emergency CSS blocks with a single PASS338 chrome-safe webview-stage contract.
  - Keeps active webviews contained inside `#webview-stage`.
  - Keeps `.topbar`, `.tabs`, `#tabs`, `.toolbar`, and address controls above the webview stage.
  - Removes loaded PASS271 white-background and high-z-index webview rules from the default path.
  - Preserves the browser primary accent: `rgba(96, 255, 218, 0.92)`.

- `src/main/main.ts`
  - Keeps GPU/compositor teardown opt-in only.
  - Renames the attach/load diagnostic prefix from legacy `PASS271_R9` wording to `PASS338` so logs do not imply GPU teardown is active.

- `scripts/verify-pass-338-cursor-runtime-root-cause-closeout.mjs`
  - Fails closed if the R4 env gate, R4 fail-closed marker, R9 dataset gate, loaded CSS contract, topbar z-index contract, security guardrails, or package script drift.
  - Writes `release-candidate/generated/pass338-cursor-runtime-root-cause-closeout-report.json`.

## Commands

```powershell
Set-Location D:\dev\browser\app
npm run build
npm run verify:pass-337-cursor-root-cause-closeout
npm run verify:pass-338-cursor-runtime-root-cause-closeout
npm run dev
```

Optional compatibility wrapper after expanding the patch ZIP:

```powershell
.\scripts\apply-pass338-cursor-runtime-root-cause-closeout.ps1
```

## Runtime expectations

- No `PASS271_R4` repair loop by default.
- No `PASS271_R9` global GPU/compositor teardown by default.
- No legacy R4/R8/R9 loaded CSS forcing white active webviews or high webview z-index.
- Active page remains visible after first paint.
- Chrome buttons remain hit-testable.
- Active webview remains contained inside `#webview-stage`.

No Store, GA, signed-release, IT Docs backend, PSA connector, direct PSA API, or secret-handling claim is made by this pass.
