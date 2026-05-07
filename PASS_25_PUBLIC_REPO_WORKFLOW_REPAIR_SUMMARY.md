# Pass 25 - Public repo workflow repair

Restores the public repository scaffolding required by the source verifier while preserving the open-source security posture.

## Added

- `.gitignore` with dependency, build-output, runtime-data, temporary-file, and secret-material exclusions.
- `.github/dependabot.yml` for weekly npm dependency visibility.
- `.github/workflows/validate-source.yml` for source verification and release-blocker validation on push/PR.
- `.github/workflows/windows-preview-package.yml` for manually triggered unsigned Windows preview packaging.
- `scripts/verify-pass-25-public-repo-workflows.mjs`.

## Guardrails

- No generated installers, zips, release outputs, node_modules, runtime profiles, or secrets are committed.
- Packaging workflow is manual-only.
- Windows preview packaging disables automatic certificate discovery for unsigned preview builds.
