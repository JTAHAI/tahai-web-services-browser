# PASS250 — Microsoft Store Submission Evidence + Partner Center Identity Prep

STORE_SUBMISSION_STATUS: BLOCKED

TAHAI Web Services Browser 2.0.14 is **not yet submitted to Microsoft Store**, **not approved by Microsoft Store**, and **not public GA** from this repo until the evidence below is complete and `npm run verify:store:submission` passes against real local evidence.

This pass creates the fail-closed evidence lane for Microsoft Store submission readiness. It does not claim Store approval, Store submission, or trusted signing for direct MSI/EXE distribution.

## Required evidence before Store submission

| Gate | Required proof | Status until proven |
| --- | --- | --- |
| Partner Center identity | Reserved Microsoft Partner Center package identity, publisher display name, package name, publisher certificate name, and manifest replacement record | BLOCKED |
| Privacy/support URLs | Public HTTPS privacy URL and support URL tested from a clean browser profile | BLOCKED |
| Listing packet | Final title, short description, full description, screenshots, release notes, category, age/content notes, and Store-vs-direct signing copy | BLOCKED |
| Package artifact | MSIX/MSIXUPLOAD/APPXUPLOAD artifact inventory with SHA256, size, timestamps, version, and source commit/tag | BLOCKED |
| Installed Windows smoke | MSI/EXE installed smoke or Store-package installed smoke with window, navigation, resize, shortcuts, downloads, evidence export, settings persistence, support bundle, and no critical console/runtime errors | BLOCKED |
| Automated installed runtime | PASS158/PASS342 installed-app runtime E2E proof with launch-shell guest viewport and document-bottom fill details. This is supporting evidence only and does not replace the manual installed Windows smoke gate | BLOCKED until generated |
| Known-issues truth | Reviewed known-issues file with no hidden release blockers and clear unsigned-preview language for direct installers | BLOCKED |
| Release-truth gate | `npm run verify:store:submission` passes against a real evidence file | BLOCKED |

## What PASS250 adds

- Partner Center identity replacement workflow.
- Package evidence capture script for `.msi`, `.exe`, `.msix`, `.msixupload`, and `.appxupload` outputs.
- Installed Windows smoke evidence template.
- Automated installed runtime E2E evidence carry-forward for packaged-app launch/click/render proof.
- Store listing packet template.
- Known-issues truth template.
- Fail-closed Store submission verifier.
- Generated-artifact exclusion hardening for package outputs, certificates, private keys, and generated Store evidence.

## Commands after overlay

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
npm run verify:pass-250-store-submission-evidence-identity-prep
npm run store:evidence:refresh
npm run verify:store:submission
```

Expected current result:

- `verify:pass-250-store-submission-evidence-identity-prep` should pass after the apply script.
- `store:evidence:refresh` should write ignored local package inventory plus fail-closed local Store evidence if release outputs exist.
- `verify:store:submission` should fail until real Partner Center identity, listing, privacy/support URLs, installed smoke, package evidence, and known-issues truth are complete.

## Store-vs-direct distribution truth

- Microsoft Store MSIX distribution may be signed by Microsoft during Store submission.
- Direct MSI/EXE remains **unsigned preview** unless a trusted signing path is added.
- Direct MSIX sideload testing still requires a certificate trusted by the target device.
- Do not commit generated packages, certificates, Partner Center secrets, `.pfx`, `.cer`, release output, or local evidence output.

## Definition of done for PASS250

PASS250 is complete when the repo has a fail-closed Store submission evidence lane and the PASS250 verifier confirms the lane, templates, generated-artifact exclusions, and package scripts are present. PASS250 does **not** complete the Microsoft Store submission itself.
