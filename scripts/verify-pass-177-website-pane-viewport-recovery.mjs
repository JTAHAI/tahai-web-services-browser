#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-177-website-pane-viewport-recovery.md',
  'PASS_177_WEBSITE_PANE_VIEWPORT_RECOVERY_SUMMARY.md',
  'scripts/verify-pass-177-website-pane-viewport-recovery.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-177-website-pane-viewport-recovery.md');
  const summary = read('PASS_177_WEBSITE_PANE_VIEWPORT_RECOVERY_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');

  need(pkg.version === '1.8.30', 'PASS177 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-177-website-pane-viewport-recovery'] === 'node scripts/verify-pass-177-website-pane-viewport-recovery.mjs', 'package.json must expose PASS177 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-177-website-pane-viewport-recovery'), 'release blocker chain must include PASS177 verifier.');
  need(releaseBlockers.indexOf('verify:pass-177-website-pane-viewport-recovery') > releaseBlockers.indexOf('verify:pass-176-compact-icon-viewport-hardening'), 'PASS177 verifier must run after PASS176 verifier.');
  need(releaseBlockers.indexOf('verify:pass-177-website-pane-viewport-recovery') < releaseBlockers.lastIndexOf('npm run build'), 'PASS177 verifier must run before final build.');

  need(html.includes('data-pass177-site-viewport-recovery="true"'), 'renderer shell must expose PASS177 viewport recovery marker.');

  for (const token of [
    'PASS177 website pane viewport recovery',
    'const PASS177_MIN_WEBVIEW_HEIGHT_PX = 220',
    'const PASS177_MAX_CHROME_VIEWPORT_SHARE = 0.38',
    'function pass177MeasureWebsitePaneBudget',
    "document.body.dataset.pass177SiteViewportRecovery = 'true'",
    'document.body.dataset.pass177MeasuredChromeHeight',
    'document.body.dataset.pass177MeasuredWebviewHeight',
    'document.body.dataset.pass177ViewportBudgetState',
    "document.body.dataset.pass177ForcedOverflow = 'true'",
    "document.body.dataset.pass177ForcedOverflowReason = pass177Budget.available < PASS177_MIN_WEBVIEW_HEIGHT_PX ? 'webview-height-below-floor' : 'chrome-share-above-budget'"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS177 token: ${token}`);

  for (const token of [
    'PASS177 Website Pane Viewport Recovery',
    '--pass177-titlebar-height',
    '--pass177-toolbar-height',
    '--pass177-statusbar-height',
    '--pass177-min-webview-height',
    'grid-template-rows: var(--pass177-titlebar-height) var(--pass177-toolbar-height) minmax(0, 1fr) var(--pass177-statusbar-height) !important',
    'body.chromium-bookmarks-installed[data-pass177-site-viewport-recovery="true"] .app-shell',
    'height: var(--pass177-toolbar-height) !important',
    'flex-wrap: nowrap !important',
    'overflow: hidden !important',
    'max-height: max(180px, calc(100dvh - var(--pass114-chrome-stack-top, 112px) - var(--pass114-overlay-bottom, 28px))) !important'
  ]) need(responsiveCss.includes(token), `responsive CSS missing PASS177 viewport token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS177 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS177 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS177 must not add inline click handlers.');
  need(doc.includes('PASS177') && doc.includes('horizontal sliver') && doc.includes('webview') && doc.includes('More Tools'), 'PASS177 doc must describe the website-pane sliver and More Tools recovery.');
  need(summary.includes('PASS177') && summary.includes('Version remains `1.8.30`'), 'PASS177 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS177][FAIL] Website pane viewport recovery verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS177][OK] Website pane viewport recovery verified.');
