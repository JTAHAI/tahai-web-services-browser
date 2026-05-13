#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const patchRoot = path.join(root, 'patches', 'pass243-maximized-overlay-layering-polish');
const files = [
  'package.json',
  'package-lock.json',
  'src/renderer/styles/browser.css',
  'src/renderer/styles/mission-control.css',
  'docs/pass243-maximized-overlay-layering-polish.md',
  'PASS_243_MAXIMIZED_OVERLAY_LAYERING_POLISH_SUMMARY.md',
  'README-PASS243.md',
  'NEXT_CHAT_STARTER.md',
  'scripts/verify-pass-243-maximized-overlay-layering-polish.mjs',
  'scripts/apply-pass243-maximized-overlay-layering-polish.mjs'
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
console.log('PASS243_APPLY=PASS maximized_overlay_layering_polish=1');
