#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const css = readFileSync('src/renderer/styles/browser.css', 'utf8');
const html = readFileSync('src/renderer/index.html', 'utf8');
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
const requiredCss = ['PASS 33: Mission Control workbench refactor','.mission-workbench','grid-template-areas:','"tabs runbook export"','"recipes runbook evidence"','"recipes saved timeline"','#mission-recipes','repeat(auto-fit, minmax(212px, 1fr))','.mission-dialog ::-webkit-scrollbar-thumb','scrollbar-color:','overflow: hidden;'];
const requiredHtml = ['mission-grid mission-workbench','mission-tabs-section','mission-recipes-section','mission-runbook-section','mission-saved-section','mission-evidence-section','mission-timeline-section','mission-export-section'];
const missing = [];
for (const token of requiredCss) if (!css.includes(token)) missing.push('CSS token missing: '+token);
for (const token of requiredHtml) if (!html.includes(token)) missing.push('HTML token missing: '+token);
if (!pkg.scripts?.['verify:pass-33-mission-control-ux-refactor']) missing.push('package script missing: verify:pass-33-mission-control-ux-refactor');
if (!versionAtLeast(pkg.version, '1.8.9')) missing.push('package version expected >= 1.8.9, found '+pkg.version);
if (missing.length) { console.error('PASS33_MISSION_CONTROL_UX_REFACTOR_FAIL'); for (const item of missing) console.error('- '+item); process.exit(1); }
console.log('PASS33_MISSION_CONTROL_UX_REFACTOR_OK=1');

process.exit(0);