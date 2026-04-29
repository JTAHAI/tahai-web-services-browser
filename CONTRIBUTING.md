# Contributing

Thank you for helping improve TAHAI Web Services Browser.

## Project direction

TAHAI Web Services Browser is a Chromium-compatible Electron workbench focused on developer workflows, DevOps workflows, IT engineering workflows, browser-based operational launchpads, BYOK/provider-console workflows, and practical source-first enterprise polish.

## Ground rules

- Fix source templates, CSS, package resources, and scripts directly.
- Do not add blind runtime DOM hacks.
- Do not commit generated installers, release zips, `dist/`, `release/`, `node_modules/`, credentials, profiles, caches, or local runtime data.
- Do not commit API keys, certificates, `.pfx`, `.p12`, `.pem`, `.env`, or provider secrets.
- Keep changes reviewable and scoped.

## Local verification

```powershell
npm ci
npm run verify:release-blockers
npm run verify:public-repo
```

## Pull requests

A good PR should include what changed, why it changed, screenshots for UI changes, verification commands run, and known limitations.
