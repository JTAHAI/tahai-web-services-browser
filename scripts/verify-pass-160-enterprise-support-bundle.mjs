#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const globals = read('src/renderer/global.d.ts');
const renderer = read('src/renderer/app.ts');
const html = read('src/renderer/index.html');
const security = read('src/shared/electron-security-contract.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS160, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-160-enterprise-support-bundle'] === 'node scripts/verify-pass-160-enterprise-support-bundle.mjs', 'package missing PASS160 verifier script');

const pass159Idx = blockers.indexOf('verify:pass-159-enterprise-signing-provenance-sbom');
const pass160Idx = blockers.indexOf('verify:pass-160-enterprise-support-bundle');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass159Idx >= 0, 'release blockers missing PASS159');
need(pass160Idx > pass159Idx, 'PASS160 must run after PASS159');
need(finalBuildIdx > pass160Idx, 'PASS160 must run before final build');
need(blockers.includes('verify:pass-152-enterprise-evidence-binder'), 'release blockers must preserve PASS152 no-false-GA gate');

for (const file of [
  'src/shared/enterprise-support-bundle-contract.ts',
  'src/main/enterprise-support-bundle.ts',
  'scripts/verify-pass-160-enterprise-support-bundle.mjs',
  'docs/enterprise-support-bundle-pass160.md',
  'PASS_160_ENTERPRISE_SUPPORT_BUNDLE_SUMMARY.md'
]) need(exists(file), `missing PASS160 file: ${file}`);

const contract = includesAll('src/shared/enterprise-support-bundle-contract.ts', [
  'ENTERPRISE_SUPPORT_BUNDLE_PASS',
  'PASS160',
  'ENTERPRISE_SUPPORT_BUNDLE_SCHEMA_VERSION = 1',
  'ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID',
  'enterprise-support-bundle-v1',
  'EnterpriseSupportBundleManifest',
  'EnterpriseSupportBundleResult',
  'ENTERPRISE_SUPPORT_BUNDLE_REQUIRED_SECTIONS',
  'versionTruth',
  'policyTruth',
  'installTruth',
  'runtimeTruth',
  'profileTruth',
  'missionTruth',
  'privacyTruth',
  'provenanceTruth',
  'logTruth',
  'localPathsRedacted: true',
  'rawCookiesIncluded: false',
  'rawTokensIncluded: false',
  'rawBrowserProfilesIncluded: false',
  'rawMissionFilesIncluded: false',
  'sanitizeEnterpriseSupportBundleText',
  'enterpriseSupportBundleMarkdown',
  'enterpriseSupportBundleSummary'
]);

const module = includesAll('src/main/enterprise-support-bundle.ts', [
  'previewEnterpriseSupportBundle',
  'copyEnterpriseSupportBundle',
  'saveEnterpriseSupportBundle',
  'supportBundleManifest',
  'getEnterpriseAdminPolicyForRenderer',
  'getEnterpriseAdminPolicySummary',
  'releaseTruthForRenderer',
  'listBrowserProfiles',
  'listMissions',
  'cookiesIncluded=false',
  'rawMissionFilesIncluded=false',
  'profileDataPathsIncluded=false',
  'localPathsRedacted',
  'PASS159 source gate present=true',
  'PASS162 validates source, package, installed smoke, policy, security, evidence, signing/provenance, and manual attestations',
  'Saved redacted enterprise support bundle.'
]);

includesAll('src/main/main.ts', [
  'previewEnterpriseSupportBundle',
  'copyEnterpriseSupportBundle',
  'saveEnterpriseSupportBundle',
  'ENTERPRISE_SUPPORT_BUNDLE_PASS',
  'enterpriseSupportBundlePass: ENTERPRISE_SUPPORT_BUNDLE_PASS',
  "assertTrustedIpcChannel('tahai-browser:preview-enterprise-support-bundle')",
  "assertTrustedIpcChannel('tahai-browser:copy-enterprise-support-bundle')",
  "assertTrustedIpcChannel('tahai-browser:save-enterprise-support-bundle')",
  "ipcMain.handle('tahai-browser:preview-enterprise-support-bundle'",
  "ipcMain.handle('tahai-browser:copy-enterprise-support-bundle'",
  "ipcMain.handle('tahai-browser:save-enterprise-support-bundle'",
  'assertTrustedBrowserShellIpc(event)'
]);

