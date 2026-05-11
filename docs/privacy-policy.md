# Privacy Policy

TAHAI Web Services Browser is an open-source Chromium-compatible browser workbench for developers, DevOps operators, IT engineers, support desks, and builders.

Version lane: `1.8.30 public-rc`  
Documentation closeout: `PASS145`

## Summary

TAHAI Web Services Browser does not intentionally collect, sell, rent, or transfer user telemetry, browsing history, credentials, mission notes, Evidence Pack content, or personal data to TAHAI Web Services.

The browser is designed as a local-first browser workbench. Normal browser/application data may exist on the user's device because the user operates a Chromium-based application. Examples include preferences, local profile data, browser cache, cookies, history, session state, downloaded files, local Mission Control state, local Mission notes, local Evidence Pack metadata, and local export drafts.

## Mission Control, evidence, and redaction

Mission Control, Mission Tabs, Mission Views, Mission Tools, and Mission Evidence are browser-side/local-first workflows in this repository.

Local mission data and Evidence Pack data may include URLs, page titles, timestamps, operator notes, pane roles, and redaction results. PASS143 and PASS145 keep the public posture explicit: evidence and mission export workflows must use redaction-aware handling before export or any future authorized sync path.

Do not intentionally place secrets, customer data, provider credentials, copied cookies, private keys, access tokens, refresh tokens, PSA credentials, or raw sensitive support logs into mission notes, issue reports, screenshots, or public exports.

## Network activity

This browser connects to websites, web applications, provider consoles, documentation sites, AI services, cloud services, and other network destinations specifically requested by the user or configured by the person installing or operating the software.

Third-party websites and services opened by the user are governed by their own privacy policies, account terms, authentication systems, and data handling practices. TAHAI Web Services Browser does not control the privacy behavior of those third-party destinations.

## Local data

Application settings, profile data, browser state, local Mission Control state, local Mission notes, Evidence Pack metadata, caches, cookies, history, downloads, and export drafts may be stored locally on the user's machine.

Users can remove local profile/application data using normal operating system controls. Uninstalling the app may not remove all local profile data automatically; that behavior depends on the operating system, installer type, and user choices.

## Updates and downloads

Current public release behavior is manual release downloads only; no silent auto-update channel is enabled in this source lane.

Official TAHAI Web Services Browser releases should be distributed only through the official public GitHub Releases page and official TAHAI download pages, such as `browser.tahai.net` or `browser.tahaiportal.com`. Users should verify SHA256 checksums before installing downloaded packages.

## Support and issue reports

Bug reports, screenshots, logs, and support requests must be redacted before sharing. Do not post secrets, tokens, cookies, private customer data, live credentials, private keys, raw browser profiles, or sensitive mission/evidence exports in public issues.

For support boundaries, see `SUPPORT.md`.

For security reports, see `SECURITY.md`.

## Contact

For privacy or security questions, contact:

justintahai@gmail.com
