#!/usr/bin/env node
import fs from 'node:fs';

const css = fs.readFileSync('src/renderer/styles/mission-control.css', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['pass marker exists', css.includes('PASS245 — Mission Control card cutoff and internal-scroll closeout')],
  ['recipe list scrolls', css.includes('#mission-recipes {') && css.includes('overflow-y: auto !important')],
  ['recipe cards reserve launch pill space', css.includes('padding: 15px 17px 54px 18px !important')],
  ['recipe descriptions can scroll', css.includes('#mission-recipes .mission-recipe-card > span') && css.includes('overflow-y: auto !important')],
  ['evidence section can scroll', css.includes('.mission-evidence-section {') && css.includes('flex-direction: column !important')],
  ['evidence diagnostics use internal scroll', css.includes('.mission-evidence-v2-diagnostics,\n.mission-redaction-ux-v2-preview') && css.includes('max-height: 86px !important')],
  ['script registered', !!packageJson.scripts['verify:pass-245-mission-control-card-scroll-closeout']]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`PASS245_${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failed = true;
}
console.log(`PASS245_VERIFY_RESULT=${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
