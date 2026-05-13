# PASS220 — Privacy and Local Data Inventory QA

PASS220 is a source-side privacy/local-data inventory pass. It adds a release-blocking inventory for every local storage, cache, mission, evidence, export, log, support-bundle, policy, crash-recovery, IT Docs display-cache, PSA display-cache, and webview remote-storage surface.

Run:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass220-privacy-local-data-inventory.mjs
npm run verify:pass-220-privacy-local-data-inventory
npm run verify:release-blockers
npm run build
```

Acceptance:

- Every inventory surface has storage class, retention mode, sensitivity, redaction posture, user visibility, exportability, support-bundle allowance, clearability, and release-blocker status.
- Mission JSON, evidence files, mission exports, runtime logs, support bundle, crash recovery, IT Docs display cache, PSA reference cache, and webview remote storage are explicitly inventoried.
- Support bundle fields are allowlisted and display-safe only.
- Prohibited fields include access_token, refresh_token, Authorization, Cookie, private keys, cloud secrets, PSA API keys, raw session cookies, and raw auth headers.
- Mission/evidence/export surfaces require scan, default redaction, or blocking for private keys/tokens.
- Renderer paths must not receive or expose full local filesystem paths.

No installed-app smoke, signing, Store approval, public GA, IT Docs backend, PSA connector, direct PSA API call, provider secret, or runtime support-bundle success claim is made by this pass.
