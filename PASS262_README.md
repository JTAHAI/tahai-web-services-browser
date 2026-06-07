# PASS262 — Store Asset Evidence Pack

Target version: `2.0.14`

PASS262 adds a fail-closed Store asset evidence pack for Partner Center preparation.

It creates templates for installed-app screenshots, listing images/icons, public URL review, SHA256/source/version metadata, and no-secret review. It does not claim Store submission, Store approval, direct MSI/EXE signing, or GA readiness.

## Apply

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass262-store-asset-evidence-pack.mjs
npm run verify:pass-262-store-asset-evidence-pack
```

## Gate when real evidence exists

```powershell
npm run gate:pass-262-store-asset-evidence-pack
```

The gate should remain blocked until real installed-app screenshots/assets, URLs, hashes, and operator approval are attached.
