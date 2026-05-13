#!/usr/bin/env node
import fs from 'node:fs';

const css = fs.readFileSync('src/renderer/styles/mission-control.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
  ['marker', css.includes('PASS244 — Mission Control final overlap closeout')],
  ['workbench_paint_plane', css.includes('.mission-workbench::before') && css.includes('rgba(2, 8, 13, .998)')],
  ['sections_above_rail', css.includes('.mission-workbench > .mission-section') && css.includes('z-index: 2 !important')],
  ['evidence_clamped', css.includes('.mission-evidence-v2-diagnostics') && css.includes('max-height: 54px !important')],
  ['runbook_editor_scroll_lane', css.includes('.mission-runbook-editor {') && css.includes('flex-direction: column !important')],
  ['package_script', !!pkg.scripts['verify:pass-244-mission-control-overlap-closeout']]
];
let failed = false;
for (const [name, ok] of checks) {
  console.log(`PASS244_${name.toUpperCase()}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failed = true;
}
console.log(`PASS244_VERIFY_RESULT=${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
