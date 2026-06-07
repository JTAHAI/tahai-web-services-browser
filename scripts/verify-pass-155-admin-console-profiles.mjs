#!/usr/bin/env node
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
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const contract = read('src/shared/admin-console-profiles-contract.ts');
const app = read('src/renderer/app.ts');
const missionModel = read('src/renderer/mission-model.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS155, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-155-admin-console-profiles'] === 'node scripts/verify-pass-155-admin-console-profiles.mjs', 'package missing PASS155 verifier script');

const pass153Idx = blockers.indexOf('verify:pass-153-webview-popup-attach-hardening');
const pass154Idx = blockers.indexOf('verify:pass-154-enterprise-admin-policy-framework');
const pass155Idx = blockers.indexOf('verify:pass-155-admin-console-profiles');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass153Idx >= 0, 'release blockers missing PASS153');
need(pass154Idx > pass153Idx, 'PASS154 must run after PASS153');
need(pass155Idx > pass154Idx, 'PASS155 must run after PASS154');
need(finalBuildIdx > pass155Idx, 'PASS155 must run before final build');

for (const file of [
  'src/shared/admin-console-profiles-contract.ts',
  'scripts/verify-pass-155-admin-console-profiles.mjs',
  'docs/admin-console-profiles-pass155.md',
  'PASS_155_ADMIN_CONSOLE_PROFILES_SUMMARY.md'
]) need(exists(file), `missing PASS155 file: ${file}`);

includesAll('src/shared/admin-console-profiles-contract.ts', [
  'ADMIN_CONSOLE_PROFILES_PASS',
  'PASS155',
  'ADMIN_CONSOLE_PROFILES_SCHEMA_VERSION = 1',
  'ADMIN_CONSOLE_PROFILES_CONTRACT_ID',
  'admin-console-profiles-v1',
  'AdminConsoleProfileId',
  'AdminConsoleProvider',
  'AdminConsoleProfileCategory',
  'AdminConsoleEvidenceProfile',
  'storesSecrets: false',
  'directPsaApiAllowed: false',
  'microsoft365-entra-azure',
  'aws-console-operations',
  'google-workspace-gcp',
  'cloudflare-operations',
  'github-actions-release',
  'vercel-firebase-pages',
  'firewall-vpn-vendor',
  'registrar-dns',
  'itdocs-runbooks-evidence',
  'psa-ticket-reference',
  'adminConsoleProfileToLaunchRecipe',
  'adminConsoleProfilesSummary'
]);

includesAll('src/renderer/app.ts', [
  'admin-console-profiles-contract',
  'ADMIN_CONSOLE_PROFILES',
  'adminConsoleProfileToLaunchRecipe',
  'adminConsoleProfilesSummary',
  'const adminConsoleLaunchRecipes',
  '...adminConsoleLaunchRecipes',
  'adminConsoleProfileId',
  'evidenceProfile',
  'policyTags',
  'pass155AdminConsoleProfiles',
  'pass155AdminConsoleProfilesSummary'
]);

includesAll('docs/admin-console-profiles-pass155.md', [
  'PASS155',
  'Admin Console Profiles v1',
  'Microsoft 365 / Entra / Azure',
  'AWS',
  'Google Workspace / GCP',
  'Cloudflare',
  'GitHub Actions',
  'Vercel / Firebase / Cloudflare Pages',
  'Firewall / VPN',
  'Registrar / DNS',
  'IT Docs',
  'PSA',
  'No direct PSA API calls',
  'No generated release artifacts'
]);

includesAll('PASS_155_ADMIN_CONSOLE_PROFILES_SUMMARY.md', [
  'PASS155',
  'Admin Console Profiles v1',
  'verify:pass-155-admin-console-profiles',
  'PASS155 runs after PASS154',
  'remaining enterprise GA passes: 7'
]);

const profileIds = ['microsoft365-entra-azure','aws-console-operations','google-workspace-gcp','cloudflare-operations','github-actions-release','vercel-firebase-pages','firewall-vpn-vendor','registrar-dns','itdocs-runbooks-evidence','psa-ticket-reference'];
for (const id of profileIds) {
  const matches = contract.match(new RegExp(`id:\\s*'${id}'`, 'g')) || [];
  need(matches.length === 1, `profile id must appear exactly once in catalog: ${id}`);
  need(app.includes(`admin-profile-${id}`) || app.includes('adminConsoleProfileToLaunchRecipe'), `renderer must route profile ${id} through recipe mapping`);
}

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'Authorization: Bearer', 'BEGIN PRIVATE KEY']) {
  need(!contract.toLowerCase().includes(unsafe.toLowerCase()), `admin console profile contract must not contain secret literal: ${unsafe}`);
}

need(!/fetch\([^)]*psa/i.test(app + contract), 'PASS155 must not add browser-side PSA fetches');
need(!/shell\.openExternal\([^)]*(?:psa|ticket|profile)/i.test(app + contract), 'PASS155 must not add unsafe direct shell.openExternal for profile/ticket URLs');
need(missionModel.includes('recipeProviderLabel'), 'mission model provider labels must remain available');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js',
]) need(!exists(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS155][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS155][OK] Admin Console Profiles v1 verified.');
