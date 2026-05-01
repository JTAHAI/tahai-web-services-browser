import fs from 'node:fs';
const fail = (m) => { console.error(`PASS42_PSA_REFERENCE_CONTRACT_FAIL=${m}`); process.exit(1); };
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const shared = fs.readFileSync('src/shared/psa-reference-contract.ts','utf8');
const types = fs.readFileSync('src/shared/mission-types.ts','utf8');
const validator = fs.readFileSync('src/shared/mission-validators.ts','utf8');
const main = fs.readFileSync('src/main/main.ts','utf8');
const preload = fs.readFileSync('src/preload/preload.ts','utf8');
const renderer = fs.readFileSync('src/renderer/app.ts','utf8');
const html = fs.readFileSync('src/renderer/index.html','utf8');
const doc = fs.readFileSync('docs/psa-reference-contract.md','utf8');
for (const [content, needle, code] of [
  [shared, 'PSA_REFERENCE_PROVIDERS', 'provider-enum-missing'],
  [shared, 'sanitizePsaDeepLink', 'deeplink-sanitizer-missing'],
  [shared, 'sanitizePsaReference', 'reference-sanitizer-missing'],
  [shared, 'directBrowserApiCallsAllowed: false', 'direct-api-block-missing'],
  [shared, 'providerSecretsAllowed: false', 'provider-secret-block-missing'],
  [types, 'PsaReferenceProvider', 'mission-type-provider-boundary-missing'],
  [validator, 'sanitizePsaReference(links.psa)', 'mission-psa-sanitizer-not-wired'],
  [main, 'tahai-browser:copy-psa-reference-contract', 'main-psa-contract-ipc-missing'],
  [preload, 'copyPsaReferenceContract', 'preload-psa-contract-missing'],
  [renderer, 'renderPsaReferenceContract', 'renderer-psa-contract-render-missing'],
  [renderer, 'psaReferenceMarkdown', 'handoff-psa-contract-markdown-missing'],
  [html, 'psa-reference-summary', 'psa-contract-ui-missing'],
  [doc, 'writeback must route through TAHAI IT Docs server-side connector authority', 'doc-writeback-boundary-missing']
]) {
  if (!content.includes(needle)) fail(code);
}
if (!pkg.scripts?.['verify:pass-42-psa-reference-contract']) fail('package-script-missing');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-42-psa-reference-contract')) fail('release-blockers-not-wired');
const combined = [shared, types, validator, main, preload, renderer].join('\n');
for (const pattern of [
  /psa:direct-fetch/i,
  /fetch\s*\(\s*['"]https?:\/\/[^'"]*(psa|connectwise|autotask|halo|syncro|zendesk|freshservice|servicenow)/i,
  /Authorization['"]\s*,\s*['"]Bearer/i,
  /psa[_-]?api[_-]?key/i,
  /client[_-]?secret\s*[:=]/i,
  /refresh[_-]?token\s*[:=]/i
]) {
  if (pattern.test(combined)) fail(`forbidden-pattern-${pattern}`);
}
console.log('PASS42_PSA_REFERENCE_CONTRACT_OK=1');
