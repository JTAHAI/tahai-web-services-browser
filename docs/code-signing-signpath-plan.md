# Code Signing / SignPath Plan

Goal: move from unsigned friend-feedback installers to signed Windows releases.

Current posture: TAHAI Web Services Browser 1.8.0 preview may be distributed unsigned with a clear SmartScreen/user-warning note and SHA256 checksums.

Readiness checklist:

- Public GitHub repository
- OSI-approved Apache-2.0 license
- `NOTICE` attribution
- Trademark policy
- Clean source tree
- No generated binaries in source
- Public CI validation
- Reproducible release commands documented

After SignPath approval, add a signing workflow, keep unsigned preview packaging separate from signed release packaging, and publish signed installers through GitHub Releases and official TAHAI download pages.
