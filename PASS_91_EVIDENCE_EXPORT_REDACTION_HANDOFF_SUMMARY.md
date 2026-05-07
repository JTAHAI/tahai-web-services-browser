# PASS91 — Evidence Export Redaction Handoff Safety

Browser-side only. Version remains 1.8.30.

## Hardened surfaces

- Added shared `src/shared/evidence-safety.ts` for evidence URL sanitization, Markdown redaction, internal-vs-sanitized profile handling, and safe Markdown table cell output.
- Expanded `src/shared/redaction.ts` coverage for sensitive URL query values, OpenAI-style keys, Slack tokens, Google API keys, AWS secret access key assignments, generic secret assignments, IPv6, Authorization headers, Cookie headers, private keys, emails, and IPs.
- Hardened Mission validation so evidence notes, timeline text, and evidence metadata values are redaction-scanned before persistence; sensitive URL query params are redacted and URL fragments are stripped.
- Hardened Mission Evidence Pack generation so URLs are sanitized, Markdown cells are escaped, and the exported redacted copy uses the shared evidence safety engine.
- Hardened main-process Mission export copy/save so only `redactedMarkdown` is copied or written.
- Hardened Evidence / Change Bundle and IT Docs / PSA Handoff Center generation, preview, copy, and save paths so edited textarea content is re-sanitized before leaving the browser.
- Hardened Ops Guard to use the same shared redaction/sanitization path for redacted sharing output.
- Added accessibility and keyboard/scroll resilience to bundle, handoff, and Ops Guard dialogs with `aria-describedby`, focus-visible styling, bounded scrolling, and responsive preview sizing.

## Guardrails preserved

- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No secrets, generated artifacts, runtime profiles, `dist`, `release`, or `node_modules` added.
- Open-source posture preserved: source assumes renderer input, mission files, and remote page content are untrusted.

## Verification

New verifier:

```powershell
npm run verify:pass-91-evidence-export-redaction-handoff
```

Wired into:

```powershell
npm run verify:release-blockers
```
