import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const requiredFiles = [
  'src/shared/operator-command-center-v2.ts',
  'src/renderer/operator-command-center-v2.ts',
  'src/renderer/app.ts',
  'src/renderer/index.html',
  'src/renderer/styles/mission-control.css',
  'docs/pass-204-operator-command-center-v2.md',
  'package.json'
];

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`[PASS204][FAIL] Missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function assertContains(rel, needle, message) {
  const body = read(rel);
  if (!body.includes(needle)) throw new Error(`[PASS204][FAIL] ${message}: ${rel} missing ${needle}`);
}

for (const rel of requiredFiles) read(rel);

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts?.['verify:pass-204-operator-command-center-v2'] !== 'node scripts/verify-pass-204-operator-command-center-v2.mjs') {
  throw new Error('[PASS204][FAIL] package.json missing verify:pass-204-operator-command-center-v2 script.');
}
if (!getReleaseBlockersContract(pkg).includes('verify:pass-204-operator-command-center-v2')) {
  throw new Error('[PASS204][FAIL] verify:release-blockers does not include PASS204 verifier.');
}

assertContains('src/shared/operator-command-center-v2.ts', 'PASS204_OPERATOR_COMMAND_CENTER_V2', 'shared contract id not present');
assertContains('src/shared/operator-command-center-v2.ts', "'mission' | 'layout' | 'profiles' | 'evidence' | 'opstools' | 'kb-export'", 'command family union incomplete');
assertContains('src/shared/operator-command-center-v2.ts', 'disabledReason', 'disabled reasons not modeled');
assertContains('src/shared/operator-command-center-v2.ts', 'targetScope', 'target scope not modeled');
assertContains('src/renderer/operator-command-center-v2.ts', 'installOperatorCommandCenterV2', 'renderer installer missing');
assertContains('src/renderer/operator-command-center-v2.ts', 'command-palette-input', 'Ctrl+K search input binding missing');
assertContains('src/renderer/operator-command-center-v2.ts', 'Operator Command Center v2', 'visible panel title missing');
assertContains('src/renderer/app.ts', "./operator-command-center-v2", 'renderer app import missing');
assertContains('src/renderer/app.ts', 'installOperatorCommandCenterV2(() => currentMission)', 'renderer app installer call missing');
assertContains('src/renderer/index.html', 'data-pass204-operator-command-center-v2="true"', 'HTML pass marker missing');
assertContains('src/renderer/index.html', 'operator-command-center-v2', 'HTML command center panel missing');
assertContains('src/renderer/styles/mission-control.css', 'PASS204 — Operator Command Center v2', 'CSS marker missing');
assertContains('docs/pass-204-operator-command-center-v2.md', 'No IT Docs backend code', 'docs boundary missing');

const forbidden = [
  'psa:direct-fetch',
  'cookie:get-all',
  'auth:get-token',
  'ipcRenderer',
  'shell.openExternal',
  'BEGIN PRIVATE KEY'
];
for (const rel of ['src/shared/operator-command-center-v2.ts', 'src/renderer/operator-command-center-v2.ts']) {
  const body = read(rel);
  for (const needle of forbidden) {
    if (body.includes(needle)) throw new Error(`[PASS204][FAIL] Forbidden privileged/secret pattern ${needle} found in ${rel}`);
  }
}

console.log('[PASS204][OK] Operator Command Center v2 UX contract verified.');
