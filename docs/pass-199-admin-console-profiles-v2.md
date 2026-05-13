# PASS199 — Admin Console Profiles v2

PASS199 upgrades Admin Console Profiles from launchable profile cards into first-class enterprise profile launchers. The profile catalog now carries provider intent, policy tags, mission layout defaults, pane defaults, safe local-only guardrails, and operator-ready profile diagnostics that can be surfaced in Ops Panel, Mission Control, and Command Center.

## What changed

- Added `src/shared/admin-console-profiles-v2-contract.ts` as the v2 profile source of truth.
- Preserved the PASS155 v1 catalog and maps v2 launch recipes from the existing canonical profile IDs.
- Added provider intent for the canonical profile set:
  - Microsoft 365 / Entra / Azure
  - AWS
  - Google Workspace / GCP
  - Cloudflare
  - GitHub / GitHub Actions
  - Vercel / Firebase / Cloudflare Pages
  - firewall / VPN / vendor portals
  - registrar / DNS
  - IT Docs / runbooks / evidence
  - PSA / ticket reference lane
- Added mission layout defaults and pane defaults for each profile launcher.
- Added local-only guardrails for every profile: browser-side only, HTTPS-only, no credential storage, no token fields, no cookie capture, no direct PSA API calls, no direct provider API calls, and explicit operator launch only.
- Added profile diagnostics with safe URL count, policy tag count, default layout, provider intent kind, guardrail count, and connector-required status.
- Wired v2 truth into Ops Panel, Mission Control recipe cards, and Command Center profile entries.
- Added PASS199 verifier and release-blocker chain entry.

## Browser-side boundary

Admin Console Profiles v2 remain local browser launchers. They do not add IT Docs backend code, PSA connector code, cloud-provider API calls, secret storage, token capture, cookie capture, or provider automation. PSA remains reference-only unless a future IT Docs-authorized server-side connector grants a capability.

## Operator diagnostics

Each profile now produces a stable diagnostic surface:

- `diagnosticId`
- launch surface kind
- safe HTTPS launch URL count
- policy tag count
- mission layout default
- provider intent kind
- local-only guardrail count
- disabled/connector-required reason

The renderer exposes these through `data-pass199-*` attributes on launch cards and through document-level dataset fields for automated source verification.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-199-admin-console-profiles-v2
npm run verify:pass-198-mission-recipe-library-v2
```

Version remains `1.8.30`.

## Security notes

- No direct PSA API calls.
- No provider secrets.
- No OAuth refresh tokens.
- No cloud credentials.
- No browser-side credential vault.
- No generated artifacts were added.
