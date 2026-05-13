#!/usr/bin/env node
import fs from 'node:fs';

const browserCss = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const missionCss = fs.readFileSync('src/renderer/styles/mission-control.css', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  {
    name: 'browser css pass243 marker',
    ok: browserCss.includes('PASS243 — Maximized overlay layer containment polish')
  },
  {
    name: 'command palette rows use flex list containment',
    ok: browserCss.includes('.command-palette-list {\n  display: flex !important;')
  },
  {
    name: 'mission css pass243 marker',
    ok: missionCss.includes('PASS243 — Maximized Mission Control surface layering polish')
  },
  {
    name: 'mission workbench raised above top strips',
    ok: missionCss.includes('.mission-workbench {\n  position: relative !important;\n  z-index: 1 !important;')
  },
  {
    name: 'package script registered',
    ok: !!packageJson.scripts['verify:pass-243-maximized-overlay-layering-polish']
  }
];

let failed = false;
for (const check of checks) {
  const label = check.ok ? 'PASS' : 'FAIL';
  console.log(`PASS243_VERIFY_${check.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}=${label}`);
  if (!check.ok) failed = true;
}
console.log(`PASS243_VERIFY_RESULT=${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
