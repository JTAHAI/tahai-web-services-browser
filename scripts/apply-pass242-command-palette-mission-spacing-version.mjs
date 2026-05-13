#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const patchRoot = path.join(root, 'patches', 'pass242-command-palette-mission-spacing-version');
const files = [
  'package.json',
  'package-lock.json',
  'browser/about/index.html',
  'browser/about/release-truth.json',
  'src/shared/release-truth.ts',
  'src/renderer/app.ts',
  'src/renderer/styles/browser.css',
  'src/renderer/styles/mission-control.css',
  'docs/pass242-command-palette-mission-spacing-version.md',
  'PASS_242_COMMAND_PALETTE_MISSION_SPACING_VERSION_SUMMARY.md',
  'README-PASS242.md',
  'scripts/verify-pass-242-command-palette-mission-spacing-version.mjs',
  'scripts/apply-pass242-command-palette-mission-spacing-version.mjs'
];

if (fs.existsSync(patchRoot)) {
  for (const rel of files) {
    const src = path.join(patchRoot, rel);
    const dest = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
console.log('PASS242_APPLY=PASS command_palette_mission_spacing_version=1.9.0');
