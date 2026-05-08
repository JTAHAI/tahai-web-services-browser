# PASS131 — KB Search and Navigation Polish

PASS131 turns the local Guide / Knowledge Base into a faster user-support surface before screenshot assets are added.

## Scope

- Adds a local-only KB search panel to `browser/onboarding/index.html`.
- Adds the self-hosted `browser/onboarding/kb-search.js` search controller.
- Adds `docs/kb/search-index.json` so the source repo has a machine-readable KB search contract.
- Adds article keywords to `browser/onboarding/kb-manifest.json`.
- Keeps the KB screenshot slots awaiting reviewed user screenshots.
- Updates older KB verifiers so they permit only the self-hosted deferred KB script and continue to reject remote/inline script drift.

## Security / privacy posture

The search surface is local only. It does not use network requests, remote scripts, telemetry, localStorage, cookies, or external KB services.

## Validation

Run:

```powershell
npm run verify:pass-129-kb-repo-foundation
npm run verify:pass-130-kb-screenshot-intake
npm run verify:pass-131-kb-search-navigation-polish
```
