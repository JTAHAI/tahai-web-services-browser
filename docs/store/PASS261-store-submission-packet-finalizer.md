# PASS261 — Store Submission Packet Finalizer

## Goal

Prepare one Partner Center submission packet that consolidates listing copy, screenshot manifest, privacy/support URLs, package identity truth, PASS260 installed-smoke status, checksum/provenance pointers, known issues, signing truth, and go/no-go posture.

## Important truth

PASS261 does **not** claim that the app has been submitted to Microsoft, approved by Microsoft, signed for direct download, or cleared for GA. It creates the packet and fail-closed checks needed before those claims can be made.

## Packet files

- `docs/store/pass261-store-submission-packet.template.json`
- `docs/store/pass261-store-screenshot-manifest.template.json`
- `docs/store/PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md`

## Required go/no-go conditions

- PASS260 installed Recipe + Quad/Tri/Split smoke gate passes from real installed Windows evidence.
- Store listing copy is reviewed and does not overclaim.
- Privacy, support, and website URLs are public and accurate.
- Package identity placeholders are replaced only after Partner Center reserves identity.
- Screenshots come from the installed app and contain no secrets.
- Checksums/provenance pointers are attached.
- Known issues are accurate.
- Store submission remains `not-submitted` and approval remains `not-approved` until Partner Center evidence exists.

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass261-store-submission-packet-finalizer.mjs
npm run verify:pass-261-store-submission-packet-finalizer
```

Optional hard gate after a real packet has been filled:

```powershell
npm run gate:pass-261-store-submission-packet
```

The gate is expected to block until the packet is filled with real installed-app evidence and operator approval.

## Hard boundaries

- Browser-side only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
