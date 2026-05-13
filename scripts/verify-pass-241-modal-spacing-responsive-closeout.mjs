import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const browserCss = fs.readFileSync(path.join(root, 'src/renderer/styles/browser.css'), 'utf8');
const missionCss = fs.readFileSync(path.join(root, 'src/renderer/styles/mission-control.css'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const requiredBrowserMarkers = [
  'PASS241 — Modal overlap and responsive spacing closeout',
  'grid-template-rows: auto auto auto auto minmax(0, 1fr) auto',
  '.command-palette-list',
  '.command-row > span',
  'overflow-wrap: anywhere',
  '@media (max-width: 760px), (max-height: 760px)'
];

const requiredMissionMarkers = [
  'PASS241 — Operator Command Center modal spacing/refactor',
  '.operator-command-center-v2',
  'max-height: min(220px, 28vh)',
  '.operator-command-family-grid',
  '-webkit-line-clamp: 2',
  '@media (max-height: 640px)'
];

for (const marker of requiredBrowserMarkers) {
  if (!browserCss.includes(marker)) throw new Error(`PASS241 browser CSS marker missing: ${marker}`);
}

for (const marker of requiredMissionMarkers) {
  if (!missionCss.includes(marker)) throw new Error(`PASS241 mission CSS marker missing: ${marker}`);
}

if (!browserCss.includes('min-height: 0 !important;') || !browserCss.includes('max-height: none !important;')) {
  throw new Error('PASS241 command-palette list height override missing.');
}

if (!packageJson.scripts?.['verify:pass-241-modal-spacing-responsive-closeout']) {
  throw new Error('PASS241 npm verifier script is not registered.');
}

console.log('PASS241_MODAL_SPACING_RESPONSIVE_CLOSEOUT=PASS');
