#!/usr/bin/env node
import fs from 'node:fs';

const required = [
  'src/renderer/operator-command-center-v2.ts',
  'src/renderer/index.html',
  'src/renderer/styles/browser.css',
  'src/renderer/styles/mission-control.css',
  'docs/pass-241-responsive-modal-spacing.md',
  'scripts/verify-pass-241-responsive-modal-spacing.mjs',
  'PASS_241_RESPONSIVE_MODAL_SPACING_SUMMARY.md'
];

for (const rel of required) {
  if (!fs.existsSync(rel)) {
    console.error(`[PASS241][APPLY][FAIL] Missing ${rel}. Expand the patch at the repository root first.`);
    process.exit(1);
  }
}

console.log('PASS241_APPLY=PASS');
console.log('PASS241_SCOPE=Responsive Modal + Command Palette Spacing Polish');
