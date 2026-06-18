#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const includesAny = (text, tokens) => tokens.some((token) => text.includes(token));
const required = [
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'scripts/verify-pass-164-mission-control-open-race.mjs',
  'docs/pass-164-mission-control-open-race.md',
  'PASS_164_MISSION_CONTROL_OPEN_RACE_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/app.ts');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const siteRailTs = read('src/renderer/site-view-mission-rail.ts');
  const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-164-mission-control-open-race.md');
  const summary = read('PASS_164_MISSION_CONTROL_OPEN_RACE_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);

  need(/^\d+\.\d+\.\d+$/.test(String(pkg.version || '')), 'PASS164 package version must stay semver-like');
  need(pkg.scripts?.['verify:pass-164-mission-control-open-race'] === 'node scripts/verify-pass-164-mission-control-open-race.mjs', 'package script missing PASS164 verifier');
  need(releaseBlockers.includes('verify:pass-164-mission-control-open-race'), 'verify:release-blockers missing PASS164 verifier');
  need(releaseBlockers.indexOf('verify:pass-164-mission-control-open-race') > releaseBlockers.indexOf('verify:pass-163-more-tools-mission-reflow'), 'PASS164 verifier must run after PASS163');
  need(releaseBlockers.indexOf('verify:pass-164-mission-control-open-race') < releaseBlockers.lastIndexOf('npm run build'), 'PASS164 verifier must run before final build');
  need(html.includes('data-pass164-mission-control-open-race="true"'), 'renderer body missing PASS164 mission marker');
  need(html.includes('data-pass164-responsive-overlay-action-reliability="true"'), 'renderer body missing PASS164 responsive action marker');

  for (const token of [
    'let pass164MissionControlOpenRun = 0',
    'function pass164BeginMissionControlOpen',
    "document.body.dataset.pass164MissionControlOpenState = 'opening'",
    'function pass164FinishMissionControlOpen',
    'function pass164CancelMissionControlOpen',
    'function pass164MissionControlIsOpening',
    "missionDialog.open || pass164MissionControlIsOpening()",
    "active === 'mission-control' && pass164MissionControlIsOpening()",
    "document.body.dataset.pass122LastReflowAction = 'deferred-mission-open-pending'",
    'const openRun = pass164BeginMissionControlOpen()',
    'if (openRun !== pass164MissionControlOpenRun) return',
    "pass164FinishMissionControlOpen(openRun, 'open')",
    'pass122ScheduleOverlayViewportReflow(\'viewport-reflow\')',
    'pass123ScheduleOverlayCycleAudit(\'mission-control-open\')',
    'pass164CancelMissionControlOpen(\'close\')'
  ]) need(app.includes(token), `app missing PASS164 race guard token: ${token}`);
  need(app.includes("pass190CloseRivalOverlays('mission-control')"), 'app missing PASS164 mission-control overlay closeout arbitration');
  need(includesAny(app, [
    "pass190OpenOwnedOverlay('mission-control', missionDialog as unknown as HTMLElement, missionControlButton)",
    "pass190OpenOwnedOverlay('mission-control', missionDialog, missionControlButton)",
  ]), 'app missing PASS164 owned overlay handoff for Mission Control');

  need(app.includes('if (!settingsDialog.open) settingsDialog.showModal();'), 'Settings dialog must be guarded against duplicate showModal calls');

  for (const token of [
    "const PASS164_MORE_TOOLS_ACTION_EVENT = 'tahai:more-tools-action-request'",
    'type Pass164MoreToolsActionId',
    'function pass164HandleMoreToolsActionRequest',
    'document.addEventListener(PASS164_MORE_TOOLS_ACTION_EVENT, pass164HandleMoreToolsActionRequest)',
    "document.body.dataset.pass164MoreToolsActionHandled = actionId",
    "if (actionId === 'settings') openSettings();",
    "if (actionId === 'ops-hub-toggle') toggleOpsHub(true, false);"
  ]) need(app.includes(token), `app missing PASS164 More Tools first-click action token: ${token}`);

  for (const token of [
    "const PASS164_MORE_TOOLS_ACTION_EVENT = 'tahai:more-tools-action-request'",
    'const PASS164_MORE_TOOLS_ACTION_SETTLE_MS = 180',
    'let pass164MoreToolsActionInFlight = false',
    'function pass164MoreToolsActionId',
    'document.body.dataset.pass164MoreToolsFirstClickAction = actionId',
    'const request = new CustomEvent(PASS164_MORE_TOOLS_ACTION_EVENT',
    "document.body.dataset.pass164MoreToolsFirstClickDispatch = 'handled'",
    "document.body.dataset.pass164MoreToolsFirstClickBroker = 'true'"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS164 first-click broker token: ${token}`);

  need(siteRailTs.includes('function installPass164MoreToolsActionBridge') && siteRailTs.includes("event.detail?.actionId !== 'site-view-rail-toggle'"), 'Site View rail must handle More Tools first-click broker');
  need(bookmarksTs.includes('function installPass164MoreToolsActionBridge') && bookmarksTs.includes("event.detail?.actionId === 'chromium-bookmarks-button'"), 'Chromium bookmarks must handle More Tools first-click broker');
  need(responsiveCss.includes('body[data-pass164-more-tools-first-click-broker]') && responsiveCss.includes('.mission-recipe-filter-summary'), 'responsive CSS missing PASS164 first-click / recipe summary rules');

  for (const token of [
    'function selectedMissionRecipeType',
    'function missionRecipesForSelectedType',
    'data-pass164-recipe-filter-summary',
    'missionRecipes.dataset.pass164RecipeSelectedMissionType = selectedType',
    'document.body.dataset.pass164MissionRecipeTypeRefactor = selectedType',
    'data-pass164-recipe-mission-type',
    'function pass164RefactorRecipesForSelectedMissionType',
    "missionTypeSelect.addEventListener('change', pass164RefactorRecipesForSelectedMissionType)"
  ]) need(app.includes(token), `app missing PASS164 mission-type recipe refactor token: ${token}`);
  need(!app.includes('psa:direct-fetch'), 'PASS164 must not add direct PSA API behavior');
  need(!app.includes('ipcRenderer.send('), 'PASS164 must not add raw IPC sends to renderer app');
  need(doc.includes('PASS164') && doc.includes('Mission Control') && doc.includes('async') && doc.includes('More Tools') && doc.includes('Mission Type'), 'PASS164 doc missing expanded scope');
  need(summary.includes('PASS164') && summary.includes('Version remains `1.8.30`') && summary.includes('Remaining enterprise GA passes: 0') && summary.includes('More Tools first-click') && summary.includes('Mission Type recipe refactor'), 'PASS164 summary missing required markers');
}
if (failures.length) {
  console.error('PASS164 Mission Control open race verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS164][OK] Mission Control open race, More Tools first-click broker, and Mission Type recipe refactor verified.');
