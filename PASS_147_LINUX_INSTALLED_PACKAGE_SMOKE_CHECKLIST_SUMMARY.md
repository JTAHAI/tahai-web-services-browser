# PASS147 — Linux Installed Package Smoke Checklist

PASS147 adds the Linux installed package smoke checklist and evidence runner for the TAHAI Web Services Browser release lane.

Version remains `1.8.30`.

## Files added

- `src/shared/linux-installed-smoke-contract.ts`
- `scripts/run-pass147-linux-installed-smoke.sh`
- `scripts/verify-pass-147-linux-installed-smoke.mjs`
- `docs/linux-installed-smoke-pass147.md`
- `PASS_147_LINUX_INSTALLED_PACKAGE_SMOKE_CHECKLIST_SUMMARY.md`

## Package scripts added

- `evidence:linux-installed-smoke`
- `verify:pass-147-linux-installed-smoke`

## Release blocker wiring

PASS147 is wired into `verify:release-blockers` after PASS146 and before the final build gate.

## Guardrails

- Generated evidence outputs remain excluded from source under `artifacts/linux-installed-smoke/`.
- Generated Linux package outputs remain excluded from source under `release/linux/`.
- The runner does not install, remove, erase, or upgrade packages.
- The runner does not run sudo package-manager operations.
- The runner does not claim that Linux manual smoke was completed here.
- The runner collects evidence for RPM, DEB, and AppImage installed-app/manual smoke.
- No direct PSA API calls.
- No IT Docs backend changes.
- No secrets, cookies, tokens, or customer data in evidence.

## Local smoke examples

```bash
npm run evidence:linux-installed-smoke -- --package-type rpm --installed-bin /usr/bin/tahai-web-services-browser --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm --launch
```

```bash
npm run evidence:linux-installed-smoke -- --package-type appimage --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage --launch
```
