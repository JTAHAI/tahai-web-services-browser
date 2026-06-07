import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const fail = (m) => { console.error(`PASS41_ITDOCS_BROWSER_CONTRACT_FAIL=${m}`); process.exit(1); };
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const shared = fs.readFileSync('src/shared/itdocs-contract.ts','utf8');
const mainClient = fs.readFileSync('src/main/itdocs-client.ts','utf8');
const main = fs.readFileSync('src/main/main.ts','utf8');
const preload = fs.readFileSync('src/preload/preload.ts','utf8');
const renderer = fs.readFileSync('src/renderer/app.ts','utf8');
const html = fs.readFileSync('src/renderer/index.html','utf8');
const validator = fs.readFileSync('src/shared/mission-validators.ts','utf8');
const doc = fs.readFileSync('docs/itdocs-browser-contract.md','utf8');
const checks = [
  [shared, 'ITDOCS_ALLOWED_ORIGINS', 'allowed-origins-missing'],
  [shared, 'sanitizeItDocsCapabilities', 'capability-sanitizer-missing'],
  [shared, 'sanitizeItDocsDeepLink', 'itdocs-deeplink-sanitizer-missing'],
  [mainClient, '/api/browser/mission-capabilities', 'capability-endpoint-missing'],
  [mainClient, 'net.request', 'main-capability-query-missing'],
  [mainClient, 'localOnlyItDocsCapabilities', 'local-only-fallback-missing'],
  [main, "tahai-browser:get-itdocs-capabilities", 'capability-ipc-missing'],
  [main, "tahai-browser:open-itdocs", 'open-itdocs-ipc-missing'],
  [preload, 'getItDocsCapabilities', 'preload-capability-api-missing'],
  [preload, 'copyItDocsCapabilities', 'preload-copy-contract-missing'],
  [renderer, 'refreshItDocsCapabilityState', 'renderer-refresh-missing'],
  [renderer, 'renderItDocsCapabilities', 'renderer-render-missing'],
  [renderer, 'IT Docs contract state', 'handoff-contract-state-missing'],
  [html, 'itdocs-capability-summary', 'itdocs-contract-ui-missing'],
  [validator, 'sanitizeItDocsDeepLink(links.itDocs.deepLink)', 'mission-itdocs-deeplink-not-allowlisted'],
  [doc, 'Server authorization still controls every write', 'contract-doc-authority-missing']
];
for (const [content, needle, code] of checks) if (!content.includes(needle)) fail(code);
if (!pkg.scripts?.['verify:pass-41-itdocs-browser-contract']) fail('package-script-missing');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-41-itdocs-browser-contract')) fail('release-blockers-not-wired');
for (const pattern of [/psa:direct-fetch/i, /fetch\(['"]https:\/\/[^'"]*psa/i, /Authorization['"]\s*,\s*['"]Bearer/i]) {
  if (pattern.test(shared + mainClient + main + preload + renderer)) fail(`forbidden-pattern-${pattern}`);
}
console.log('PASS41_ITDOCS_BROWSER_CONTRACT_OK=1');
