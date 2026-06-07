# PASS250 — Microsoft Store Submission Evidence + Partner Center Identity Prep

This repo-shaped overlay adds the PASS250 Store submission evidence lane for TAHAI Web Services Browser 2.0.0.

## Apply

```powershell
Set-Location C:\dev\browser\app
Expand-Archive -Force .\TAHAI-browser-pass250-microsoft-store-submission-evidence-identity-prep-patch-20260513.zip .
node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
npm run verify:pass-250-store-submission-evidence-identity-prep
```

## Capture local package evidence

```powershell
npm run store:evidence:capture
```

## Store submission gate

```powershell
npm run verify:store:submission
```

That gate is expected to fail until real Partner Center identity, public privacy/support URLs, screenshots/listing packet, package artifact evidence, installed smoke, and known-issues truth are complete.
