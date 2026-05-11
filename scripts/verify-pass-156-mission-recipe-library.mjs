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
const contract = read('src/shared/mission-recipes-contract.ts');
const app = read('src/renderer/app.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS156, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-156-mission-recipe-library'] === 'node scripts/verify-pass-156-mission-recipe-library.mjs', 'package missing PASS156 verifier script');

const pass154Idx = blockers.indexOf('verify:pass-154-enterprise-admin-policy-framework');
const pass155Idx = blockers.indexOf('verify:pass-155-admin-console-profiles');
const pass156Idx = blockers.indexOf('verify:pass-156-mission-recipe-library');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass154Idx >= 0, 'release blockers missing PASS154');
need(pass155Idx > pass154Idx, 'PASS155 must run after PASS154');
need(pass156Idx > pass155Idx, 'PASS156 must run after PASS155');
need(finalBuildIdx > pass156Idx, 'PASS156 must run before final build');

for (const file of [
  'src/shared/mission-recipes-contract.ts',
  'scripts/verify-pass-156-mission-recipe-library.mjs',
  'docs/mission-recipe-library-pass156.md',
  'PASS_156_MISSION_RECIPE_LIBRARY_SUMMARY.md'
]) need(exists(file), `missing PASS156 file: ${file}`);

includesAll('src/shared/mission-recipes-contract.ts', [
  'MISSION_RECIPE_LIBRARY_PASS',
  'PASS156',
  'MISSION_RECIPE_LIBRARY_CONTRACT_ID',
  'mission-recipe-library-v1',
  'MISSION_RECIPE_LIBRARY_SCHEMA_VERSION = 1',
  'MISSION_RECIPE_LIBRARY_REQUIRED_COUNT = 10',
  'MissionRecipeLibraryId',
  'MissionRecipeLibraryEntry',
  'MissionRecipeLibraryLaunchRecipe',
  'Mission Recipe Library',
  'library-dns-migration',
  'library-m365-user-offboarding',
  'library-firewall-change',
  'library-production-deployment',
  'library-certificate-renewal',
  'library-incident-triage',
  'library-github-actions-release',
  'library-cloudflare-cutover',
  'library-new-workstation-admin-setup',
  'library-vendor-support-handoff',
  'missionRecipeLibraryToLaunchRecipe',
  'missionRecipeLibrarySummary',
  'storesSecrets: false',
  'directPsaApiAllowed: false',
  'requiresServerConnector: false'
]);

includesAll('src/renderer/app.ts', [
  'mission-recipes-contract',
  'MISSION_RECIPE_LIBRARY',
  'missionRecipeLibrarySummary',
  'missionRecipeLibraryToLaunchRecipe',
  'const missionRecipeLibraryLaunchRecipes',
  '...missionRecipeLibraryLaunchRecipes',
  'missionRecipeLibraryId',
  'pass156MissionRecipeLibrary',
  'pass156MissionRecipeLibrarySummary'
]);

includesAll('docs/mission-recipe-library-pass156.md', [
  'PASS156',
  'Mission Recipe Library v1',
  'DNS Migration',
  'Microsoft 365 User Offboarding',
  'Firewall Change',
  'Production Deployment',
  'Certificate Renewal',
  'Incident Triage',
  'GitHub Actions Release',
  'Cloudflare Cutover',
  'New Workstation / Admin Setup',
  'Vendor Support Handoff',
  'No direct PSA API calls',
  'No generated release artifacts'
]);

includesAll('PASS_156_MISSION_RECIPE_LIBRARY_SUMMARY.md', [
  'PASS156',
  'Mission Recipe Library v1',
  'verify:pass-156-mission-recipe-library',
  'PASS156 runs after PASS155',
  'Remaining enterprise GA passes: 6'
]);

const recipeIds = [
  'library-dns-migration',
  'library-m365-user-offboarding',
  'library-firewall-change',
  'library-production-deployment',
  'library-certificate-renewal',
  'library-incident-triage',
  'library-github-actions-release',
  'library-cloudflare-cutover',
  'library-new-workstation-admin-setup',
  'library-vendor-support-handoff'
];

for (const id of recipeIds) {
  const matches = contract.match(new RegExp(`id:\\s*'${id}'`, 'g')) || [];
  need(matches.length === 1, `recipe id must appear exactly once in catalog: ${id}`);
}

const urlMatches = [...contract.matchAll(/urls:\s*\[([^\]]+)\]/g)];
need(urlMatches.length >= recipeIds.length, 'expected launch URLs for each recipe');
for (const match of urlMatches) {
  const urls = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  need(urls.length > 0 && urls.length <= 4, `recipe URL count must be 1..4, found ${urls.length}`);
  for (const url of urls) need(/^https:\/\//.test(url), `recipe URL must be HTTPS-only: ${url}`);
}

const stopConditionMatches = contract.match(/missionStopCondition:/g) || [];
const runbookMatches = contract.match(/missionRunbookSteps:/g) || [];
const evidenceMatches = contract.match(/missionEvidencePrompts:/g) || [];
need(stopConditionMatches.length >= recipeIds.length, 'every recipe must define a stop condition');
need(runbookMatches.length >= recipeIds.length, 'every recipe must define runbook steps');
need(evidenceMatches.length >= recipeIds.length, 'every recipe must define evidence prompts');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'Authorization: Bearer', 'BEGIN PRIVATE KEY', 'Cookie:', 'Set-Cookie:']) {
  need(!contract.toLowerCase().includes(unsafe.toLowerCase()), `mission recipe library must not contain secret literal: ${unsafe}`);
}

need(!/fetch\([^)]*psa/i.test(app + contract), 'PASS156 must not add browser-side PSA fetches');
need(!/shell\.openExternal\([^)]*(?:recipe|mission|ticket|psa)/i.test(app + contract), 'PASS156 must not add unsafe direct shell.openExternal for mission recipes');
need(!/comingSoon:\s*true/.test(contract), 'Mission Recipe Library v1 entries should be usable local-only recipes, not disabled placeholders');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js',
]) need(!exists(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS156][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS156][OK] Mission Recipe Library v1 verified.');
