#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
  'docs/pass-174-iconified-utility-chrome-hardening.md',
  'PASS_174_ICONIFIED_UTILITY_CHROME_HARDENING_SUMMARY.md',
  'scripts/verify-pass-174-iconified-utility-chrome-hardening.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
  const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
  const css = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-174-iconified-utility-chrome-hardening.md');
  const summary = read('PASS_174_ICONIFIED_UTILITY_CHROME_HARDENING_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';

  need(pkg.version === '1.8.30', 'PASS174 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-174-iconified-utility-chrome-hardening'] === 'node scripts/verify-pass-174-iconified-utility-chrome-hardening.mjs', 'package.json must expose PASS174 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-174-iconified-utility-chrome-hardening'), 'release blocker chain must include PASS174 verifier.');
  need(releaseBlockers.indexOf('verify:pass-174-iconified-utility-chrome-hardening') > releaseBlockers.indexOf('verify:pass-173-iconified-utility-chrome'), 'PASS174 verifier must run after PASS173 verifier.');
  need(releaseBlockers.indexOf('verify:pass-174-iconified-utility-chrome-hardening') < releaseBlockers.lastIndexOf('npm run build'), 'PASS174 verifier must run before final build.');

  for (const token of [
    'aria-label="Open Mission Control"',
    'data-pass173-iconified-utility-chrome="true"',
    'aria-label="Open TAHAI launchpad"',
    'aria-label="Open Guide / Knowledge Base"',
    'aria-label="Manage browser profiles"',
    'aria-label="Open Ops Panel"',
    'aria-label="Open Settings"',
    'aria-label="Open About"'
  ]) need(html.includes(token), `HTML missing PASS174 accessibility token: ${token}`);

  for (const token of [
    'PASS174 iconified utility hardening',
    "const PASS174_TOOLTIP_ID = 'pass174-utility-tooltip'",
    "tooltip.setAttribute('role', 'tooltip')",
    "document.addEventListener('focusin'",
    "document.addEventListener('pointerover'",
    "source.setAttribute('aria-describedby', PASS174_TOOLTIP_ID)",
    'pass174HideUtilityTooltip(source)',
    "document.body.dataset.pass173IconifiedUtilityChrome = 'true'",
    "document.body.dataset.pass174IconifiedUtilityChromeHardening = 'true'",
    "document.body.dataset.pass174UtilityTooltipController = 'ready'",
    "item.element.setAttribute('role', 'menuitem')",
    'delete item.element.dataset.pass174MoreToolsMenuRole',
    'pass174MoveMenuFocus(1)',
    'pass174MoveMenuFocus(-1)',
    "event.key === 'ArrowDown'",
    "event.key === 'Home'",
    "event.key === 'End'",
    "pass174HideUtilityTooltip();\n    menuEl.hidden = true"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS174 token: ${token}`);

  for (const token of [
    'PASS174 Iconified Utility Chrome Hardening',
    'body[data-pass174-iconified-utility-chrome-hardening="true"] [data-pass173-tooltip]::after',
    '.pass174-utility-tooltip',
    'position: fixed;',
    'pointer-events: none;',
    '.pass174-utility-tooltip[data-pass174-tooltip-visible="true"]',
    '.toolbar > .utility-chrome-button:not(.in-toolbar-overflow):focus-visible',
    '#toolbar-overflow-toggle:focus-visible',
    '#toolbar-guide-quick:focus-visible',
    '#toolbar-overflow-items .utility-chrome-button:focus-visible',
    '#toolbar-overflow-items .utility-chrome-button[role="menuitem"]'
  ]) need(css.includes(token), `responsive CSS missing PASS174 token: ${token}`);

  need(responsiveTs.includes("document.addEventListener('focusin'") && responsiveTs.includes("document.addEventListener('pointerover'"), 'PASS174 tooltip controller must install both focus and pointer handlers.');
  need(!responsiveTs.includes('ipcRenderer'), 'PASS174 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS174 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS174 must not add inline click handlers.');

  for (const token of [
    "star.setAttribute('aria-label', 'Bookmark current page')",
    "button.setAttribute('aria-label', 'Open Bookmarks menu')",
    "star.dataset.pass173Tooltip = 'Bookmark page'",
    "button.dataset.pass173Tooltip = 'Bookmarks'"
  ]) need(bookmarksTs.includes(token), `bookmarks controls must retain PASS173/PASS174 labels: ${token}`);

  for (const token of [
    "button.setAttribute('aria-label', 'Toggle Site View Mission Rail')",
    "button.dataset.pass173Tooltip = 'Site View'"
  ]) need(siteViewTs.includes(token), `site view control must retain PASS173/PASS174 labels: ${token}`);

  need(doc.includes('PASS174') && doc.includes('fixed-position tooltip') && doc.includes('focus') && doc.includes('keyboard'), 'PASS174 doc must describe tooltip/focus/keyboard hardening.');
  need(summary.includes('PASS174') && summary.includes('Version remains `1.8.30`'), 'PASS174 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS174][FAIL] Iconified Utility Chrome Hardening verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS174][OK] Iconified utility chrome hardening verified.');
