# PASS261 — Store Submission Packet Finalizer

Version target: 2.0.14

PASS261 adds the final Store submission packet templates and go/no-go gate. It does not claim Microsoft Store submission or approval.

## Run

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass261-store-submission-packet-finalizer.mjs
npm run verify:pass-261-store-submission-packet-finalizer
```

Expected until real evidence exists:

```powershell
npm run gate:pass-261-store-submission-packet
```

The gate should block until the packet is filled with PASS260 installed smoke proof, screenshots, URLs, checksums, and operator approval.
