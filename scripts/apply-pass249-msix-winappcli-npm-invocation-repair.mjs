#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/verify-pass-249-msix-winappcli-npm-invocation-repair.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
console.log('[PASS249][APPLY] PASS249 overlay is present and verified. Continue with npm run package:win:msix on Windows.');
