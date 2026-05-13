#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/renderer/app.ts',
  'scripts/verify-pass-238-webview-command-lifecycle-gate.mjs',
  'docs/pass238-webview-command-lifecycle-gate.md',
  'NEXT_CHAT_STARTER.md'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`[PASS238][FAIL] Missing overlaid file: ${rel}`);
    process.exit(1);
  }
}
const app = fs.readFileSync(path.join(root, 'src/renderer/app.ts'), 'utf8');
if (!app.includes('PASS238_WEBVIEW_COMMAND_LIFECYCLE_GATE')) {
  console.error('[PASS238][FAIL] PASS238 marker missing from renderer source.');
  process.exit(1);
}
console.log('[PASS238][OK] Overlay present. Run npm run verify:pass-238-webview-command-lifecycle-gate');
