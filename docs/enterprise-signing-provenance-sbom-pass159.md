# PASS159 — Enterprise Signing/Provenance/SBOM Gate

PASS159 makes the release lane harder to misrepresent. It does not sign packages inside the source tree and it does not create release artifacts for commit. It defines the enterprise release evidence that must exist beside packaged artifacts before TAHAI Web Services Browser can be described as enterprise GA.

## Gate purpose

The browser is an enterprise DevOps and IT Admin command browser. Release evidence must therefore prove not only that source compiles, but that the exact public source, lockfile, generated packages, checksums, signing truth, SBOM, provenance manifest, and installed-app smoke evidence all line up.

## Required release evidence

Before public enterprise GA language is used, the release must have:

- Windows installer handoff manifest generated after packaging.
- Linux package handoff manifest generated after packaging.
- SHA256SUMS files generated from the exact artifacts being published.
- SBOM generated from the exact `package-lock.json` used to package the build.
- package-lock SHA-256 recorded in the SBOM and release provenance manifest.
- release provenance manifest tying version, commit or tag, package-lock SHA-256, artifact names, checksums, and signing status together.
- explicit no false signing claim language: signed only means actually signed by an approved signing lane; otherwise the release is an unsigned preview.
- Windows installed-app smoke evidence and Linux installed-package smoke evidence captured outside the source tree.

## Source-only commands

```bash
npm run generate:sbom
npm run release:provenance:plan
npm run verify:pass-159-enterprise-signing-provenance-sbom
```

`npm run release:provenance:plan` prints the PASS159 provenance plan without writing generated artifacts. `npm run generate:sbom` and `npm run release:provenance` intentionally write under `artifacts/` and those generated files must not be committed.

## Packaging lane commands

```powershell
Set-Location C:\dev\browser\app
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run verify:release-blockers
npm run package:win:release
npm run package:linux
npm run generate:sbom
npm run release:provenance
npm run release:public:manifest
```

## Guardrails

- No generated artifacts in source.
- No signing claim without actual signing evidence.
- No PSA connector, no direct PSA API calls, and no provider secrets.
- No backend work in this repo.
- No GitHub token, certificate, private key, or installer signing secret in source.
- Enterprise GA remains blocked until package, smoke, provenance, SBOM, checksum, and signing-truth evidence exists.
