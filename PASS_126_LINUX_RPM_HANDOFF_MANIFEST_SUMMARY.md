# PASS126 — Linux RPM Handoff Manifest

PASS126 closes the post-RPM artifact handoff gap after RPM-only packaging succeeds.

## What changed

- `scripts/build-linux-installers.sh` now writes `TAHAI-Linux-installers-SHA256SUMS.txt` beside copied Linux installer artifacts under `release/linux`.
- The same copy step now writes `TAHAI-Linux-installers-manifest.json` with schema version, PASS126 marker, product, version, requested targets, artifact names, byte counts, and SHA-256 hashes.
- The existing text manifest now points operators to both checksum and JSON manifest files and records the selected package targets.
- Added `scripts/verify-linux-installer-handoff.mjs` for validating copied handoff artifacts and checksum/manifest integrity after a local Linux package build.
- Added `verify:pass-126-linux-rpm-handoff-manifest` and wired it into `verify:release-blockers` after PASS125 and before final build.

## Operator command after RPM build

```bash
/usr/bin/npm run verify:linux-installer-handoff -- rpm
```

## Guardrails

- Browser-side packaging/handoff only.
- No OS repo edits.
- No generated installers or release artifacts are included in source.
- Version remains `1.8.30`.
