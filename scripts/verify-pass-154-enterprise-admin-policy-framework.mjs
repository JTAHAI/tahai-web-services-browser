#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const isGitTracked = (p) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const contract = read('src/shared/enterprise-admin-policy-contract.ts');
const loader = read('src/main/enterprise-admin-policy.ts');
const settings = read('src/main/settings.ts');
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');

need(/^\d+\.\d+\.\d+$/.test(String(pkg.version || '')), `package.json version must be semver-like for PASS154, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-154-enterprise-admin-policy-framework'] === 'node scripts/verify-pass-154-enterprise-admin-policy-framework.mjs', 'package missing PASS154 verifier script');

const pass152Idx = blockers.indexOf('verify:pass-152-enterprise-evidence-binder');
const pass153Idx = blockers.indexOf('verify:pass-153-webview-popup-attach-hardening');
const pass154Idx = blockers.indexOf('verify:pass-154-enterprise-admin-policy-framework');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass152Idx >= 0, 'release blockers missing PASS152');
need(pass153Idx > pass152Idx, 'PASS153 must run after PASS152');
need(pass154Idx > pass153Idx, 'PASS154 must run after PASS153');
need(finalBuildIdx > pass154Idx, 'PASS154 must run before final build');

for (const file of [
  'src/shared/enterprise-admin-policy-contract.ts',
  'src/main/enterprise-admin-policy.ts',
  'scripts/verify-pass-154-enterprise-admin-policy-framework.mjs',
  'docs/enterprise-admin-policy-framework-pass154.md',
  'PASS_154_ENTERPRISE_ADMIN_POLICY_FRAMEWORK_SUMMARY.md'
]) need(exists(file), `missing PASS154 file: ${file}`);

includesAll('src/shared/enterprise-admin-policy-contract.ts', [
  'ENTERPRISE_ADMIN_POLICY_PASS',
  'PASS154',
  'ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION = 1',
  'ENTERPRISE_ADMIN_POLICY_CONTRACT_ID',
  'enterprise-admin-policy-framework-v1',
  'MAX_ENTERPRISE_ADMIN_POLICY_BYTES',
  'ENTERPRISE_ADMIN_POLICY_MANAGED_PATHS',
  'TAHAI_BROWSER_MANAGED_POLICY_FILE',
  'windows',
  'linux',
  'macos',
  'lockedSettings',
  'disabledTools',
  'allowedProtocols',
  'blockedProtocols',
  'allowedDomains',
  'blockedDomains',
  'missionExport',
  'evidenceExport',
  'supportBundle',
  'allowSilentAutoUpdate: false',
  'sanitizeEnterpriseAdminPolicy',
  'applyEnterpriseAdminPolicyToSettings',
  'enterpriseAdminPolicyForRenderer',
  'shouldRejectEnterpriseAdminPolicyFile',
  'enterpriseAdminPolicySummary'
]);

includesAll('src/main/enterprise-admin-policy.ts', [
  'candidatePolicyFiles',
  'environment-file',
  'windows-programdata',
  'linux-etc',
  'macos-library',
  'app-bundled-default',
  'readEnterpriseAdminPolicy',
  'refreshEnterpriseAdminPolicy',
  'getEnterpriseAdminPolicyForRenderer',
  'getEnterpriseAdminPolicySummary',
  'shouldRejectEnterpriseAdminPolicyFile',
  'sanitizeEnterpriseAdminPolicy',
  'safeSourceLabel'
]);

includesAll('src/main/settings.ts', [
  'applyEnterpriseAdminPolicyToSettings',
  'readEnterpriseAdminPolicy',
  'applyManagedSettingsPolicy',
  'policy.lockedSettings.downloads?.defaultDirectory',
  'return applyManagedSettingsPolicy(sanitizeSettings(JSON.parse'
]);

includesAll('src/main/main.ts', [
  'getEnterpriseAdminPolicyForRenderer',
  'getEnterpriseAdminPolicySummary',
  "assertTrustedIpcChannel('tahai-browser:get-admin-policy')",
  "ipcMain.handle('tahai-browser:get-admin-policy'",
  'adminPolicy: getEnterpriseAdminPolicyForRenderer()',
  'adminPolicySummary: getEnterpriseAdminPolicySummary()'
]);

includesAll('src/preload/preload.ts', [
  "import type { EnterpriseAdminPolicyState }",
  'adminPolicy: EnterpriseAdminPolicyState',
  'adminPolicySummary: string',
  "getAdminPolicy: (): Promise<EnterpriseAdminPolicyState> => ipcRenderer.invoke('tahai-browser:get-admin-policy')"
]);

need(!/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(preload), 'preload must not expose raw ipcRenderer');
need(!/shell\.openExternal\([^)]*(?:policy|sourceLabel|file)/i.test(`${main}\n${loader}`), 'policy loader must not use shell.openExternal on policy paths');
need(!/allowSilentAutoUpdate\s*:\s*true/i.test(contract), 'enterprise policy must not allow silent auto-update');
need(!/client_secret|refresh_token|access_token|api_key|Authorization:\s*Bearer/i.test(contract.replace('refresh[_-]?token|access[_-]?token|client[_-]?secret|api[_-]?key', '')), 'policy contract must not carry literal secrets');

includesAll('docs/enterprise-admin-policy-framework-pass154.md', [
  'PASS154',
  'Enterprise Admin Policy Framework',
  'managed-policy.json',
  'TAHAI_BROWSER_MANAGED_POLICY_FILE',
  'Windows',
  'Linux',
  'macOS',
  'locked settings',
  'disabled tools',
  'allowed protocols',
  'allowed domains',
  'silent auto-update remains disabled',
  'No generated release artifacts'
]);

includesAll('PASS_154_ENTERPRISE_ADMIN_POLICY_FRAMEWORK_SUMMARY.md', [
  'PASS154',
  'Enterprise Admin Policy Framework',
  'verify:pass-154-enterprise-admin-policy-framework',
  'PASS154 runs after PASS153',
  'remaining enterprise GA passes: 8'
]);

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js',
]) need(!isGitTracked(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS154][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS154][OK] Enterprise admin policy framework verified.');
