#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const css = readFileSync('src/renderer/styles/browser.css', 'utf8');
const bookmarks = readFileSync('browser/bookmarks/bookmarks.json', 'utf8');
const chromiumBookmarks = readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
function versionAtLeast(actual, floor) {
  const a = String(actual || '').split('.').map((n) => Number(n) || 0);
  const b = String(floor || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}
const requiredCss = [
  'PASS 34: Mission Control enterprise UX repair',
  'overflow: hidden !important;',
  'scrollbar-width: none !important;',
  '#mission-recipes .mission-recipe-card',
  'grid-template-areas:',
  '"recipes runbook export"',
  '"recipes evidence timeline"',
  'mission-runbook-editor input:focus',
  'grid-template-columns: 1fr !important;'
];
const requiredBookmarkUrls = [
  'https://os.tahai.net',
  'https://sentinel.tahai.net',
  'https://browser.tahai.net',
  'https://tahai.net'
];
const missing = [];
for (const token of requiredCss) if (!css.includes(token)) missing.push('CSS token missing: '+token);
for (const url of requiredBookmarkUrls) {
  if (!bookmarks.includes(url)) missing.push('default bookmarks missing: '+url);
  if (!chromiumBookmarks.includes(url.endsWith('/') ? url : url + '/')) missing.push('runtime bookmark defaults missing: '+url+'/');
}
if (!pkg.scripts?.['verify:pass-34-mission-control-enterprise-ux']) missing.push('package script missing: verify:pass-34-mission-control-enterprise-ux');
if (!versionAtLeast(pkg.version, '1.8.10')) missing.push('package version expected >= 1.8.10, found '+pkg.version);
if (missing.length) {
  console.error('PASS34_MISSION_CONTROL_ENTERPRISE_UX_FAIL');
  for (const item of missing) console.error('- '+item);
  process.exit(1);
}
console.log('PASS34_MISSION_CONTROL_ENTERPRISE_UX_OK=1');

process.exit(0);