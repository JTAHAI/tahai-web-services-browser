#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/admin-console-profiles-v2-contract.ts');
const v1 = read('src/shared/admin-console-profiles-contract.ts');
const app = read('src/renderer/app.ts');
const doc = read('docs/pass-199-admin-console-profiles-v2.md');
const summary = read('PASS_199_ADMIN_CONSOLE_PROFILES_V2_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS199 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-199-admin-console-profiles-v2'] === 'node scripts/verify-pass-199-admin-console-profiles-v2.mjs', 'package.json exposes PASS199 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-199-admin-console-profiles-v2'), 'release-blockers chain includes PASS199 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-199-admin-console-profiles-v2') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-198-mission-recipe-library-v2'), 'PASS199 must run after PASS198.');

for (const file of [
  'src/shared/admin-console-profiles-v2-contract.ts',
  'scripts/verify-pass-199-admin-console-profiles-v2.mjs',
  'docs/pass-199-admin-console-profiles-v2.md',
  'PASS_199_ADMIN_CONSOLE_PROFILES_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS199 file: ${file}`);

for (const token of [
  'PASS199_ADMIN_CONSOLE_PROFILES_V2_PASS',
  'ADMIN_CONSOLE_PROFILES_V2_CONTRACT_ID',
  'admin-console-profiles-v2',
  'ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION = 2',
  'ADMIN_CONSOLE_PROFILES_V2_REQUIRED_COUNT = 10',
  'AdminConsoleProfileV2ProviderIntentKind',
  'AdminConsoleProfileV2PaneDefault',
  'AdminConsoleProfileV2Guardrails',
  'AdminConsoleProfileV2Diagnostics',
  'AdminConsoleProfileV2LaunchRecipe',
  'ADMIN_CONSOLE_PROFILES_V2',
  'getAdminConsoleProfileV2',
  'adminConsoleProfileV2ForRecipe',
  'adminConsoleProfileV2ToLaunchRecipe',
  'adminConsoleProfilesV2Coverage',
  'adminConsoleProfilesV2DiagnosticsSummary',
  'adminConsoleProfilesV2Summary',
  'providerIntent',
  'missionLayoutDefault',
  'paneDefaults',
  'policyTagCount',
  'safeUrlCount',
  'localOnly: true',
  'browserSideOnly: true',
  'httpsOnly: true',
  'noCredentialStorage: true',
  'noTokenFields: true',
  'noCookieCapture: true',
  'directPsaApiAllowed: false',
  'directProviderApiAllowed: false',
  'requiresExplicitOperatorLaunch: true'
]) ok(contract.includes(token), `PASS199 contract missing token: ${token}`);

const profileIds = [
  'microsoft365-entra-azure',
  'aws-console-operations',
  'google-workspace-gcp',
  'cloudflare-operations',
  'github-actions-release',
  'vercel-firebase-pages',
  'firewall-vpn-vendor',
  'registrar-dns',
  'itdocs-runbooks-evidence',
  'psa-ticket-reference'
];

for (const id of profileIds) {
  ok(v1.includes(`id: '${id}'`), `v1 Admin Console Profile missing canonical id: ${id}`);
  ok(contract.includes(`'${id}'`), `v2 provider intent map missing id: ${id}`);
  ok(app.includes('admin-profile-' + id) || app.includes('adminConsoleProfileV2ToLaunchRecipe'), `renderer must route profile ${id} through v2 launch mapping`);
}

for (const token of [
  'identity-tenant-admin',
  'cloud-operations',
  'devops-release',
  'dns-network-change',
  'vendor-admin-portal',
  'documentation-evidence',
  'ticket-reference-only'
]) ok(contract.includes(token), `PASS199 missing provider intent kind: ${token}`);

for (const token of [
  "from '../shared/admin-console-profiles-v2-contract'",
  'ADMIN_CONSOLE_PROFILES_V2',
  'ADMIN_CONSOLE_PROFILES_V2_REQUIRED_COUNT',
  'adminConsoleProfileV2ForRecipe',
  'adminConsoleProfileV2ToLaunchRecipe',
  'adminConsoleProfilesV2DiagnosticsSummary',
  'adminConsoleProfilesV2Summary',
  'pass199AdminProfileV2Title',
  'pass199AdminProfileV2Detail',
  'pass199AdminProfileV2Attributes',
  'data-pass199-admin-profile-v2',
  'data-pass199-provider-intent',
  'data-pass199-policy-tags',
  'data-pass199-pane-defaults',
  'data-pass199-diagnostic-id',
  'data-pass199-local-only',
  'data-pass199-browser-side-only',
  'data-pass199-direct-psa-api-allowed',
  'document.body.dataset.pass199AdminConsoleProfilesV2',
  'document.body.dataset.pass199AdminConsoleProfilesV2Required',
  'document.body.dataset.pass199AdminConsoleProfilesV2Summary',
  'document.body.dataset.pass199AdminConsoleProfilesV2Diagnostics',
  'Admin Console Profile',
  'Admin Console Mission Profile'
]) ok(app.includes(token), `PASS199 renderer missing token: ${token}`);

for (const token of [
  'PASS199',
  'Admin Console Profiles v2',
  'provider intent',
  'policy tags',
  'mission layout defaults',
  'pane defaults',
  'local-only guardrails',
  'operator-ready profile diagnostics',
  'No direct PSA API calls',
  'No provider secrets',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS199 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS199: 26'), 'PASS199 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS199 docs must not contain TODO markers.');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY', 'Set-Cookie:', 'Authorization: Bearer']) {
  ok(!contract.toLowerCase().includes(unsafe.toLowerCase()), `PASS199 contract must not contain secret literal: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS199 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:profile|ticket|psa|provider)/i.test(app + contract), 'PASS199 must not add unsafe direct shell.openExternal for profiles.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS199][FAIL] Admin Console Profiles v2 verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS199][OK] Admin Console Profiles v2 verified.');
