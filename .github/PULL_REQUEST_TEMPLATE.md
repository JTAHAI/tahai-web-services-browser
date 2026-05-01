## Summary

Describe what changed and why.

## Scope

- [ ] Browser runtime / Electron shell
- [ ] Mission Control / Mission Tabs
- [ ] Packaging / release scripts
- [ ] Documentation only
- [ ] Verification only

## Guardrails

- [ ] No generated artifacts committed (`release/`, `dist/`, installers, zips, `node_modules/`).
- [ ] No secrets, tokens, cookies, credentials, certs, or private mission/evidence data.
- [ ] No direct PSA API calls or provider-secret storage in the public browser lane.
- [ ] No credential-vault files in the public browser lane.
- [ ] No raw IPC, shell, filesystem, or external-open expansion without validation.

## Verification

Paste the relevant output:

```text
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
```

For packaging changes, include target OS and artifact names.
