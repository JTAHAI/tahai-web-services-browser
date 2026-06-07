#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const repo = process.cwd();
const PASS = 'PASS220';
const failures = [];
function file(rel) { return path.join(repo, rel); }
function exists(rel) { return fs.existsSync(file(rel)); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}
function requireIncludes(rel, needle, message) {
  const text = read(rel);
  if (!text.includes(needle)) failures.push(`${rel}: ${message || `missing ${needle}`}`);
}
function requireRegex(rel, regex, message) {
  const text = read(rel);
  if (!regex.test(text)) failures.push(`${rel}: ${message}`);
}
function walk(dir, results = []) {
  const full = file(dir);
  if (!fs.existsSync(full)) return results;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'release' || entry.name === '.git' || entry.name === 'coverage') continue;
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(rel, results);
    else if (/\.(ts|tsx|js|mjs|cjs|json|md)$/i.test(entry.name)) results.push(rel);
  }
  return results;
}
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
}
function checkPackageWiring() {
  const pkgText = read('package.json');
  let pkg = {};
  try { pkg = JSON.parse(pkgText); } catch (error) { failures.push(`package.json invalid JSON: ${error.message}`); }
  if (!pkg.scripts?.['verify:pass-220-privacy-local-data-inventory']) {
    failures.push('package.json: missing verify:pass-220-privacy-local-data-inventory script');
  }
  if (typeof getReleaseBlockersContract(pkg) === 'string' && !getReleaseBlockersContract(pkg).includes('verify:pass-220-privacy-local-data-inventory')) {
    failures.push('package.json: verify:release-blockers does not include PASS220 verifier');
  }
}
function checkContract() {
  const rel = 'src/shared/privacy-local-data-inventory-contract.ts';
  for (const token of [
    'PASS220_PRIVACY_LOCAL_DATA_INVENTORY_ID',
    'PASS220_PRIVACY_LOCAL_DATA_INVENTORY_VERSION',
    'PASS220_PRIVACY_LOCAL_DATA_SURFACES',
    'PASS220_PROHIBITED_LOCAL_DATA_FIELDS',
    'PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS',
    'PASS220_PRIVACY_BOUNDARY',
    'rendererMustNotReceiveFullLocalPaths',
    'supportBundleMustBeRedacted',
    'missionExportsRequirePreview'
  ]) requireIncludes(rel, token, `missing contract export ${token}`);
  for (const surface of [
    'app-settings',
    'browser-session-cache',
    'mission-json',
    'mission-evidence-files',
    'mission-export-artifacts',
    'downloads-artifact-shelf',
    'support-bundle',
    'runtime-logs',
    'policy-diagnostics',
    'crash-recovery-state',
    'itdocs-display-cache',
    'psa-reference-cache',
    'webview-remote-content-storage'
  ]) requireIncludes(rel, surface, `missing data surface ${surface}`);
  for (const storageClass of [
    'electron-user-data',
    'electron-cache',
    'app-owned-mission-directory',
    'app-owned-evidence-directory',
    'app-owned-log-directory',
    'user-selected-export-path',
    'user-selected-download-path',
    'managed-policy-path',
    'not-written-by-browser'
  ]) requireIncludes(rel, storageClass, `missing storage class ${storageClass}`);
  for (const field of [
    'access_token',
    'refresh_token',
    'Authorization',
    'Cookie',
    'Set-Cookie',
    'BEGIN PRIVATE KEY',
    'AWS_SECRET_ACCESS_KEY',
    'AZURE_CLIENT_SECRET',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'PSA_API_KEY',
    'rawSessionCookie',
    'rawAuthHeader'
  ]) requireIncludes(rel, field, `missing prohibited field ${field}`);
  for (const allowed of ['appVersion', 'osVersion', 'packageType', 'installTruth', 'policyTruth', 'redactionReport', 'verifierResults']) {
    requireIncludes(rel, allowed, `missing support bundle allowlist field ${allowed}`);
  }
  requireRegex(rel, /releaseBlocker:\s*true/g, 'inventory surfaces must be release-blocking');
  requireRegex(rel, /supportBundleAllowed:\s*false/g, 'sensitive surfaces must be excluded from support bundle');
}
function checkHelper() {
  const rel = 'src/shared/privacy-local-data-inventory.ts';
  for (const token of [
    'pass220GetPrivacyInventory',
    'pass220FindPrivacySurface',
    'pass220IsFieldProhibited',
    'pass220IsSupportBundleFieldAllowed',
    'pass220CollectPrivacyInventoryFindings',
    'pass220BuildPrivacyInventorySummary',
    'pass220AssertPrivacyInventoryClean',
    'privacy-inventory-duplicate-surface',
    'privacy-inventory-surface-not-release-blocking',
    'privacy-inventory-storage-class-missing',
    'privacy-inventory-support-bundle-user-content',
    'privacy-inventory-exportable-without-redaction',
    'privacy-inventory-prohibited-field-gap',
    'privacy-inventory-psa-secret-gap',
    'privacy-inventory-itdocs-token-gap',
    'privacy-inventory-required-surface-missing'
  ]) requireIncludes(rel, token, `privacy helper missing ${token}`);
  for (const required of ['mission-json', 'mission-evidence-files', 'mission-export-artifacts', 'support-bundle', 'runtime-logs', 'webview-remote-content-storage']) {
    requireIncludes(rel, required, `privacy helper missing required surface ${required}`);
  }
}
function checkDocs() {
  for (const rel of ['docs/privacy-local-data-inventory.md', 'docs/qa/pass220-privacy-local-data-inventory.md', 'README-PASS220.md']) {
    requireIncludes(rel, 'source-side', `${rel} missing source-side boundary`);
    requireIncludes(rel, 'No', `${rel} missing no-false-claim boundary language`);
    requireIncludes(rel, 'support bundle', `${rel} missing support bundle language`);
    requireIncludes(rel, 'Mission', `${rel} missing Mission local data language`);
    requireIncludes(rel, 'PSA', `${rel} missing PSA reference boundary`);
  }
  requireIncludes('docs/qa/pass220-privacy-local-data-inventory.md', 'npm run verify:pass-220-privacy-local-data-inventory', 'QA doc missing verifier command');
  requireIncludes('docs/privacy-local-data-inventory.md', 'Prohibited local data', 'privacy docs missing prohibited local data section');
}
function checkNoUnsafeSecretsOrFalseClaims() {
  const files = [...walk('src'), ...walk('docs'), 'README-PASS220.md'].filter((rel) => exists(rel));
  const allowedFixtureFiles = new Set([
    'src/shared/privacy-local-data-inventory-contract.ts',
    'src/shared/privacy-local-data-inventory.ts',
    'docs/privacy-local-data-inventory.md',
    'docs/qa/pass220-privacy-local-data-inventory.md',
    'README-PASS220.md'
  ]);
  const forbiddenRawPatterns = [
    /BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY/i,
    /AWS_SECRET_ACCESS_KEY\s*[:=]\s*['"][^'"]{8,}/i,
    /AZURE_CLIENT_SECRET\s*[:=]\s*['"][^'"]{8,}/i,
    /GOOGLE_APPLICATION_CREDENTIALS\s*[:=]\s*['"][^'"]{8,}/i,
    /PSA_API_KEY\s*[:=]\s*['"][^'"]{8,}/i,
    /refresh_token\s*[:=]\s*['"][^'"]{8,}/i,
    /access_token\s*[:=]\s*['"][^'"]{8,}/i,
    /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{12,}/i,
    /Cookie:\s*[^\n]{12,}/i
  ];
  for (const rel of files) {
    const text = stripComments(read(rel));
    if (!allowedFixtureFiles.has(rel)) {
      for (const regex of forbiddenRawPatterns) {
        if (regex.test(text)) failures.push(`${rel}: risky secret-like privacy/local-data pattern appears outside PASS220 docs/helpers: ${regex}`);
      }
    }
  }
  const falseClaims = [
    'PASS220 proves installed Windows behavior',
    'PASS220 proves installed Linux behavior',
    'support bundle runtime verified',
    'signed release complete',
    'Microsoft Store approved',
    'public GA approved',
    'GA ready',
    'generally available'
  ];
  for (const rel of allowedFixtureFiles) {
    if (!exists(rel)) continue;
    const text = read(rel);
    for (const claim of falseClaims) {
      if (text.includes(claim)) failures.push(`${rel}: forbidden false-readiness claim: ${claim}`);
    }
  }
}

checkPackageWiring();
checkContract();
checkHelper();
checkDocs();
checkNoUnsafeSecretsOrFalseClaims();

if (failures.length) {
  console.error(`[${PASS}][FAIL] Privacy and Local Data Inventory verifier failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`[${PASS}][OK] Privacy and Local Data Inventory verified.`);
