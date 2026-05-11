# PASS155 — Admin Console Profiles v1

PASS155 turns the browser's DevOps and IT admin positioning into a first-class Admin Console Profiles catalog. These profiles are launchable Mission workspaces, not secret stores and not raw bookmarks.

## Scope

Admin Console Profiles v1 adds a source-truth catalog for:

- Microsoft 365 / Entra / Azure
- AWS
- Google Workspace / GCP
- Cloudflare
- GitHub Actions
- Vercel / Firebase / Cloudflare Pages
- Firewall / VPN vendor portals
- Registrar / DNS cutovers
- IT Docs / runbooks / evidence
- PSA / ticket reference lane

Each profile defines a safe browser profile kind, launch URLs, Mission layout, Mission tab roles, runbook steps, evidence prompts, policy tags, and stop conditions.

## Enterprise guardrails

- No direct PSA API calls.
- No PSA, provider, cloud, OAuth, or vendor secrets.
- No credential vault behavior.
- No automatic console automation.
- No generated release artifacts.
- PSA remains reference-only until IT Docs authorizes server-side connector capability.
- Profiles launch as Mission recipes through existing safe URL handling and pane routing.

## Operator value

Admin profiles make TAHAI a command browser for real production work: identity changes, cloud operations, DNS cutovers, release validation, vendor support, runbook updates, and sanitized evidence handoff.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-155-admin-console-profiles
npm run build
npm run verify:release-blockers
```
