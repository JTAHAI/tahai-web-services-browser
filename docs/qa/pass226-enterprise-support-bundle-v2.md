# PASS226 QA — Enterprise Support Bundle v2

## Run

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass226-enterprise-support-bundle-v2.mjs
npm run verify:pass-226-enterprise-support-bundle-v2
npm run verify:release-blockers
npm run build
```

## Scope

PASS226 verifies the Enterprise Support Bundle v2 source contract, required redacted sections, false-claim boundaries, generated artifact exclusions, and release-blocker wiring.

## Required sections checked

- app version
- OS/runtime
- package type
- policy truth
- install truth
- recent non-secret errors
- mission diagnostics
- browser settings
- redaction report
- local data inventory
- build provenance summary
- manual proof boundary

## Redaction expectations

The support bundle is redacted by default. It must block or redact authorization headers, cookies, access tokens, refresh tokens, client secrets, API keys, PSA keys, private keys, cloud credentials, GitHub tokens, raw mission note dumps, browsing history dumps, local storage dumps, user paths, emails, IP addresses, usernames, and machine identifiers.

The redaction report must show counts and classes only. It must not include the raw secret value that triggered the finding.

## manual Windows/Linux proof still required

PASS226 has no installed-app smoke success. manual Windows/Linux proof still required before public claims:

- create support bundle from the installed app UI,
- verify policy truth, install truth, package type, and app version in the generated bundle,
- verify recent non-secret errors are redacted,
- verify mission diagnostics omit raw notes and webview HTML,
- verify generated bundle lands only in an app-owned temp/export path or a user-selected path,
- verify the bundle can be attached to a support request without secrets,
- verify no public GA or signed-release claim is implied by support-bundle output.

## False-claim guardrails

Do not claim installed support-bundle success, installed-app smoke success, public GA readiness, Store readiness, or signed package status from this source-only pass. The support bundle must remain an enterprise supportability contract until runtime UI wiring and installed proof are completed.
