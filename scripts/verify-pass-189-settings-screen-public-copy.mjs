#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS189][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }

const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

const settingsDialog = html.match(/<dialog id="settings-dialog"[\s\S]*?<\/dialog>/)?.[0] || '';
need(settingsDialog, 'settings-dialog-not-found');
need(settingsDialog.includes('data-pass189-settings-public-copy="true"'), 'settings-public-copy-marker-missing');

const visibleText = settingsDialog
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&hellip;/g, '...')
  .replace(/&times;/g, 'x')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const requiredPublicCopy = [
  'Settings are stored in your local app profile',
  'Permission prompts remain locked down',
  'Download status uses sanitized file names only',
  'Mission drag-and-drop accepts only internal TAHAI mission payloads',
  'Active-page capture is redacted, URL-normalized, size-capped, and source-sanitized',
  'Runtime settings are size-capped and sanitized before saving',
  'Ops diagnostics use cookie-free requests',
  'Remote page titles, status text, Mission timeline entries, and Mission metadata URLs are sanitized before display or local Mission use'
];
for (const phrase of requiredPublicCopy) need(visibleText.includes(phrase), `missing-public-settings-copy: ${phrase}`);

const bannedVisiblePatterns = [
  /\bPASS\d+\b/,
  /source repo/i,
  /renderer/i,
  /main process/i,
  /SSRF/i,
  /\bboundary\b/i,
  /\bhandoff\b/i,
  /origin-gated/i,
  /trusted shell/i
];
for (const pattern of bannedVisiblePatterns) need(!pattern.test(visibleText), `dev-language-visible-in-settings: ${pattern}`);

const settingsPseudoLabels = [
  "content:'Permission safety'",
  "content:'Download safety'",
  'content: "Local paths stay hidden"',
  "content:'Mission drag safety'",
  "content:'Capture safety'",
  "content:'Settings safety'"
];
for (const label of settingsPseudoLabels) need(css.includes(label), `settings-safety-label-missing: ${label}`);

const bannedCssVisibleContent = /content:\s*['"][^'"]*(PASS\d+|boundary|main-process|renderer|SSRF|handoff)[^'"]*['"]/i;
const settingsCssArea = css.match(/\/\* PASS95 origin-aware permission boundary \*\/[\s\S]*?\/\* PASS107 Mission View/s)?.[0] || '';
need(settingsCssArea, 'settings-css-area-not-found');
need(!bannedCssVisibleContent.test(settingsCssArea), 'dev-language-in-settings-visible-css-content');

need(pkg.scripts['verify:pass-189-settings-screen-public-copy'] === 'node scripts/verify-pass-189-settings-screen-public-copy.mjs', 'package-script-missing');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-189-settings-screen-public-copy'), 'release-blockers-missing-pass189');
need(pkg.scripts['verify:release-blockers']?.indexOf('verify:pass-189-settings-screen-public-copy') > pkg.scripts['verify:release-blockers']?.indexOf('verify:pass-188-webview-focus-input-boundary'), 'pass189-must-run-after-pass188');

console.log('[PASS189][OK] Settings screen public copy is free of visible PASS/dev language while preserving safety notes.');
