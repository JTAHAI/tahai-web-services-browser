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
  'src/renderer/app.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-175-icon-screen-size-ux-hardening.md',
  'PASS_175_ICON_SCREEN_SIZE_UX_HARDENING_SUMMARY.md',
  'scripts/verify-pass-175-icon-screen-size-ux-hardening.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
  const appTs = read('src/renderer/app.ts');
  const css = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-175-icon-screen-size-ux-hardening.md');
  const summary = read('PASS_175_ICON_SCREEN_SIZE_UX_HARDENING_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';

  need(pkg.version === '1.8.30', 'PASS175 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-175-icon-screen-size-ux-hardening'] === 'node scripts/verify-pass-175-icon-screen-size-ux-hardening.mjs', 'package.json must expose PASS175 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-175-icon-screen-size-ux-hardening'), 'release blocker chain must include PASS175 verifier.');
  need(releaseBlockers.indexOf('verify:pass-175-icon-screen-size-ux-hardening') > releaseBlockers.indexOf('verify:pass-174-iconified-utility-chrome-hardening'), 'PASS175 verifier must run after PASS174 verifier.');
  need(releaseBlockers.indexOf('verify:pass-175-icon-screen-size-ux-hardening') < releaseBlockers.lastIndexOf('npm run build'), 'PASS175 verifier must run before final build.');

  for (const token of [
    'data-pass175-icon-screen-size-ux-hardening="true"',
    'class="profile-glyph">◉</span>',
    'aria-label="Switch Mission Control to 1-Up single-pane view"',
    'aria-label="Switch Mission Control to 2-Up split view"',
    'aria-label="Switch Mission Control to 4-Up Quad view"',
    'aria-label="Focus the active Mission Control pane"',
    'aria-label="Recover Mission Control view layout"'
  ]) need(html.includes(token), `HTML missing PASS175 icon/layout clarity token: ${token}`);

  for (const token of [
    'PASS175 icon/screen-size UX hardening',
    'function pass175IsVisibleUtilityControl',
    "element.closest('[hidden], [aria-hidden=\"true\"]')",
    "style.display === 'none'",
    'Boolean(element.getClientRects().length)',
    "if (width < 720) return 9;",
    "event.key === 'Tab'",
    "document.body.dataset.pass175MoreToolsTabRoving = 'true'",
    "document.body.dataset.pass175IconScreenSizeUxHardening = 'true'",
    'pass174HideUtilityTooltip();\n    ensureShell(); collectManagedItems(); updateChromeStackVars();'
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS175 token: ${token}`);

  for (const token of [
    'PASS175 Icon/Screen-Size UX Hardening',
    'body[data-pass175-icon-screen-size-ux-hardening="true"] .utility-chrome-button .profile-action-icon',
    '.profile-glyph',
    '#chromium-bookmarks-button .chrome-action-icon',
    '@media (max-width: 720px)',
    '#toolbar-overflow-items'
  ]) need(css.includes(token), `responsive CSS missing PASS175 token: ${token}`);

  need(bookmarksTs.includes('>▤</span><span class="chrome-action-label">Bookmarks'), 'Bookmarks icon must be visually distinct from bookmark-star action.');
  need(appTs.includes("button.setAttribute('aria-pressed', String(activeLayout))"), 'Mission layout buttons must expose aria-pressed state.');
  need(appTs.includes('button.dataset.pass175LayoutAriaState'), 'Mission layout buttons must expose PASS175 runtime aria state marker.');

  need(!responsiveTs.includes('ipcRenderer'), 'PASS175 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS175 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS175 must not add inline click handlers.');
  need(doc.includes('PASS175') && doc.includes('profile') && doc.includes('tiny widths') && doc.includes('aria-pressed'), 'PASS175 doc must describe profile, tiny-width, and layout accessibility hardening.');
  need(summary.includes('PASS175') && summary.includes('Version remains `1.8.30`'), 'PASS175 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS175][FAIL] Icon/screen-size UX hardening verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS175][OK] Icon/screen-size UX hardening verified.');
