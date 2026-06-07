# PASS263 — Store Listing Copy Truth Pack

Target version: `2.0.14`

Remaining passes after PASS263: **2**.

PASS263 adds fail-closed Partner Center listing copy templates, public URL truth, claim review, reviewer-note mapping, and the final copy gate.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass263-store-listing-copy-truth-pack.mjs
npm run verify:pass-263-store-listing-copy-truth-pack
```

## Gate when final copy exists

```powershell
npm run gate:pass-263-store-listing-copy-truth-pack
```

The gate should remain blocked until real public URLs, final copy, copy-claim review, known-issues truth, screenshot/copy consistency, and operator approval are complete.
