# Store submission evidence

This directory is for human-reviewed Store submission evidence. Do not commit generated package artifacts, Partner Center credentials, certificates, or private keys. Keep the real evidence file local until it is sanitized for source control.

Recommended local flow:

1. Run `npm run store:evidence:capture` to hash package candidates under `release/` and `release-msix/`.
2. Run `npm run store:evidence:init` to create a fail-closed `store-submission-evidence.json` from the PASS250 template and current package evidence.
3. Keep `submissionStatus` blocked until Partner Center identity, public privacy/support URLs, current-version MSIX/MSIXUPLOAD evidence, installed smoke, listing assets, known issues, and release-truth fields are human-reviewed.
4. Run `npm run verify:store:submission`; it should only pass after the evidence is genuinely ready for Partner Center upload.
