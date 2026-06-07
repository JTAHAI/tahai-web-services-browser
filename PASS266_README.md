# PASS266 — Final Version Truth + Store Gate Chain Repair

Version target: **2.0.14**

Remaining release-confidence hardening passes after PASS266: **5**

## Apply

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass266-final-version-truth-store-gate-chain-repair.mjs
npm run verify:pass-266-final-version-truth-store-gate-chain-repair
```

## Gate when real evidence exists

```powershell
npm run gate:pass-266-final-version-truth-store-gate-chain
```

PASS266 fixes final version truth drift across PASS260-PASS265. It does not submit to the Microsoft Store and does not claim approval or GA.
