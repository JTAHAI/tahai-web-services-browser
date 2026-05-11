# PASS143 — Mission redaction closeout

PASS143 closes the mission file/import/export redaction lane for the TAHAI Web Services Browser.

## Scope

Browser-side only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No provider secrets, PSA secrets, cookies, authorization headers, runtime browser profiles, generated mission files, generated evidence files, installers, or release artifacts belong in source.

## Security posture

Mission files are untrusted input. A local mission JSON file can be edited by a user, a malicious local process, or a poisoned download, so the browser must validate and sanitize before save, restore, preview, copy, or export.

PASS143 adds a centralized mission redaction contract and keeps the older PASS50/PASS91 export protections intact while tightening the closeout rules:

- secret-bearing keys are rejected before persistence;
- mission URLs strip username/password and fragments;
- sensitive query values are replaced with `[REDACTED]`;
- mission names, tab titles, notes, runbook text, evidence notes, timeline details, IT Docs display values, and evidence metadata are redacted before persistence/export;
- mission export copy/save writes redacted Markdown only;
- IT Docs and PSA fields remain references only, never credentials.

## Redaction classes

The PASS143 redaction engine covers, at minimum:

- Authorization header
- Cookie header
- Bearer token
- GitHub token
- OpenAI-style API key
- Slack token
- Google API key
- AWS access key
- AWS secret access key assignment
- Secret assignment
- Sensitive URL query value
- JWT-looking string
- Private key block
- Email address
- IPv4 address
- IPv6 address
- Twelve-digit cloud account ID
- UUID identifier

## Import/storage rules

The mission validator rejects forbidden secret-bearing object keys such as token, cookie, authorization, client_secret, api_key, password, privateKey, session, and related variants. Text values that can be user-entered are normalized and redacted before they enter persisted mission state.

Blocked mission URL protocols remain rejected: `javascript:`, `data:`, `vbscript:`, `file:`, and `ftp:`. HTTP/HTTPS mission URLs are accepted only after credential stripping, fragment removal, and sensitive query redaction.

## Export rules

Mission preview/copy/save continues to use the sanitized-handoff export profile by default. Raw packet Markdown may be built internally for comparison and preview accounting, but copy/save writes only `redactedMarkdown`.

The review checklist in exported packets reminds the operator to confirm redaction before IT Docs sync or PSA writeback. PSA writeback remains a browser-side contract only and must route through IT Docs server-side connectors when available.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-143-mission-redaction-closeout
```

Recommended local gate:

```powershell
npm ci
npm run build
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:pass-142-electron-security-final-audit
npm run verify:pass-143-mission-redaction-closeout
npm run verify:release-blockers
```
