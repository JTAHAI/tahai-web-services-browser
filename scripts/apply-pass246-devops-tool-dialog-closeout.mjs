#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const patchRoot = path.join(root, 'patches', 'pass246-devops-tool-dialog-closeout');
const files = [
  'package.json',
  'package-lock.json',
  'src/renderer/app.ts',
  'src/renderer/styles/browser.css',
  'docs/pass246-devops-tool-dialog-closeout.md',
  'PASS_246_DEVOPS_TOOL_DIALOG_CLOSEOUT_SUMMARY.md',
  'README-PASS246.md',
  'NEXT_CHAT_STARTER.md',
  'scripts/verify-pass-246-devops-tool-dialog-closeout.mjs',
  'scripts/apply-pass246-devops-tool-dialog-closeout.mjs'
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
console.log('PASS246_APPLY=PASS devops_tool_dialog_closeout=1');
