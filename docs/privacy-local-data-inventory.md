# TAHAI Web Services Browser Privacy and Local Data Inventory

PASS220 creates the source-side privacy/local-data inventory for the browser. It documents each local data surface before release-candidate packaging claims can move forward.

## Boundary

This is a source-side inventory and verifier pass only. It does not prove installed Windows behavior, installed Linux behavior, signing, Microsoft Store approval, support-bundle runtime output, or public GA readiness.

## Required release-blocking surfaces

- app settings and UI preferences
- Chromium/browser session cache and storage
- local Mission JSON
- Mission evidence files
- Mission export artifacts
- download/artifact shelf display records
- redacted support bundle fields
- runtime logs and non-secret diagnostics
- managed policy diagnostics
- crash recovery state
- IT Docs display-only reference cache
- PSA display-only reference cache
- remote webview content storage

## Prohibited local data

The browser source, mission files, exports, support bundles, fixtures, and docs must not contain provider secrets, PSA secrets, IT Docs/OAuth tokens, Authorization headers, Cookie headers, private keys, cloud secret keys, or raw session material.

## Support bundle posture

Support bundles are allowed to include only display-safe diagnostic facts such as app version, OS version, package type, install truth, policy truth, non-secret error summaries, mission diagnostic summaries, redaction reports, verifier results, and timestamps.

Support bundles must not include raw mission notes, screenshots, browser cookies, local storage dumps, full URL query strings, provider tokens, authorization headers, or local filesystem paths from renderer-owned messages.

## Export posture

Mission exports and evidence packets require preview/redaction before external handoff. Private-key and token classes are blocking findings. Sanitized handoff exports should prefer safe URLs, titles, timestamps, checksums, redaction reports, and operator-approved summaries.
