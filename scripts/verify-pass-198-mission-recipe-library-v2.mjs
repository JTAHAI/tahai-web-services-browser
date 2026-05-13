#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/mission-recipe-library-v2-contract.ts');
const v1 = read('src/shared/mission-recipes-contract.ts');
const app = read('src/renderer/app.ts');
const doc = read('docs/pass-198-mission-recipe-library-v2.md');
const summary = read('PASS_198_MISSION_RECIPE_LIBRARY_V2_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS198 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-198-mission-recipe-library-v2'] === 'node scripts/verify-pass-198-mission-recipe-library-v2.mjs', 'package.json exposes PASS198 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-198-mission-recipe-library-v2'), 'release-blockers chain includes PASS198 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-198-mission-recipe-library-v2') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-197-mission-layout-determinism'), 'PASS198 must run after PASS197.');

for (const file of [
  'src/shared/mission-recipe-library-v2-contract.ts',
  'scripts/verify-pass-198-mission-recipe-library-v2.mjs',
  'docs/pass-198-mission-recipe-library-v2.md',
  'PASS_198_MISSION_RECIPE_LIBRARY_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS198 file: ${file}`);

for (const token of [
  'PASS198_MISSION_RECIPE_LIBRARY_V2_PASS',
  'PASS198_MISSION_RECIPE_LIBRARY_V2_VERSION',
  'pass198-mission-recipe-library-v2',
  'MISSION_RECIPE_LIBRARY_V2_SCHEMA_VERSION = 2',
  'MISSION_RECIPE_LIBRARY_V2_REQUIRED_COUNT = 10',
  'MissionRecipeV2RiskTier',
  'MissionRecipeV2GateKind',
  'MissionRecipeV2Template',
  'MISSION_RECIPE_LIBRARY_V2',
  'missionRecipeLibraryV2Ids',
  'getMissionRecipeLibraryV2Entry',
  'missionRecipeLibraryV2ForRecipe',
  'missionRecipeLibraryV2Coverage',
  'missionRecipeLibraryV2Summary',
  'requiresHumanApproval: true',
  'localOnly: true',
  'storesSecrets: false',
  'directPsaApiAllowed: false',
  'preflightGates',
  'paneIntents',
  'evidenceChecklist',
  'recoveryActions',
  'handoffSections',
  'exportProfiles',
  'policyLocks',
  'release-critical',
  'sensitive-admin',
  'incident-response',
  'standard-change'
]) ok(contract.includes(token), `PASS198 contract missing token: ${token}`);

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
  ok(v1.includes(`id: '${id}'`), `v1 recipe library missing canonical id: ${id}`);
  const matches = contract.match(new RegExp(`id:\\s*'${id}'`, 'g')) || [];
  ok(matches.length === 1, `v2 recipe id must appear exactly once: ${id}`);
}

ok((contract.match(/preflightGates:/g) || []).length >= recipeIds.length, 'every v2 recipe must define preflight gates.');
ok((contract.match(/paneIntents:/g) || []).length >= recipeIds.length, 'every v2 recipe must define pane intents.');
ok((contract.match(/evidenceChecklist:/g) || []).length >= recipeIds.length, 'every v2 recipe must define evidence checklist.');
ok((contract.match(/recoveryActions:/g) || []).length >= recipeIds.length, 'every v2 recipe must define recovery actions.');
ok((contract.match(/handoffSections:/g) || []).length >= recipeIds.length, 'every v2 recipe must define handoff sections.');
ok((contract.match(/policyLocks:/g) || []).length >= recipeIds.length, 'every v2 recipe must define policy locks.');
ok((contract.match(/stopIfMissing: true/g) || []).length >= 8, 'v2 recipes must include stop-if-missing preflight gates.');

for (const token of [
  "from '../shared/mission-recipe-library-v2-contract'",
  'MISSION_RECIPE_LIBRARY_V2',
  'MISSION_RECIPE_LIBRARY_V2_REQUIRED_COUNT',
  'missionRecipeLibraryV2ForRecipe',
  'missionRecipeLibraryV2Summary',
  'pass198RecipeV2Title',
  'pass198RecipeV2Detail',
  'pass198RecipeV2Attributes',
  'data-pass198-recipe-v2',
  'data-pass198-risk-tier',
  'data-pass198-preflight-gates',
  'data-pass198-evidence-items',
  'data-pass198-policy-locks',
  'document.body.dataset.pass198MissionRecipeLibraryV2',
  'document.body.dataset.pass198MissionRecipeLibraryV2Required',
  'document.body.dataset.pass198MissionRecipeLibraryV2Summary'
]) ok(app.includes(token), `PASS198 renderer missing token: ${token}`);

for (const token of [
  'PASS198',
  'Mission Recipe Library v2',
  'operator intent',
  'risk tier',
  'human approval requirement',
  'preflight gates',
  'pane intent',
  'evidence checklist',
  'recovery actions',
  'handoff sections',
  'policy locks',
  'No direct PSA API calls',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS198 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS198: 27'), 'PASS198 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS198 docs must not contain TODO markers.');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY', 'Set-Cookie:']) {
  ok(!contract.toLowerCase().includes(unsafe.toLowerCase()), `PASS198 contract must not contain secret literal: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS198 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:recipe|mission|ticket|psa)/i.test(app + contract), 'PASS198 must not add unsafe direct shell.openExternal for recipes.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS198][FAIL] Mission Recipe Library v2 verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS198][OK] Mission Recipe Library v2 verified.');
