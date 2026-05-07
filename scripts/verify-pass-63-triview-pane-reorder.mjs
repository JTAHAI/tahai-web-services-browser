#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pass64Verifier = path.join(root, 'scripts', 'verify-pass-64-triview-repair-hardening.mjs');
if (fs.existsSync(pass64Verifier)) {
  const result = spawnSync(process.execPath, [pass64Verifier], { stdio: 'inherit', cwd: root });
  process.exit(result.status ?? 1);
}

console.error('PASS63_TRIVIEW_PANE_REORDER_ERROR=PASS64-compatible verifier missing; run npm run pass64:apply');
process.exit(1);
