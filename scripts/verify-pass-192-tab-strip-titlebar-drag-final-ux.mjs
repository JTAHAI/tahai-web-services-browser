#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS192][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }

const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const contract = read('src/shared/titlebar-chrome-final-ux-contract.ts');
const doc = read('docs/pass-192-tab-strip-titlebar-drag-final-ux.md');
const summary = read('PASS_192_TAB_STRIP_TITLEBAR_DRAG_FINAL_UX_SUMMARY.md');

need(pkg.version === '1.8.30', 'version-must-not-change-without-explicit-approval');
need(pkg.scripts?.['verify:pass-192-tab-strip-titlebar-drag-final-ux'] === 'node scripts/verify-pass-192-tab-strip-titlebar-drag-final-ux.mjs', 'package-script-missing');
need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-192-tab-strip-titlebar-drag-final-ux'), 'release-blockers-missing-pass192');
need(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-192-tab-strip-titlebar-drag-final-ux') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-191-address-bar-enterprise-reliability'), 'pass192-must-run-after-pass191');

for (const token of [
  'PASS192_TITLEBAR_CHROME_FINAL_UX_VERSION',
  'Pass192TitlebarChromeCaseId',
  'PASS192_TITLEBAR_CHROME_CASES',
  'empty-titlebar-track-remains-window-draggable',
  'tab-buttons-and-close-targets-are-no-drag-controls',
  'close-control-is-not-a-nested-button',
  'overflowing-tab-strip-preserves-visible-active-state',
  'keyboard-roving-focus-does-not-break-active-tab',
  'pass192TitlebarChromeSummary'
]) need(contract.includes(token), `contract-missing-token: ${token}`);

for (const token of [
  'data-pass192-titlebar-chrome-final="true"',
  'data-testid="runtime-titlebar-drag-region"',
  'id="tabs" class="tabs"'
]) need(html.includes(token), `html-missing-token: ${token}`);

for (const token of [
  'PASS192_TITLEBAR_CHROME_FINAL_UX_VERSION',
  'PASS192_TITLEBAR_CHROME_CASES',
  'pass192TitlebarChromeSummary',
  'pass192DecorateTitlebarRoot',
  'pass192DecorateTabButton',
  'pass192SyncTitlebarChromeState',
  'pass192ScheduleTitlebarChromeSync',
  'pass192FocusTabByOffset',
  'pass192MountTitlebarChromeFinalizer',
  "button.innerHTML = `<span class=\"tab-title\"></span><span class=\"tab-close\"",
  "closeHitTarget?.addEventListener('pointerdown'",
  "if (target?.closest('.tab-close'))",
  "tab.button.setAttribute('role', 'tab')",
  "tab.button.setAttribute('aria-selected'",
  "tabsEl.dataset.pass192OverflowState",
  "document.body.dataset.pass192TitlebarOverflow",
  "pass192MountTitlebarChromeFinalizer();"
]) need(app.includes(token), `app-missing-token: ${token}`);

need(!app.includes('<button class="tab-close"'), 'nested-button-tab-close-regressed');
need(/tabsEl\.addEventListener\('keydown',[\s\S]*ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/.test(app), 'tabstrip-keyboard-roving-missing');
need(/function setActive\(tabId: string\): void \{[\s\S]*pass192SyncTitlebarChromeState\('set-active'\)/.test(app), 'set-active-does-not-sync-titlebar');

for (const token of [
  'PASS192 Tab Strip and Titlebar Drag Final UX',
  'body[data-pass192-titlebar-chrome-final="true"] .topbar',
  '-webkit-app-region: drag',
  '.tab-close',
  'body[data-pass192-titlebar-overflow="overflowing"] .tabs',
  '@media (min-resolution: 1.25dppx)',
  'scroll-snap-type: x proximity'
]) need(css.includes(token), `css-missing-token: ${token}`);

need(doc.includes('empty titlebar') && doc.includes('nested `<button>`'), 'doc-missing-required-public-summary');
need(summary.includes('PASS192') && summary.includes('release-blocker'), 'summary-missing-pass192');

console.log('[PASS192][OK] Tab strip and titlebar drag final UX verified.');
