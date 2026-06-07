#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-173-iconified-utility-chrome.md',
  'PASS_173_ICONIFIED_UTILITY_CHROME_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
  const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
  const css = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-173-iconified-utility-chrome.md');
  const summary = read('PASS_173_ICONIFIED_UTILITY_CHROME_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);

  need(pkg.version === '1.8.30', 'PASS173 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-173-iconified-utility-chrome'] === 'node scripts/verify-pass-173-iconified-utility-chrome.mjs', 'package.json must expose PASS173 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-173-iconified-utility-chrome'), 'release blocker chain must include PASS173 verifier.');
  need(releaseBlockers.indexOf('verify:pass-173-iconified-utility-chrome') > releaseBlockers.indexOf('verify:pass-171-overlay-focus-epoch-guard'), 'PASS173 verifier must run after PASS171 overlay guard.');
  need(releaseBlockers.indexOf('verify:pass-173-iconified-utility-chrome') < releaseBlockers.lastIndexOf('npm run build'), 'PASS173 verifier must run before final build.');

  need(html.includes('data-pass173-iconified-utility-chrome="true"'), 'renderer shell must expose PASS173 marker.');
  for (const id of ['launchpad', 'onboarding', 'profile-switcher', 'ops-hub-toggle', 'settings', 'about']) {
    need(html.includes(`id="${id}"`) && html.includes(`data-pass173-iconified=`), `HTML utility control missing iconified marker near ${id}.`);
  }
  for (const token of [
    'class="chrome-action-icon"',
    'class="chrome-action-label"',
    'aria-label="Open TAHAI launchpad"',
    'aria-label="Open Guide / Knowledge Base"',
    'aria-label="Manage browser profiles"',
    'aria-label="Open Ops Panel"',
    'aria-label="Open Settings"',
    'aria-label="Open About"'
  ]) need(html.includes(token), `HTML missing accessible icon token: ${token}`);

  for (const token of [
    "buttonEl.className = 'home-button secondary toolbar-overflow-toggle utility-chrome-button'",
    "buttonEl.dataset.pass173Iconified = 'more-tools'",
    "buttonEl.dataset.pass173Tooltip = 'More Tools'",
    'chrome-action-label">More Tools',
    "guideQuickEl.className = 'home-button secondary toolbar-guide-quick utility-chrome-button'",
    "guideQuickEl.dataset.pass173Iconified = 'guide-quick'",
    "element.dataset.pass173Iconified = element.dataset.pass173Iconified || definition.id",
    "element.dataset.pass173Tooltip = element.dataset.pass173Tooltip || definition.label",
    "!element.getAttribute('aria-label')"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS173 token: ${token}`);

  for (const token of [
    "chromium-bookmark-star utility-chrome-button",
    "star.setAttribute('aria-label', 'Bookmark current page')",
    "star.dataset.pass173Iconified = 'bookmark-star'",
    "chrome-action-label\">Star",
    "chromium-bookmarks-button utility-chrome-button",
    "button.setAttribute('aria-label', 'Open Bookmarks menu')",
    "button.dataset.pass173Iconified = 'bookmarks'",
    "chrome-action-label\">Bookmarks"
  ]) need(bookmarksTs.includes(token), `bookmarks toolbar missing PASS173 token: ${token}`);

  for (const token of [
    "site-view-rail-toggle utility-chrome-button",
    "button.setAttribute('aria-label', 'Toggle Site View Mission Rail')",
    "button.dataset.pass173Iconified = 'site-view'",
    "button.dataset.pass173Tooltip = 'Site View'",
    "chrome-action-label\">Site View"
  ]) need(siteViewTs.includes(token), `site view toolbar missing PASS173 token: ${token}`);

  for (const token of [
    'PASS173 Iconified Utility Chrome',
    '.utility-chrome-button',
    '.chrome-action-icon',
    '.chrome-action-label',
    '@media (max-width: 1380px)',
    'clip: rect(0,0,0,0)',
    '.toolbar-overflow-menu .utility-chrome-button .chrome-action-label',
    '[data-pass173-tooltip]::after',
    ':focus-visible::after'
  ]) need(css.includes(token), `responsive CSS missing PASS173 token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS173 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS173 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS173 must not add inline click handlers.');
  need(doc.includes('PASS173') && doc.includes('icon-only') && doc.includes('aria-label'), 'PASS173 doc must describe accessible iconification.');
  need(summary.includes('PASS173') && summary.includes('Version remains `1.8.30`'), 'PASS173 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS173][FAIL] Iconified Utility Chrome verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS173][OK] Iconified utility chrome verified.');
