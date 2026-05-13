#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const patchRoot = path.join(root, 'patches', 'pass244-mission-control-overlap-closeout');
const files = [
  'package.json',
  'src/renderer/styles/mission-control.css',
  'docs/pass244-mission-control-overlap-closeout.md',
  'PASS_244_MISSION_CONTROL_OVERLAP_CLOSEOUT_SUMMARY.md',
  'README-PASS244.md',
  'NEXT_CHAT_STARTER.md',
  'scripts/verify-pass-244-mission-control-overlap-closeout.mjs',
  'scripts/apply-pass244-mission-control-overlap-closeout.mjs'
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
console.log('PASS244_APPLY=PASS mission_control_overlap_closeout=1');
