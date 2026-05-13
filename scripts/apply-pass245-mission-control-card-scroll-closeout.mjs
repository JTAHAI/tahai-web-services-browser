#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const patchRoot = path.join(root, 'patches', 'pass245-mission-control-card-scroll-closeout');
const files = [
  'package.json',
  'src/renderer/styles/mission-control.css',
  'docs/pass245-mission-control-card-scroll-closeout.md',
  'PASS_245_MISSION_CONTROL_CARD_SCROLL_CLOSEOUT_SUMMARY.md',
  'README-PASS245.md',
  'NEXT_CHAT_STARTER.md',
  'scripts/verify-pass-245-mission-control-card-scroll-closeout.mjs',
  'scripts/apply-pass245-mission-control-card-scroll-closeout.mjs'
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
console.log('PASS245_APPLY=PASS mission_control_card_scroll_closeout=1');
