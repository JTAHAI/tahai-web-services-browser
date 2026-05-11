#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const contract = includesAll('src/shared/runtime-e2e-harness-contract.ts', [
  'RUNTIME_E2E_HARNESS_PASS',
  'PASS158',
  'RUNTIME_E2E_HARNESS_CONTRACT_ID',
  'runtime-e2e-harness-v1',
  'RUNTIME_E2E_HARNESS_SCHEMA_VERSION = 1',
  'RuntimeE2eScenarioId',
  'RuntimeE2eHarnessContract',
  'sourceOnlyVerifier: true',
  'runtimeHarnessAvailable: true',
  'requiresElectronRuntimeForLiveExecution: true',
  'usesSyntheticLocalMissionOnly: true',
  'storesSecrets: false',
  'opensNetworkByDefault: false',
  'directPsaApiAllowed: false',
  'runtimeE2eHarnessSummary'
]);

const scenarioIds = [
  'launch-shell',
  'titlebar-drag',
  'tab-create-close',
  'mission-control-open',
  'mission-layouts-split-tri-quad-focus',
  'active-pane-routing',
  'popup-denied',
  'kb-guide-more-tools',
  'evidence-export-preview'
];
for (const id of scenarioIds) need(contract.includes(`id: '${id}'`), `PASS158 contract missing scenario ${id}`);

const app = includesAll('src/renderer/app.ts', [
  'runtime-e2e-harness-contract',
  'RUNTIME_E2E_HARNESS_CONTRACT_ID',
  'runtimeE2eHarnessSummary',
  'installPass158RuntimeE2eHarness',
  'window.__TAHAI_RUNTIME_E2E__',
  'mission-layouts-split-tri-quad-focus',
  'popup-denied',
  'kb-guide-more-tools',
  'evidence-export-preview',
  "hasAttribute('allowpopups')",
  "data-export-redaction-boundary"
]);
const rendererRuntimeLifecycle = includesAll('src/renderer/renderer-shell-lifecycle.ts', [
  'document.body.dataset.pass158RuntimeE2eHarness',
  'document.body.dataset.pass158RuntimeE2eHarnessSummary',
  'runtimeE2eHarnessSummary()'
]);

const main = includesAll('src/main/main.ts', [
  'runtime-e2e-harness-contract',
  'RUNTIME_E2E_HARNESS_PASS',
  'maybeRunPass158RuntimeE2e',
  'TAHAI_RUNTIME_E2E',
  'TAHAI_RUNTIME_E2E_RESULT',
  'TAHAI_RUNTIME_E2E_QUIT',
  'window.__TAHAI_RUNTIME_E2E__?.run?.()',
  'fs.writeFileSync(resultPath'
]);

const html = includesAll('src/renderer/index.html', [
  'data-pass158-runtime-e2e-harness="true"',
  'data-testid="runtime-titlebar-drag-region"',
  'data-testid="runtime-tabs"',
  'data-testid="runtime-new-tab"',
  'data-testid="runtime-guide-kb"',
  'data-testid="runtime-mission-control"',
  'data-testid="runtime-webview-stage"'
]);

const runner = includesAll('scripts/run-pass-158-runtime-e2e-harness.mjs', [
  'PASS158',
  '--plan-json',
  '--run',
  'TAHAI_RUNTIME_E2E',
  'TAHAI_RUNTIME_E2E_RESULT',
  'npm run build before npm run test:runtime-e2e',
  'Runtime E2E harness passed'
]);

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS158, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-158-runtime-e2e-harness'] === 'node scripts/verify-pass-158-runtime-e2e-harness.mjs', 'package missing PASS158 verifier script');
need(pkg.scripts?.['test:runtime-e2e'] === 'node scripts/run-pass-158-runtime-e2e-harness.mjs --run', 'package missing live runtime E2E script');
need(pkg.scripts?.['test:runtime-e2e:plan'] === 'node scripts/run-pass-158-runtime-e2e-harness.mjs', 'package missing source-only runtime E2E plan script');
const pass157Idx = blockers.indexOf('verify:pass-157-evidence-capture-privacy-hardening');
const pass158Idx = blockers.indexOf('verify:pass-158-runtime-e2e-harness');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass157Idx >= 0, 'release blockers missing PASS157');
need(pass158Idx > pass157Idx, 'PASS158 must run after PASS157');
need(finalBuildIdx > pass158Idx, 'PASS158 must run before final build');

for (const file of [
  'src/shared/runtime-e2e-harness-contract.ts',
  'scripts/run-pass-158-runtime-e2e-harness.mjs',
  'scripts/verify-pass-158-runtime-e2e-harness.mjs',
  'docs/runtime-e2e-harness-pass158.md',
  'PASS_158_RUNTIME_E2E_HARNESS_SUMMARY.md'
]) need(exists(file), `missing PASS158 file: ${file}`);

const plan = JSON.parse(execFileSync(process.execPath, ['scripts/run-pass-158-runtime-e2e-harness.mjs', '--plan-json'], { cwd: root, encoding: 'utf8' }));
need(plan.pass === 'PASS158', 'runtime E2E plan must identify PASS158');
need(plan.contractId === 'runtime-e2e-harness-v1', 'runtime E2E plan must identify contract');
need(plan.scenarioCount === scenarioIds.length, 'runtime E2E plan scenario count mismatch');
for (const id of scenarioIds) need(plan.scenarioIds.includes(id), `runtime E2E plan missing ${id}`);

includesAll('docs/runtime-e2e-harness-pass158.md', [
  'PASS158',
  'Runtime E2E Harness',
  'launch, tabs, panes, titlebar drag, popups, KB/Guide/More Tools, Mission Control, active-pane routing, and evidence export',
  'npm run test:runtime-e2e:plan',
  'npm run test:runtime-e2e',
  'TAHAI_RUNTIME_E2E=1',
  'No backend',
  'No PSA connector',
  'No generated release artifacts'
]);

includesAll('PASS_158_RUNTIME_E2E_HARNESS_SUMMARY.md', [
  'PASS158',
  'Runtime E2E Harness',
  'verify:pass-158-runtime-e2e-harness',
  'test:runtime-e2e',
  'PASS158 runs after PASS157',
  'Remaining enterprise GA passes: 4'
]);

need(!/fetch\([^)]*psa/i.test(app + main + contract + runner), 'PASS158 must not add browser-side PSA fetches');
need(!/client_secret|refresh_token|access_token|BEGIN PRIVATE KEY/i.test(app + main + runner), 'PASS158 runtime harness must not add secret-bearing fixtures');
for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/runtime-e2e/result.json'
]) need(!exists(generated), `generated output must not be committed: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS158][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS158][OK] Runtime E2E Harness verified.');
