#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const required = [
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'src/renderer/styles/mission-control.css',
  'docs/pass-163-more-tools-mission-reflow.md',
  'PASS_163_MORE_TOOLS_MISSION_REFLOW_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/app.ts');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const missionCss = read('src/renderer/styles/mission-control.css');
  const doc = read('docs/pass-163-more-tools-mission-reflow.md');
  const summary = read('PASS_163_MORE_TOOLS_MISSION_REFLOW_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';

  need(pkg.version === '1.8.30', 'PASS163 must not increment version without explicit approval');
  need(pkg.scripts?.['verify:pass-163-more-tools-mission-reflow'] === 'node scripts/verify-pass-163-more-tools-mission-reflow.mjs', 'package script missing PASS163 verifier');
  need(releaseBlockers.includes('verify:pass-163-more-tools-mission-reflow'), 'verify:release-blockers missing PASS163 verifier');
  need(releaseBlockers.indexOf('verify:pass-163-more-tools-mission-reflow') > releaseBlockers.indexOf('verify:pass-162-enterprise-ga-decision-gate'), 'PASS163 verifier must run after PASS162');
  need(releaseBlockers.indexOf('verify:pass-163-more-tools-mission-reflow') < releaseBlockers.lastIndexOf('npm run build'), 'PASS163 verifier must run before final build');

  need(html.includes('data-pass163-more-tools-mission-reflow="true"'), 'renderer body missing PASS163 marker');

  for (const token of [
    'PASS163 More Tools action dispatch',
    'PASS163_MORE_TOOLS_ACTION_CLOSE_DELAY_MS',
    'menuEl.dataset.pass163MoreToolsActionDispatch',
    'menuEl.addEventListener(\'click\'',
    'pass163OverflowActionElement',
    'document.body.dataset.pass163LastMoreToolsAction',
    'document.body.dataset.pass163MoreToolsActionDispatch = \'activated\'',
    'closeMenu({ restoreFocus: false })',
    "document.body.dataset.pass163MoreToolsActionDispatch = 'true'"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS163 token: ${token}`);

  for (const token of [
    'PASS122_OVERLAY_OPEN_SETTLE_MS',
    'pass122ActiveOverlayOpenedAt',
    'pass122ActiveOverlayOpenedSource',
    'pass122OverlayHasScrollSafeViewport',
    "source === 'mission-control'",
    'pass122OverlayOpenedAgeMs',
    'deferred-open-settle',
    'pass122OverlayFitsViewport(panel, active)'
  ]) need(app.includes(token), `app overlay guard missing PASS163 token: ${token}`);

  for (const token of [
    'PASS163: moved More Tools actions stay clickable',
    'body[data-pass163-more-tools-action-dispatch] .toolbar-overflow-menu',
    '#toolbar-overflow-items > .in-toolbar-overflow',
    'touch-action: manipulation'
  ]) need(responsiveCss.includes(token), `responsive CSS missing PASS163 token: ${token}`);

  for (const token of [
    'PASS163: Mission Control is a top-layer dialog',
    'body[data-pass163-more-tools-mission-reflow="true"] .mission-dialog[data-pass132-mission-viewport="compact"]',
    'body[data-pass163-more-tools-mission-reflow="true"] .mission-dialog[data-pass117-focus-open="true"]',
    'pointer-events: auto !important'
  ]) need(missionCss.includes(token), `mission CSS missing PASS163 token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS163 must not add raw IPC to responsive toolbar');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS163 must not add external-open behavior');
  need(!app.includes('psa:direct-fetch'), 'PASS163 must not add direct PSA API behavior');
  need(doc.includes('PASS163') && doc.includes('More Tools') && doc.includes('Mission Control'), 'PASS163 docs missing scope');
  need(summary.includes('PASS163') && summary.includes('Version remains `1.8.30`') && summary.includes('Remaining enterprise GA passes: 0'), 'PASS163 summary missing required markers');
}
if (failures.length) {
  console.error('PASS163 More Tools / Mission reflow verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS163][OK] More Tools action dispatch and Mission reflow guard verified.');
