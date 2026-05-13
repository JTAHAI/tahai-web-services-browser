# PASS203 — Evidence Redaction UX v2

PASS203 makes evidence redaction understandable instead of mysterious. Evidence Pack exports now include a redaction review that explains what was detected, why it was handled, the default action, and how the selected export profile changes treatment.

## Implemented

- Added `src/shared/mission-evidence-redaction-ux-v2-contract.ts` as the named PASS203 source contract.
- Added profile-aware redaction review output for internal, sanitized handoff, incident packet, change record, IT Docs sync, and PSA ticket note profiles.
- Marked private-key and credential/token classes as blocked from unredacted export while still allowing a safe redacted packet.
- Added plain-language explanations for authorization headers, cookies, bearer/provider tokens, API keys, JWT-looking strings, email/IP/account identifiers, UUID identifiers, and private key blocks.
- Added Mission Control `Redaction UX v2` preview with safe status, profile mode, blocked class count, and no raw secret echo.
- Added per-evidence item metadata showing redaction finding count, blocked class count, and default redaction action.
- Extended Evidence Pack Markdown with a PASS203 redaction review table.

## Guardrails

- Browser-side and local-first only.
- No IT Docs backend implementation.
- No PSA connector implementation.
- No raw credential echo in UI, metadata, logs, or docs.
- Safe redacted export remains allowed even when unredacted export is blocked.
- No MSIX, Store, GA, or signing readiness claim.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-203-evidence-redaction-ux-v2
npm run verify:pass-202-evidence-pack-v2
npm run typecheck
npm run build
```

Version remains `1.8.30`.
