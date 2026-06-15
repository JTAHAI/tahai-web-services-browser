# Store submission evidence

This directory keeps the sanitized tracked placeholder only. Do not commit generated package artifacts, Partner Center credentials, certificates, private keys, or live local submission evidence here.

Recommended local flow:

1. Run `npm run store:evidence:capture` to hash package candidates under `release/` and `release-msix/`.
2. Run `npm run store:evidence:init` or `npm run store:evidence:refresh` to create ignored local evidence under `release-candidate/generated/store-submission/`.
3. Keep `release-candidate/store-submission/store-submission-evidence.json` as the sanitized source-controlled placeholder. Run `npm run store:evidence:reset-placeholder` if it drifts.
4. Keep `submissionStatus` blocked until Partner Center identity, public privacy/support URLs, current-version MSIX/MSIXUPLOAD evidence, installed smoke, listing assets, known issues, and release-truth fields are human-reviewed.
5. Run `npm run verify:store:submission`; it should prefer ignored local evidence and only pass after the evidence is genuinely ready for Partner Center upload.
