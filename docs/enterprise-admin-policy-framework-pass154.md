# PASS154 — Enterprise Admin Policy Framework

PASS154 adds the first enterprise-managed policy layer for TAHAI Web Services Browser. This is browser-side source only. It does not add a backend, PSA connector, credential store, or silent update system.

## Purpose

TAHAI is moving from a strong power-user browser toward an enterprise DevOps and IT Admin command browser. Enterprise manageability needs an explicit policy contract before profiles, recipes, support bundles, signing/provenance, and GA decision gates continue.

## Managed policy sources

The browser now looks for a JSON policy file without exposing raw filesystem control to the renderer:

- Environment override: `TAHAI_BROWSER_MANAGED_POLICY_FILE`
- Windows: `%ProgramData%\\TAHAI\\Web Services Browser\\managed-policy.json`
- Linux: `/etc/opt/tahai-browser/managed-policy.json`
- macOS: `/Library/Application Support/TAHAI Web Services Browser/managed-policy.json`
- Packaged fallback: `managed-policy.json` in packaged resources

If no managed policy exists, the browser uses a local default policy and reports `managed=false`.

## Schema v1 controls

The PASS154 schema supports:

- locked settings for home URL, startup mode, search provider, permissions, download prompts, UI, and privacy options;
- disabled tools such as DNS lookup, TLS summary, JWT decoder, CIDR calculator, mission export, evidence export, support bundle, and DevTools;
- allowed protocols and blocked protocols;
- allowed domains and blocked domains;
- download policy, including external HTTP download blocking posture;
- Mission export policy;
- evidence export policy;
- support bundle policy;
- update channel policy.

## Security posture

- Policy files are size-bounded and sanitized before use.
- Unknown/excessive values are stripped or defaulted.
- Secret-looking policy values are rejected by sanitizers.
- Renderer receives only a sanitized policy state through a typed IPC channel.
- Locked settings are applied in the main process to read, update, and reset paths.
- silent auto-update remains disabled regardless of managed policy input.
- No raw IPC, filesystem, shell, registry, or privileged Electron APIs are exposed to remote pages or webviews.

## Non-goals

PASS154 does not implement ADMX/GPO ingestion, Windows registry policy, MDM payloads, remote policy fetch, or cloud policy service. Those can layer on top of this schema later.

## Verification

Run:

```powershell
npm run verify:pass-154-enterprise-admin-policy-framework
npm run verify:release-blockers
```

PASS154 is wired after PASS153 and before the final build in `verify:release-blockers`.

## Artifact hygiene

No generated release artifacts, installers, `dist`, `release`, local evidence, browser profiles, credentials, secrets, or `node_modules` are part of this pass. No generated release artifacts should be committed.
