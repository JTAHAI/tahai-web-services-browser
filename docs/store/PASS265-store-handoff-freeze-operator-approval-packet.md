# PASS265 — Store Handoff Freeze + Operator Approval Packet

Target version: `2.0.18`

Remaining passes after PASS265: **0**.

PASS265 is the final source-side Store closeout pass in this lane. It creates the handoff/freeze packet that collects PASS260-PASS264 gate outputs into one operator approval record.

## What this pass adds

- Store handoff/freeze operator approval template.
- Store closeout manifest template.
- Operator approval checklist template.
- Required gate/attestation fixture.
- Source verifier: `npm run verify:pass-265-store-handoff-freeze-operator-approval`.
- Final freeze gate: `npm run gate:pass-265-store-handoff-freeze-operator-approval`.

## Store posture

This pass does **not** submit to the Microsoft Store. It does **not** claim Microsoft Store approval, Store certification, public GA, signed MSI/EXE status, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

PASS265 only freezes the human handoff packet. If the operator later submits in Partner Center, that action must be recorded separately with real Partner Center evidence before any public submitted/approved claim is made.

## Required final evidence path

`release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json`

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass265-store-handoff-freeze-operator-approval.mjs
npm run verify:pass-265-store-handoff-freeze-operator-approval
```

Optional final freeze gate when real evidence exists:

```powershell
npm run gate:pass-265-store-handoff-freeze-operator-approval
```

## Final closeout rule

A passing PASS265 gate means the source-side Store submission handoff packet is frozen and ready for a human/operator decision. It does **not** mean the app was submitted, approved, signed, or generally available.

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without separate real evidence.
