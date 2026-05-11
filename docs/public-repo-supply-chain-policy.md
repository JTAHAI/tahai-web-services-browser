# Public repo and supply-chain policy

TAHAI Web Services Browser is an open-source browser lane. The repository must stay safe to inspect, fork, audit, and build without leaking customer data, provider credentials, mission data, generated packages, or local runtime state.

## Non-negotiable posture

- Use `npm ci` from the committed lockfile for deterministic installs.
- Keep `package-lock.json` committed and in sync with `package.json`.
- Keep runtime dependencies empty unless a future pass documents why a runtime dependency is unavoidable.
- Pin root development dependency versions. Do not use broad `^` or `~` root dependency ranges.
- Do not add root lifecycle scripts such as `preinstall`, `install`, `postinstall`, or `prepare`.
- Maintain no generated artifacts in source: do not commit generated artifacts: no generated installers, release outputs, `dist/`, `release/`, `out/`, `artifacts/`, `node_modules/`, local profiles, mission data, evidence data, caches, or zips.
- Do not commit secrets, tokens, cookies, certificates, keys, `.env` files, credential vaults, customer screenshots, private evidence, or browser runtime profiles.
- Maintain no direct PSA API lane in source: do not add direct PSA API clients, provider credential storage, or direct PSA API writeback to this public browser repo.

## CI and dependency maintenance

GitHub Actions must use the same Node major documented for local packaging: Node 22. The public source validation workflow runs `npm ci`, public repo verification, and release blockers. The dedicated supply-chain guard workflow installs from the lockfile with scripts disabled and runs the PASS144 source posture verifier before build.

Dependabot is enabled for npm packages and GitHub Actions. Dependency updates should remain small, reviewable, and scoped. Security-relevant updates must include `npm ci`, `npm run verify:pass-144-public-repo-supply-chain`, `npm run verify:public-repo`, and `npm run verify:release-blockers` evidence before merge.

## SBOM lane

`npm run generate:sbom` writes a source SBOM to `artifacts/sbom/tahai-browser-sbom.json`. The output is generated evidence and remains ignored by git. Release operators may attach the SBOM to release evidence, but it must not become a stale committed artifact.

## Human review lane

`CODEOWNERS` keeps security-sensitive areas owner-reviewed: `.github`, `scripts`, `packaging`, Electron main/preload/shared source, builder config, dependency manifests, and policy docs.

## Boundary reminder

This project is the browser-side lane only. IT Docs backend authority, PSA connectors, customer authorization, provider credentials, and any server-side writeback must stay outside this public browser source tree.
