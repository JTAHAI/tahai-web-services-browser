import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const browserCss = fs.readFileSync(path.join(root, 'src/renderer/styles/browser.css'), 'utf8');
const bookmarkCss = fs.readFileSync(path.join(root, 'src/renderer/styles/chromium-bookmarks.css'), 'utf8');
function versionAtLeast(actual, floor) {
  const a = String(actual || '').split('.').map((n) => Number(n) || 0);
  const b = String(floor || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

const required = [
  ['package version >= 1.8.8', versionAtLeast(pkg.version, '1.8.8')],
  ['pass32 release blocker script', typeof pkg.scripts?.['verify:pass-32-mission-readability'] === 'string'],
  ['pass32 wired into release blockers', String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-32-mission-readability')],
  ['mission readability marker', browserCss.includes('PASS 32: Mission Control readability repair')],
  ['mission grid areas', browserCss.includes('grid-template-areas') && browserCss.includes('"tabs runbook export"')],
  ['mission section area mapping', browserCss.includes('.mission-grid > .mission-section:nth-of-type(7) { grid-area: export; }')],
  ['mission form contrast', browserCss.includes('.mission-runbook-editor input:focus') && browserCss.includes('background: #07111f')],
  ['bookmark overflow marker', bookmarkCss.includes('PASS 32: bookmark folder view overflow repair')],
  ['bookmark rows have four action columns', bookmarkCss.includes('repeat(4, minmax(68px, auto))')],
  ['bookmark actions use 4 grid rows', bookmarkCss.includes('grid-template-rows: auto auto auto minmax(0, 1fr)')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error('PASS32_MISSION_READABILITY_OK=0');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('PASS32_MISSION_READABILITY_OK=1');
