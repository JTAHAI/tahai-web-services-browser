#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/renderer/app.ts',
  'docs/pass239-webview-boot-lifecycle-closeout.md',
  'scripts/verify-pass-239-webview-boot-lifecycle-closeout.mjs',
  'package.json',
  'NEXT_CHAT_STARTER.md'
];

let copied = 0;
for (const file of files) {
  const source = path.join(root, 'patches', 'pass239-webview-boot-lifecycle-closeout', file);
  const target = path.join(root, file);
  if (!fs.existsSync(source)) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  copied++;
}

console.log(`[PASS239][APPLY] copied ${copied} files`);
console.log('[PASS239][NEXT] npm run verify:pass-239-webview-boot-lifecycle-closeout');
