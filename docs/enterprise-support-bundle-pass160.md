# PASS160 — Enterprise Support Bundle

PASS160 adds a redacted enterprise support bundle lane for TAHAI Web Services Browser.

## Purpose

Enterprise DevOps and IT Admin browser deployments need a support artifact that can be copied or saved without leaking operator secrets, customer data, browser profiles, local paths, mission files, cookies, tokens, or console/session material.

This pass adds a source-level support bundle contract and main-process export path that reports safe operational truth:

- version truth
- enterprise policy truth
- install truth
- runtime truth
- profile counts and kinds
- mission inventory counts only
- privacy/redaction truth
- PASS159 signing/provenance/SBOM truth
- log collection truth

## Security guardrails

The bundle is redacted by default. It does not include:

- cookies
- Authorization headers
- access tokens or refresh tokens
- API keys
- local filesystem paths
- raw browser profiles
- raw mission files
- mission notes
- evidence bodies
- clipboard input
- page DOM
- generated installers or generated artifacts

The bundle is generated only through trusted browser-shell IPC channels, with sender-origin validation preserved in the main process.

## User-facing access

The IT Docs / PSA Handoff Center now includes an Enterprise Support Bundle panel with:

- Preview Support Bundle
- Copy Support Bundle
- Save Support Bundle

The saved output is Markdown and uses a generic success label rather than exposing the local file path.

## Enterprise GA posture

PASS160 does not approve enterprise GA. It strengthens supportability while preserving the PASS152/PASS159 no-false-GA posture. Enterprise GA remains blocked until PASS162 validates source, packages, installed smoke, policy, security, evidence, signing/provenance, and manual attestations.

## Verification

Run:

```powershell
npm run verify:pass-160-enterprise-support-bundle
npm run build
npm run verify:release-blockers
```

No generated release artifacts, SBOMs, provenance outputs, support bundles, logs, browser profiles, or local runtime data are committed by this pass.
