#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function fail(message, code = 1) { console.error(`[PASS247][FAIL] ${message}`); process.exit(code); }
if (process.platform !== 'win32') fail('MSIX packaging is Windows-only. Run this on Windows from C:\dev\browser\app.', 2);
for (const rel of ['config/msix-store-readiness.example.json','config/msix-manifest.template.xml','assets/store/windows/StoreLogo.png']) {
  if (!fs.existsSync(path.join(root, rel))) fail(`Missing ${rel}`);
}
const ps1 = path.join(root, 'packaging', 'windows', 'build-windows-msix.ps1');
if (!fs.existsSync(ps1)) fail('Missing packaging/windows/build-windows-msix.ps1');
const result = spawnSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File', ps1], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
