# PASS226 — Enterprise Support Bundle v2

PASS226 adds the source-side contract for a redacted enterprise support bundle. The goal is one operator-approved diagnostics export that support, QA, and enterprise admins can read without leaking credentials, customer data, browser history, cookies, PSA/API secrets, IT Docs tokens, cloud keys, or private signing material.

## Boundary

PASS226 is source-side hardening only. It defines the support bundle v2 data model, redaction rules, required sections, docs, and verifier. It does not claim installed one-click export success, installed Windows smoke success, installed Linux smoke success, public GA readiness, Store readiness, or signed package status.

There is no installed-app smoke success from this pass alone. Runtime UI wiring and installed Windows/Linux proof remain required before any public support-bundle claim.

## Required bundle sections

Every Enterprise Support Bundle v2 manifest must be redacted by default and include these sections:

- app version — product name, app version, Electron/Chromium/Node runtime version, build channel truth, and update posture.
- OS/runtime — platform, architecture, OS release class, display class, and runtime facts without usernames or machine secrets.
- package type — dev, portable, NSIS, MSI, AppImage, RPM, DEB, MSIX, unknown, or other supported package lane truth.
- policy truth — managed policy source, schema version, locked settings count, disabled tools count, and effective support bundle policy.
- install truth — install path class, user data path class, package identity, update channel, signing status truth, and install/uninstall proof boundary.
- recent non-secret errors — recent sanitized errors, component, timestamp, category, and non-secret summary only.
- mission diagnostics — mission count, active mission type, pane/layout summary, evidence counts, blocked states, and no raw mission notes or webview HTML.
- browser settings — safe user-facing settings and feature flags without browsing history, cookies, session storage, or credential material.
- redaction report — counts and classes of values redacted or blocked, with no raw matched secret material.
- local data inventory — storage class inventory and approximate sizes without file contents or full user-specific paths.
- build provenance summary — source/build/provenance/SBOM/checksum presence and unsigned-preview truth.
- manual proof boundary — explicit statement of what still requires installed Windows/Linux proof.

## Redaction and blocking rules

The support bundle must block or redact these classes before export:

- Authorization headers, Cookie headers, and Set-Cookie headers.
- access_token, refresh_token, id_token, client_secret, x-api-key, api_key, and PSA API key fields.
- private key blocks, certificate private keys, PFX/P12 secrets, and signing material.
- AWS/cloud credential patterns and GitHub token patterns.
- raw mission notes, raw webview HTML, browser history dumps, localStorage/sessionStorage dumps, IndexedDB dumps, and cache dumps.
- user paths, usernames, email addresses, IP addresses, and machine identifiers unless a future internal-only policy explicitly permits them.

The redaction report must include counts and classes only. It must not include raw secret matches, token previews, cookie values, private keys, or credential fragments.

## Policy and install truth

Enterprise support depends on policy truth and install truth. A support bundle that cannot describe the active managed policy source, effective support-bundle policy, package type, install class, update-channel truth, and signing status truth is not enterprise-grade.

PASS226 therefore treats policy truth, install truth, and package type as release-blocking required sections.

## Manual proof boundary

The source-side verifier cannot prove:

- one-click support bundle UI behavior inside an installed app,
- installed Windows export behavior,
- installed Linux export behavior,
- redacted ZIP creation in the real app profile,
- package identity under NSIS/MSI/AppImage/RPM/DEB/MSIX,
- support bundle file save/open behavior,
- support bundle collection from real app logs,
- or helpdesk usability under real operator workflows.

Those remain manual Windows/Linux proof still required before public release claims.

## Source hygiene

Generated support bundles are runtime diagnostics artifacts. They must not be committed to source. Do not commit support bundle ZIPs, diagnostic TAR files, raw logs, local app profile output, policy exports with secrets, cookies, tokens, private keys, generated certificates, or customer mission evidence.
