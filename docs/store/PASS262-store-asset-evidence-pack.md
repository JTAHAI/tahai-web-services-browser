# PASS262 — Store Asset Evidence Pack

## Goal

Create the installed-app screenshot/evidence asset pack structure for Partner Center review: required screenshot slots, Store listing image checklist, public URL review, source/version/hash metadata, no-secret review, and an artifact manifest.

## Important truth

PASS262 is an evidence-pack structure pass only. It does **not** submit the app to Microsoft, claim Microsoft Store approval, claim direct MSI/EXE signing, or declare public GA.

The Store posture remains **not-submitted** and **not-approved** until real Partner Center evidence exists.

## Files added

- `docs/store/pass262-store-asset-evidence-pack.template.json`
- `docs/store/pass262-store-listing-image-checklist.template.json`
- `docs/store/pass262-public-url-review.template.json`
- `tests/runtime/pass262-store-asset-required-slots.json`
- `scripts/gate-pass262-store-asset-evidence-pack.mjs`
- `scripts/verify-pass262-store-asset-evidence-pack.mjs`

## Required screenshot slots

- Normal browser mode
- Mission Control overview
- Quad View recipe started
- Tri-view layout routing
- Split View active-pane routing
- Runbook Rail and Evidence
- Operator Command Center
- Settings/About unsigned-preview truth

## Required review truth

Every final asset row must record:

- asset ID and slot
- source path
- installed-app capture source where applicable
- package version
- source commit
- package SHA256
- asset SHA256
- pixel dimensions
- no-secret review
- no false Store/signing/GA claim review

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass262-store-asset-evidence-pack.mjs
npm run verify:pass-262-store-asset-evidence-pack
```

Optional hard gate after real assets exist:

```powershell
npm run gate:pass-262-store-asset-evidence-pack
```

That gate is expected to block until `release-candidate/store-submission/pass262-store-asset-evidence-pack.json` is filled with real installed-app asset evidence.

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
