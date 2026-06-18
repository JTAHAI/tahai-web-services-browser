#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const gitTracked = (p) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
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
for (const id of scenarioIds) need(contract.includes(`id: '${id}'`), `PASS158 contract missing scenario ${id}`);
need(contract.includes('active-webview-stage-viewport-fit'), 'PASS158 contract missing active webview stage viewport fit assertion');
need(contract.includes('guest-window-height-fills-stage-budget'), 'PASS158 contract missing guest viewport fill-budget assertion');
need(contract.includes('guest-document-bottom-fills-viewport'), 'PASS158 contract missing guest document-bottom viewport assertion');

const app = includesAll('src/renderer/app.ts', [
  'runtime-e2e-harness-contract',
  'RUNTIME_E2E_HARNESS_CONTRACT_ID',
  'runtimeE2eHarnessSummary',
  'installPass158RuntimeE2eHarness',
  'window.__TAHAI_RUNTIME_E2E__',
  'tab-pinning-and-switching',
  'mission-layouts-split-tri-quad-focus',
  'popup-denied',
  'kb-guide-more-tools',
  'shell-overlays-open-close',
  'tool-card-dialog-actions',
  'evidence-export-preview',
  'pass158RuntimeE2eElementHitTargetReady',
  'Runtime E2E selector is not hit-test ready',
  'pass158-guest-viewport',
  'guest viewport',
  'document bottom',
  'active guest document bottom stops before viewport bottom',
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
  'pass158-runtime-e2e-result.json',
  'pass158-runtime-e2e-full.log',
  'npm run build before npm run test:runtime-e2e',
  'Runtime E2E harness passed'
]);

need(pkg.version === '2.0.14', `version must remain 2.0.14 for PASS158 closeout, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-158-runtime-e2e-harness'] === 'node scripts/verify-pass-158-runtime-e2e-harness.mjs', 'package missing PASS158 verifier script');
need(pkg.scripts?.['test:runtime-e2e'] === 'node scripts/run-pass-158-runtime-e2e-harness.mjs --run', 'package missing live runtime E2E script');
need(pkg.scripts?.['test:runtime-e2e:plan'] === 'node scripts/run-pass-158-runtime-e2e-harness.mjs', 'package missing source-only runtime E2E plan script');
const pass250Idx = blockers.indexOf('verify:pass-250-store-submission-evidence-identity-prep');
const pass337Idx = blockers.indexOf('verify:pass-337-cursor-root-cause-closeout');
const pass339Idx = blockers.indexOf('verify:pass-339-normal-browsing-input-paint-closeout');
const pass341Idx = blockers.indexOf('verify:pass-341-normal-browser-and-feature-clickability-closeout');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
const runtimeE2eIdx = blockers.lastIndexOf('npm run test:runtime-e2e');
need(pass250Idx >= 0, 'release blockers missing PASS250 Store submission evidence prep');
need(pass337Idx > pass250Idx, 'PASS337 runtime root-cause closeout must run after PASS250');
need(pass339Idx > pass337Idx, 'PASS339 normal browsing closeout must run after PASS337');
need(pass341Idx > pass339Idx, 'PASS341 feature clickability closeout must run after PASS339');
need(finalBuildIdx > pass341Idx, 'final build must run after PASS341');
need(runtimeE2eIdx > finalBuildIdx, 'live runtime E2E must run after final build');

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
  'Browser Kit tab pinning/cycling',
  'representative DevOps/IT/Ops action cards',
  'Runtime clicks now fail closed if a control is visible in the DOM but does not own its hit target',
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
need(!/psa[\s\S]{0,120}(client_secret|refresh_token|access_token|api[_-]?key)/i.test(app + main + contract + runner), 'PASS158 runtime harness must not add direct PSA secret handling');
need(!/(client_secret|refresh_token|access_token|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_./+=-]{12,}/i.test(main + contract + runner), 'PASS158 runtime harness must not add secret-bearing fixtures');
for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/runtime-e2e/result.json'
]) need(!gitTracked(generated), `generated output must not be tracked for commit: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS158][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS158][OK] Runtime E2E Harness verified.');
