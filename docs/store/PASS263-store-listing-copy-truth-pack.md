# PASS263 — Store Listing Copy Truth Pack

Target version: `2.0.14`

Remaining passes after PASS263: **2**.

PASS263 adds a fail-closed Partner Center listing copy pack. It keeps Store copy, public URL truth, reviewer notes, feature claims, known-issues truth, and screenshot/copy consistency in one reviewable structure.

## What this pass adds

- Store listing copy template.
- Partner Center field-map template.
- Copy claim review template.
- Static claim-rule fixture.
- Source verifier: `npm run verify:pass-263-store-listing-copy-truth-pack`.
- Evidence gate: `npm run gate:pass-263-store-listing-copy-truth-pack`.

## Store posture

This pass does **not** submit to the Microsoft Store and does **not** claim Store approval, signed MSI/EXE status, public GA, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

## Required final proof before copy paste into Partner Center

The hard gate stays blocked until the final listing copy pack records:

- real public HTTPS URLs;
- package version, package hash, and source commit truth;
- final short/long description and release notes;
- prohibited-claim review;
- screenshot/copy consistency review;
- known-issues truth review;
- operator approval for Partner Center copy/paste.

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass263-store-listing-copy-truth-pack.mjs
npm run verify:pass-263-store-listing-copy-truth-pack
```

Optional hard gate after final listing copy exists:

```powershell
npm run gate:pass-263-store-listing-copy-truth-pack
```

Expected final-pack path:

```text
release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json
```

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
