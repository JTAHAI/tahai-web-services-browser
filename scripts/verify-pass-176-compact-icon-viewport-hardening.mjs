#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function need(condition, message) { if (!condition) failures.push(message); }

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/app.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'src/renderer/styles/mission-control.css',
  'docs/pass-176-compact-icon-viewport-hardening.md',
  'PASS_176_COMPACT_ICON_VIEWPORT_HARDENING_SUMMARY.md',
  'scripts/verify-pass-176-compact-icon-viewport-hardening.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const appTs = read('src/renderer/app.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const missionCss = read('src/renderer/styles/mission-control.css');
  const doc = read('docs/pass-176-compact-icon-viewport-hardening.md');
  const summary = read('PASS_176_COMPACT_ICON_VIEWPORT_HARDENING_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';

  need(pkg.version === '1.8.30', 'PASS176 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-176-compact-icon-viewport-hardening'] === 'node scripts/verify-pass-176-compact-icon-viewport-hardening.mjs', 'package.json must expose PASS176 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-176-compact-icon-viewport-hardening'), 'release blocker chain must include PASS176 verifier.');
  need(releaseBlockers.indexOf('verify:pass-176-compact-icon-viewport-hardening') > releaseBlockers.indexOf('verify:pass-175-icon-screen-size-ux-hardening'), 'PASS176 verifier must run after PASS175 verifier.');
  need(releaseBlockers.indexOf('verify:pass-176-compact-icon-viewport-hardening') < releaseBlockers.lastIndexOf('npm run build'), 'PASS176 verifier must run before final build.');

  need(html.includes('data-pass176-compact-icon-viewport-hardening="true"'), 'renderer shell must expose PASS176 CSS/runtime state marker.');

  for (const token of [
    'PASS176 compact icon viewport hardening',
    'function pass176UpdateCompactIconViewportState',
    'document.body.dataset.pass176ResponsiveIconDensity',
    "'all-utility-in-more-tools'",
    'function pass176StabilizeOpenMoreToolsFocus',
    'pass176MoreToolsVisibleItems',
    "buttonEl.setAttribute('aria-controls', MENU_ID)",
    'buttonEl.dataset.pass176ControlsOverflowMenu = MENU_ID',
    "pass176StabilizeOpenMoreToolsFocus('relayout')",
    "document.body.dataset.pass176CompactIconViewportHardening = 'true'"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS176 token: ${token}`);

  for (const token of [
    'PASS176 Compact Icon Viewport Hardening',
    'min-height: 40px',
    'min-height: 42px',
    '@media (pointer: coarse)',
    'min-height: 44px',
    '#toolbar-overflow-toggle[aria-controls="toolbar-overflow-menu"]',
    'overscroll-behavior: contain'
  ]) need(responsiveCss.includes(token), `responsive CSS missing PASS176 compact hit-target token: ${token}`);

  for (const token of [
    'function pass176KeepActiveMissionLayoutVisible',
    "document.body.dataset.pass176CompactMissionLayoutScroll = 'ready'",
    "activeButton.scrollIntoView({ block: 'nearest', inline: 'center' })",
    "pass176KeepActiveMissionLayoutVisible('render')",
    "pass176KeepActiveMissionLayoutVisible('layout-click')"
  ]) need(appTs.includes(token), `renderer app missing PASS176 compact Mission layout token: ${token}`);

  for (const token of [
    'PASS176 Compact Icon Viewport Hardening',
    '.mission-layouts .home-button:focus-visible',
    '.mission-layouts .home-button.active',
    'scroll-margin-inline: 42px',
    'min-height: 36px',
    'min-height: 42px'
  ]) need(missionCss.includes(token), `mission CSS missing PASS176 compact layout token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS176 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS176 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS176 must not add inline click handlers.');
  need(doc.includes('PASS176') && doc.includes('More Tools') && doc.includes('focus') && doc.includes('hit target') && doc.includes('Mission layout'), 'PASS176 doc must describe More Tools focus, hit targets, and Mission layout hardening.');
  need(summary.includes('PASS176') && summary.includes('Version remains `1.8.30`'), 'PASS176 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS176][FAIL] Compact icon viewport hardening verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS176][OK] Compact icon viewport hardening verified.');
