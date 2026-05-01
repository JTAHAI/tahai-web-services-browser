We are continuing TAHAI Web Services Browser from the Pass 45 public release candidate full-source ZIP.

Current completed pass:
Pass 45 — Public release candidate

Remaining implementation pass count: 0

Repo:
C:\dev\browser\app

Public RC local Windows command:
```powershell
Set-Location C:\dev\browser\app
npm ci
npm run release:public:win
```

Hard rules remain:
- Real source changes only.
- No generated artifacts committed.
- No secrets, tokens, cookies, credentials, runtime profiles, node_modules, dist, release outputs, or local app data in source.
- Browser-side only for IT Docs / PSA integration.
- No direct PSA API calls.
- No stored PSA/API/provider secrets.
- No blind runtime DOM hacks.
- Keep normal browser mode clean.
- Ops Mode / Mission Control is the differentiated workbench.

Verification targets:
```powershell
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:public:verify
```

Publish artifacts only after Windows installed-app QA passes and SHA256 checksums are published beside the release artifacts.
