# PASS157 — Evidence Capture Privacy Hardening

PASS157 hardens TAHAI Web Services Browser evidence capture and export privacy without adding backend services, accounts, PSA connectors, or generated release artifacts.

## Purpose

Evidence capture is a differentiator for an enterprise DevOps and IT Admin browser, but evidence can leak too much. PASS157 makes capture/export safer by default for admin-console, cloud-console, identity-admin, DNS, support, and ticket-reference workflows.

## What PASS157 adds

- A source-level evidence-capture privacy contract: `src/shared/evidence-capture-privacy-contract.ts`.
- Sensitive admin-console domain detection for Microsoft 365, Entra, Azure, AWS, Google Workspace/GCP, Cloudflare, GitHub, Vercel, Firebase, firewall/vendor support portals, and TAHAI IT Docs.
- Sensitive path minimization for shareable exports so UUIDs, long IDs, account-style numbers, hex IDs, and email-looking path segments are replaced with `[redacted-id]`.
- metadata minimization before mission evidence entries are persisted or exported.
- Redaction preview language in the Mission Evidence Pack.
- Automatic IT Docs/PSA sync blocking semantics for high-risk findings in browser-side contracts.
- Explicit no-direct-PSA/no-secrets posture preserved.

## Capture privacy rules

PASS157 keeps evidence capture local-first and explicit:

1. Capture/export uses explicit Mission state only.
2. Cookies, Authorization headers, tokens, passwords, private keys, API keys, OAuth values, and session material are stripped or redacted.
3. Shareable profiles redact identifiers by default.
4. Sensitive admin-console paths are minimized before export.
5. High-risk secret-like findings block automatic IT Docs sync or PSA ticket-note generation until reviewed.
6. PSA writeback remains browser-side contract only and must route through IT Docs server-side connectors later.

## Files changed

- `src/shared/evidence-capture-privacy-contract.ts`
- `src/shared/evidence-safety.ts`
- `src/shared/evidence-pack.ts`
- `src/shared/mission-validators.ts`
- `src/renderer/app.ts`
- `scripts/verify-pass-157-evidence-capture-privacy-hardening.mjs`
- `package.json`
- `PASS_157_EVIDENCE_CAPTURE_PRIVACY_HARDENING_SUMMARY.md`

## Verification

```powershell
Set-Location C:\dev\browser\app
npm run build
npm run verify:pass-157-evidence-capture-privacy-hardening
npm run verify:release-blockers
```

## Guardrails preserved

- Browser-side repo only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No provider tokens, OAuth refresh tokens, cookies, browser storage, runtime profiles, installers, `dist`, `release`, or generated evidence artifacts in source.
- No generated release artifacts are included.
- Version remains `1.8.30`.
