# PASS264 — Store Submission Dry-Run Evidence Gate

Target version: `2.0.14`

Remaining passes after PASS264: **1**.

PASS264 adds the final no-submit dry-run gate across PASS260, PASS261, PASS262, and PASS263. It is evidence-only and keeps Store submission blocked.

## Apply

```powershell
Set-Location C:dev\\browserapp
node scripts\\apply-pass264-store-submission-dry-run-evidence-gate.mjs
npm run verify:pass-264-store-submission-dry-run-evidence
```

## Gate when real dry-run evidence exists

```powershell
npm run gate:pass-264-store-submission-dry-run-evidence
```

The gate should remain blocked until PASS260-PASS263 gates pass, real evidence hashes exist, public URL/listing/asset/package truth is reviewed, and the dry run is completed without Store submission.
