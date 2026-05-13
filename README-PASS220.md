# PASS220 — Privacy and Local Data Inventory

Repo-root patch for TAHAI Web Services Browser.

Adds a source-side privacy/local-data inventory contract, helper module, QA notes, docs page, apply script, and fail-closed verifier for settings, cache, missions, evidence, exports, downloads, logs, support bundles, policy diagnostics, crash recovery, IT Docs display references, PSA display references, and webview remote storage.

Apply:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass220-privacy-local-data-inventory.mjs
npm run verify:pass-220-privacy-local-data-inventory
npm run verify:release-blockers
npm run build
```

Boundary: source-side privacy/local data inventory only. No signing, Microsoft Store approval, installed-app smoke proof, public GA claim, IT Docs backend, PSA connector, direct PSA API calls, provider/API secrets, or runtime support-bundle success claim.
