#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const required = [
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-165-responsive-mission-recipe-hardening.md',
  'PASS_165_RESPONSIVE_MISSION_RECIPE_HARDENING_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/app.ts');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const siteRailTs = read('src/renderer/site-view-mission-rail.ts');
  const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
  const pass112Verifier = read('scripts/verify-pass-112-tabs-titlebar-chrome.mjs');
  const pass113Verifier = read('scripts/verify-pass-113-adaptive-chrome-density.mjs');
  const pass141Verifier = read('scripts/verify-pass-141-version-about-update-channel-truth.mjs');
  const pass144Verifier = read('scripts/verify-pass-144-public-repo-supply-chain.mjs');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-165-responsive-mission-recipe-hardening.md');
  const summary = read('PASS_165_RESPONSIVE_MISSION_RECIPE_HARDENING_SUMMARY.md');
  const validators = read('src/shared/mission-validators.ts');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);
  const actionIds = ['about', 'settings', 'onboarding', 'launchpad', 'ops-hub-toggle', 'site-view-rail-toggle', 'chromium-bookmark-star', 'chromium-bookmarks-button', 'profile-switcher'];

  need(pkg.version === '1.8.30', 'PASS165 must not increment version without explicit approval');
  need(pkg.scripts?.['verify:pass-165-responsive-mission-recipe-hardening'] === 'node scripts/verify-pass-165-responsive-mission-recipe-hardening.mjs', 'package script missing PASS165 verifier');
  need(releaseBlockers.includes('verify:pass-165-responsive-mission-recipe-hardening'), 'verify:release-blockers missing PASS165 verifier');
  need(releaseBlockers.indexOf('verify:pass-165-responsive-mission-recipe-hardening') > releaseBlockers.indexOf('verify:pass-164-mission-control-open-race'), 'PASS165 verifier must run after PASS164');
  need(releaseBlockers.indexOf('verify:pass-165-responsive-mission-recipe-hardening') < releaseBlockers.lastIndexOf('npm run build'), 'PASS165 verifier must run before final build');
  need(html.includes('data-pass165-responsive-mission-recipe-hardening="true"'), 'renderer body missing PASS165 marker');

  for (const id of actionIds) {
    need(responsiveTs.includes(`'${id}'`), `responsive known-action set missing ${id}`);
    need(app.includes(`'${id}'`), `app More Tools action contract missing ${id}`);
  }
  for (const token of [
    'PASS165_MORE_TOOLS_KNOWN_ACTION_IDS',
    'known-native-fallback-settle',
    'const closeDelay = (!unhandled || knownPass165Action) ? PASS164_MORE_TOOLS_ACTION_SETTLE_MS : PASS163_MORE_TOOLS_ACTION_CLOSE_DELAY_MS',
    "document.body.dataset.pass165MoreToolsKnownActionSettle = 'true'"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS165 settle token: ${token}`);

  for (const token of [
    'const PASS165_MORE_TOOLS_ACTION_IDS',
    'const PASS165_MORE_TOOLS_SHELL_ACTION_IDS',
    'function pass165IsKnownMoreToolsActionId',
    'document.body.dataset.pass165MoreToolsActionObserved = actionId',
    'document.body.dataset.pass165MoreToolsExternalBridgePending = actionId',
    "document.body.dataset.pass165MoreToolsExternalBridgePending = 'none'"
  ]) need(app.includes(token), `app missing PASS165 More Tools action contract token: ${token}`);

  need(siteRailTs.includes('installPass164MoreToolsActionBridge') && siteRailTs.includes("actionId !== 'site-view-rail-toggle'"), 'site view bridge must remain wired to More Tools action broker');
  need(bookmarksTs.includes('installPass164MoreToolsActionBridge') && bookmarksTs.includes("actionId === 'chromium-bookmark-star'") && bookmarksTs.includes("actionId === 'chromium-bookmarks-button'"), 'bookmarks bridge must remain wired to More Tools action broker');

  for (const token of [
    'PASS165_MISSION_RECIPE_TYPE_AFFINITY',
    'function missionRecipeMatchesSelectedType',
    "selectedType === 'audit'",
    "selectedType === 'security-review'",
    'document.body.dataset.pass165MissionRecipeExactCount',
    'document.body.dataset.pass165MissionRecipeFallback',
    'data-pass165-recipe-fallback',
    'document.body.dataset.pass165MissionRecipeTypeChangeHandled = selectedType'
  ]) need(app.includes(token), `app missing PASS165 mission recipe refactor token: ${token}`);

  need(validators.includes('function sanitizeMissionEvidenceMetadata') && validators.includes('metadata[safeKey] = cleanEvidenceText(value, 300)'), 'mission validators missing PASS91 metadata re-sanitization repair');
  need(app.includes('sanitizeTabMetadataRecord') && app.includes('metadata: sanitizeTabMetadataRecord(input.metadata)'), 'app missing PASS104 mission evidence metadata boundary repair');
  need(pass112Verifier.includes('/<nav\\s+[^>]*id=\"tabs\"') && !pass112Verifier.includes('<nav id=\"tabs\" class=\"tabs\" aria-label=\"Browser tabs\"></nav>'), 'PASS112 verifier missing instrumented nav compatibility repair');
  need(pass113Verifier.includes('/<nav\\s+[^>]*id=\"tabs\"') && !pass113Verifier.includes('<nav id=\"tabs\" class=\"tabs\" aria-label=\"Browser tabs\"></nav>'), 'PASS113 verifier missing instrumented nav compatibility repair');
  need(pass141Verifier.includes('rendererTruth') && pass141Verifier.includes('src/renderer/renderer-shell-lifecycle.ts'), 'PASS141 verifier missing PASS161 renderer lifecycle fallback compatibility repair');
  need(pass144Verifier.includes("'scripts/verify-pass-162-enterprise-ga-decision-gate.mjs'"), 'PASS144 verifier missing PASS162 guard-literal allowlist repair');
  need(pass144Verifier.includes("'src/shared/enterprise-support-bundle-contract.ts'"), 'PASS144 verifier missing enterprise support bundle redaction-literal allowlist repair');
  need(responsiveCss.includes('PASS165: known cross-module More Tools actions') && responsiveCss.includes('data-pass165-recipe-fallback="affinity"'), 'responsive CSS missing PASS165 visual fallback markers');
  need(!app.includes('psa:direct-fetch'), 'PASS165 must not add direct PSA API behavior');
  need(!app.includes('ipcRenderer.send('), 'PASS165 must not add raw IPC sends to renderer app');
  need(!responsiveTs.includes('ipcRenderer'), 'PASS165 responsive toolbar must not import/use raw IPC');
  need(doc.includes('PASS165') && doc.includes('More Tools') && doc.includes('Mission Recipes') && doc.includes('Audit') && doc.includes('Security Review'), 'PASS165 doc missing scope');
  need(summary.includes('PASS165') && summary.includes('Version remains `1.8.30`') && summary.includes('Remaining enterprise GA passes: 0'), 'PASS165 summary missing required markers');
}
if (failures.length) {
  console.error('PASS165 Responsive Mission Recipe Hardening verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS165][OK] More Tools known-action settle and Mission Type recipe affinity hardening verified.');
