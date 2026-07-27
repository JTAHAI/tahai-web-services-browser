# Partner Center Identity Prep — TAHAI Web Services Browser 2.0.18

STATUS: PARTNER_CENTER_IDENTITY_PENDING

Use this checklist only after the app is reserved in Microsoft Partner Center. Until then, keep placeholder identity files and the Store submission gate blocked.

## Identity fields to capture from Partner Center

Record these values in the real Store evidence file, not in public docs if any value is sensitive:

- App name reserved in Partner Center.
- Package/Identity/Name.
- Package/Identity/Publisher, usually a `CN=...` publisher subject.
- PublisherDisplayName.
- Package family name.
- Store product ID, if available.
- Architecture target: x64.
- Version: `2.0.18.0` for the Store package lane unless explicitly changed.

## Manifest replacement workflow

1. Reserve the app in Partner Center.
2. Copy `packaging/windows/msix/package-identity.store.example.json` to a private local evidence/work file.
3. Replace every `PARTNER_CENTER_PENDING` / `REPLACE_WITH_*` value with the Partner Center values.
4. Update the MSIX manifest or identity-generation input used by the WinApp CLI/package lane.
5. Rebuild the Store package artifact.
6. Run package evidence capture:

```powershell
npm run store:evidence:refresh
```

7. Create or update the real evidence file:

```powershell
$env:STORE_SUBMISSION_EVIDENCE = (Resolve-Path .\release-candidate\generated\store-submission\store-submission-evidence.generated.json)
npm run verify:store:submission
```

8. Fill the real evidence file with the final identity, URLs, listing, artifact hashes, installed-smoke result, and known-issues truth.
9. Keep `release-candidate/store-submission/store-submission-evidence.json` as the sanitized source-controlled placeholder. If it drifts, run `npm run store:evidence:reset-placeholder`.

## Hard blockers

Do not submit if any of these are true:

- Package identity still contains placeholders.
- Privacy or support URL is missing or not public HTTPS.
- Screenshots/listing assets are missing or stale.
- Package artifact hash/size/version/source commit are not captured.
- Installed Windows smoke has not been completed.
- Known issues are not reviewed.
- Direct MSI/EXE is described as signed when it is still unsigned preview.
- Store approval/submission is claimed before Partner Center submission evidence exists.
