#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^﻿/, '');
const contractText = read('src/shared/runtime-e2e-harness-contract.ts');
const scenarioIds = Array.from(contractText.matchAll(/id:\s*'([^']+)'/g)).map((m) => m[1]);
const required = [
  'launch-shell',
  'titlebar-drag',
  'tab-create-close',
  'tab-pinning-and-switching',
  'launchpad-guide-home-address',
  'mission-control-open',
  'mission-layouts-split-tri-quad-focus',
  'active-pane-routing',
  'popup-denied',
  'kb-guide-more-tools',
  'shell-overlays-open-close',
  'tool-card-dialog-actions',
  'evidence-export-preview'
];

function plan() {
  return {
    pass: 'PASS158',
    contractId: 'runtime-e2e-harness-v1',
    scenarioCount: scenarioIds.length,
    scenarioIds,
    required,
    runCommand: 'npm run test:runtime-e2e',
    sourceOnlyPlanCommand: 'npm run test:runtime-e2e:plan',
    notes: [
      'The source verifier proves harness wiring and selectors are present without requiring a GUI.',
      'The live runtime command launches Electron with TAHAI_RUNTIME_E2E=1, writes a JSON result, and quits.',
      'Run live runtime E2E on a desktop session with Electron installed and dist built.'
    ]
  };
}

if (args.has('--plan-json')) {
  process.stdout.write(JSON.stringify(plan(), null, 2));
  process.exit(0);
}

if (!args.has('--run')) {
  console.log('[PASS158][PLAN] Runtime E2E harness scenarios:');
  for (const id of scenarioIds) console.log(` - ${id}`);
  console.log('[PASS158][PLAN] Live runtime execution: npm run test:runtime-e2e');
  process.exit(0);
}

for (const id of required) {
  if (!scenarioIds.includes(id)) {
    console.error(`[PASS158][FAIL] missing runtime scenario ${id}`);
    process.exit(1);
  }
}

const mainDist = path.join(root, 'dist', 'main', 'main.js');
if (!fs.existsSync(mainDist)) {
  console.error('[PASS158][FAIL] dist/main/main.js missing. Run npm run build before npm run test:runtime-e2e.');
  process.exit(1);
}

let electronBinary;
try {
  const require = createRequire(import.meta.url);
  electronBinary = require('electron');
} catch (error) {
  console.error('[PASS158][FAIL] electron package is not installed. Run npm ci first.');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-pass158-runtime-e2e-'));
const resultPath = path.join(tempDir, 'result.json');
const runId = `pass158-${Date.now()}-${process.pid}`;
const evidenceDir = path.join(root, 'release-candidate', 'generated');
const evidenceResultPath = path.join(evidenceDir, 'pass158-runtime-e2e-result.json');
const evidenceLogPath = path.join(evidenceDir, 'pass158-runtime-e2e-full.log');
fs.mkdirSync(evidenceDir, { recursive: true });
const child = spawn(electronBinary, ['.'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    TAHAI_RUNTIME_E2E: '1',
    TAHAI_RUNTIME_E2E_RESULT: resultPath,
    TAHAI_RUNTIME_E2E_QUIT: '1',
    TAHAI_RUNTIME_E2E_RUN_ID: runId,
    TAHAI_BROWSER_USER_DATA_SUFFIX: runId,
    TAHAI_BROWSER_DISABLE_SINGLE_INSTANCE_LOCK: '1',
    TAHAI_BROWSER_RUNTIME_DIAGNOSTICS: '1',
    ELECTRON_ENABLE_LOGGING: '1',
    XDG_CONFIG_HOME: path.join(tempDir, 'xdg-config'),
    XDG_CACHE_HOME: path.join(tempDir, 'xdg-cache')
  }
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
}, 150000);

child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  fs.writeFileSync(evidenceLogPath, output);
  if (!fs.existsSync(resultPath)) {
    console.error(`[PASS158][FAIL] runtime E2E result was not written. exit=${code} signal=${signal || ''}`);
    if (output.trim()) console.error(output.slice(-5000));
    process.exit(1);
  }
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  fs.writeFileSync(evidenceResultPath, JSON.stringify(result, null, 2));
  const inner = result?.result;
  if (!inner?.ok) {
    console.error('[PASS158][FAIL] runtime E2E harness reported failure.');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(`[PASS158][OK] Runtime E2E harness passed ${inner.results?.length || 0} scenario(s).`);
  console.log(`PASS158_RESULT=${path.relative(root, evidenceResultPath).replace(/\\/g, '/')}`);
  console.log(`PASS158_LOG=${path.relative(root, evidenceLogPath).replace(/\\/g, '/')}`);
});
