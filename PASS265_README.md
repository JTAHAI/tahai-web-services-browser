# PASS265 — Store Handoff Freeze + Operator Approval Packet

Target version: `2.0.14`

Remaining passes after PASS265: **0**.

PASS265 is the final source-side Store closeout pass. It freezes the handoff packet and creates a fail-closed operator approval gate across PASS260-PASS264.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass265-store-handoff-freeze-operator-approval.mjs
npm run verify:pass-265-store-handoff-freeze-operator-approval
```

## Gate when real final evidence exists

```powershell
npm run gate:pass-265-store-handoff-freeze-operator-approval
```

The gate should remain blocked until PASS260-PASS264 gates pass, real evidence hashes exist, final operator approval is recorded, and not-submitted/not-approved truth is preserved.