includesAll('src/shared/electron-security-contract.ts', [
  'tahai-browser:preview-enterprise-support-bundle',
  'tahai-browser:copy-enterprise-support-bundle',
  'tahai-browser:save-enterprise-support-bundle'
]);

includesAll('src/preload/preload.ts', [
  "import type { EnterpriseSupportBundleResult }",
  'enterpriseSupportBundlePass: string',
  "previewEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:preview-enterprise-support-bundle')",
  "copyEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:copy-enterprise-support-bundle')",
  "saveEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:save-enterprise-support-bundle')"
]);

includesAll('src/renderer/global.d.ts', [
  "import type { EnterpriseSupportBundleResult }",
  'previewEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>',
  'copyEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>',
  'saveEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>'
]);

includesAll('src/renderer/index.html', [
  'Enterprise Support Bundle',
  'PASS160 redacted support bundle',
  'preview-enterprise-support-bundle',
  'copy-enterprise-support-bundle',
  'save-enterprise-support-bundle',
  'No cookies, tokens, raw browser profiles, local paths, or raw mission files.'
]);

includesAll('src/renderer/app.ts', [
  'previewEnterpriseSupportBundleButton',
  'copyEnterpriseSupportBundleButton',
  'saveEnterpriseSupportBundleButton',
  'window.tahaiBrowser.previewEnterpriseSupportBundle()',
  'window.tahaiBrowser.copyEnterpriseSupportBundle()',
  'window.tahaiBrowser.saveEnterpriseSupportBundle()',
  'PASS160 support bundle preview ready.',
  'Copied redacted PASS160 support bundle.',
  'Saved redacted PASS160 support bundle.'
]);

includesAll('docs/enterprise-support-bundle-pass160.md', [
  'PASS160',
  'Enterprise Support Bundle',
  'version truth',
  'enterprise policy truth',
  'install truth',
  'runtime truth',
  'profile counts',
  'mission inventory counts only',
  'signing/provenance/SBOM truth',
  'No generated release artifacts',
  'npm run verify:pass-160-enterprise-support-bundle'
]);

includesAll('PASS_160_ENTERPRISE_SUPPORT_BUNDLE_SUMMARY.md', [
  'PASS160',
  'Enterprise Support Bundle',
  'verify:pass-160-enterprise-support-bundle',
  'PASS160 runs after PASS159',
  'Remaining enterprise GA passes: 2'
]);

need(!/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(preload), 'preload must not expose raw ipcRenderer');
need(!/rawCookiesIncluded:\s*true|rawTokensIncluded:\s*true|rawBrowserProfilesIncluded:\s*true|rawMissionFilesIncluded:\s*true/.test(contract + module), 'PASS160 support bundle must not include raw sensitive material');
need(!/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+|BEGIN PRIVATE KEY|client_secret\s*=\s*[^\s]+|refresh_token\s*=\s*[^\s]+|access_token\s*=\s*[^\s]+/i.test(contract + module + html + renderer), 'PASS160 must not introduce literal secret material');
need(!/fetch\([^)]*psa/i.test(contract + module + main + renderer), 'PASS160 must not add browser-side PSA fetches');
need(!/shell\.openExternal\([^)]*(support|bundle)/i.test(main + module), 'support bundle must not open external URLs');
need(security.indexOf('tahai-browser:preview-enterprise-support-bundle') > security.indexOf('tahai-browser:get-admin-policy'), 'support bundle IPC should sit with trusted enterprise shell APIs');

for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/sbom/tahai-browser-sbom.json',
  'artifacts/provenance/tahai-browser-release-provenance.json',
  'artifacts/support/TAHAI-enterprise-support-bundle.md'
]) need(!exists(generated), `generated output must not be committed: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS160][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS160][OK] Enterprise Support Bundle verified.');
