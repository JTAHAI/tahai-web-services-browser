# Support

TAHAI Web Services Browser is an early public preview / public-RC browser project. Support is best-effort open-source support unless a separate written support agreement says otherwise.

Current version lane: `1.8.30 public-rc`  
Documentation closeout: `PASS145`

## Where to ask for help

- Bugs: open a GitHub issue with clear steps to reproduce.
- Security reports: follow `SECURITY.md`; do not post exploitable security details publicly.
- General product/download information: use the official TAHAI Browser pages and GitHub Releases.

## What to include in a bug report

Include the minimum detail needed to reproduce and triage the issue:

- Browser version, for example `1.8.30`.
- Operating system and version.
- installer type, for example Windows EXE, Windows MSI, Linux AppImage, Linux deb, Linux rpm, or source/dev build.
- Whether SHA256 verification passed for the installer/package you used.
- Mission Control mode involved, if any: 1-Up, 2-Up, 3-Up, Quad View, Focus Pane, KB, First Run, Evidence Pack, or normal browsing.
- Exact steps to reproduce.
- Expected result and actual result.
- Redacted screenshots or logs if they help.

## Do not post secrets

Do not post secrets, tokens, copied cookies, provider credentials, PSA credentials, private keys, private browser profiles, customer data, sensitive URLs, unredacted support logs, or unredacted Mission/Evidence exports in public issues.

When in doubt, redact first and describe the shape of the problem instead of sharing raw sensitive content.

## Support boundaries

This repository is the public browser lane only.

- It does not provide IT Docs backend support.
- It does not provide PSA connector support.
- It does not store provider secrets or PSA credentials.
- It does not perform direct PSA API calls from the browser.
- It does not include enterprise GA support commitments until the PASS150 GA manifest says so.

## Known issues

Before filing a new issue, review `docs/known-issues.md` and the current release notes/download instructions.
