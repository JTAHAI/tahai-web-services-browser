#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/renderer/app.ts',
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/site-view-mission-rail.ts',
  'docs/pass240-peripheral-webview-lifecycle-closeout.md',
  'scripts/verify-pass-240-peripheral-webview-lifecycle-closeout.mjs',
  'package.json',
  'NEXT_CHAT_STARTER.md'
];

let copied = 0;
for (const file of files) {
  const source = path.join(root, 'patches', 'pass240-peripheral-webview-lifecycle-closeout', file);
  const target = path.join(root, file);
  if (!fs.existsSync(source)) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  copied++;
}

console.log(`[PASS240][APPLY] copied ${copied} files`);
console.log('[PASS240][NEXT] npm run verify:pass-240-peripheral-webview-lifecycle-closeout');
