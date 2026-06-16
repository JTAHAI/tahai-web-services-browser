#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^﻿/, '');
const json = (rel) => JSON.parse(read(rel));
const outDir = path.join(root, 'release-candidate', 'generated', 'pass345-blackbox-electron-release-e2e');
const outPath = path.join(outDir, 'pass345-blackbox-electron-release-e2e-contract-report.json');
const checks = [];

function check(id, ok, detail = '') {
  checks.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' - ' + detail : ''}`);
}

function ordered(source, first, second) {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}

const pkg = json('package.json');
const matrix = json('tests/runtime/pass345-blackbox-electron-release-matrix.json');
const runner = read('scripts/run-pass-345-blackbox-electron-release-e2e.mjs');
const docs = read('docs/qa/PASS345-BLACKBOX-ELECTRON-RELEASE-E2E.md');
const releaseContract = String(pkg.scripts?.['verify:release-blockers:contract'] || '');

check('package-script-present', pkg.scripts?.['verify:pass-345-blackbox-electron-release-e2e'] === 'node scripts/verify-pass-345-blackbox-electron-release-e2e.mjs');
check('package-live-runner-present', pkg.scripts?.['test:blackbox-e2e'] === 'node scripts/run-pass-345-blackbox-electron-release-e2e.mjs --run');
check('package-plan-runner-present', pkg.scripts?.['test:blackbox-e2e:plan'] === 'node scripts/run-pass-345-blackbox-electron-release-e2e.mjs');
check('package-release-all-present', pkg.scripts?.['package:release:all'] === 'npm run package:win:release && npm run package:win:msix && npm run package:linux:release');
check('package-ship-all-present', pkg.scripts?.['release:ship:all'] === 'npm run verify:release-blockers && npm run package:release:all');
check('playwright-devdependency-present', Boolean(pkg.devDependencies?.playwright));
check('release-contract-includes-pass345-verifier', releaseContract.includes('npm run verify:pass-345-blackbox-electron-release-e2e'));
check('release-contract-includes-blackbox-runner', releaseContract.includes('npm run test:blackbox-e2e'));
check('release-contract-order', ordered(releaseContract, 'verify:pass-344-microsoft-store-repo-cleanup-closeout', 'verify:pass-345-blackbox-electron-release-e2e') && ordered(releaseContract, 'verify:pass-345-blackbox-electron-release-e2e', 'npm run build') && ordered(releaseContract, 'npm run build', 'npm run test:blackbox-e2e') && ordered(releaseContract, 'npm run test:blackbox-e2e', 'npm run test:runtime-e2e'), 'PASS345 must verify before build and run before PASS158 runtime E2E');

check('matrix-pass-truth', matrix.pass === 'PASS345' && matrix.contractId === 'pass345-blackbox-electron-release-e2e-v1' && matrix.versionTarget === '2.0.14');
check('matrix-window-profiles', Array.isArray(matrix.windowProfiles) && matrix.windowProfiles.some((entry) => entry.id === 'restored-1460x940') && matrix.windowProfiles.some((entry) => entry.id === 'restored-1366x768'));
check('matrix-scenarios', Array.isArray(matrix.scenarios) && ['launch-shell-stage-webview', 'primary-browser-routing', 'chrome-flyouts-and-dialogs', 'browser-kit-find-and-guest-click', 'browser-history-session-recovery', 'browser-tab-pinning-and-switching', 'mission-control-layout-and-export'].every((id) => matrix.scenarios.some((entry) => entry.id === id)));
check('matrix-evidence-paths', Array.isArray(matrix.requiredEvidencePaths) && matrix.requiredEvidencePaths.includes('release-candidate/generated/pass345-blackbox-electron-release-e2e/pass345-blackbox-electron-release-e2e-result.json') && matrix.requiredEvidencePaths.includes('release-candidate/generated/pass345-blackbox-electron-release-e2e/pass345-blackbox-electron-release-e2e-summary.md'));

check('runner-uses-playwright-electron', runner.includes("import { _electron as electron } from 'playwright';") && runner.includes('await electron.launch(') && runner.includes('firstWindow()'));
check('runner-launches-built-app', runner.includes("dist', 'main', 'main.js") && runner.includes('Run npm run build before npm run test:blackbox-e2e'));
check('runner-real-window-profiles', runner.includes('BrowserWindow.getAllWindows()[0]') && runner.includes('win.setBounds({ width: size.width, height: size.height })'));
check('runner-real-input-and-screenshots', runner.includes('clickShellControl(page,') && runner.includes("page.keyboard.press('Escape')") && runner.includes('page.mouse.click(') && runner.includes('page.screenshot({ path:'));
check('runner-guest-click-proof', runner.includes('__pass345GuestClickCount') && runner.includes('executeJavaScript(') && runner.includes('guest click count did not increase'));
check('runner-covers-history-session-recovery', runner.includes("scenario.id === 'browser-history-session-recovery'") && runner.includes('#browser-duplicate-tab') && runner.includes('#browser-reopen-closed-tab') && runner.includes('#browser-kit-history-list') && runner.includes('restore session was not available'));
check('runner-covers-tab-pinning-and-switching', runner.includes("scenario.id === 'browser-tab-pinning-and-switching'") && runner.includes('#browser-pin-tab') && runner.includes("page.keyboard.press('Control+Tab')") && runner.includes("page.keyboard.press('Control+Shift+Tab')") && runner.includes("page.keyboard.press('Control+1')"));
check('runner-waits-for-hit-target-readiness', runner.includes('waitForHitTarget(page,') && runner.includes("element.scrollIntoView({ block: 'center', inline: 'nearest' })"), 'live runner waits for Browser Kit cards to become hit-test ready before clicking');
check('runner-retries-fresh-profile-on-transient-failure', runner.includes('Retrying profile') && runner.includes('attempts: attempt') && runner.includes('for (let attempt = 1; attempt <= 2; attempt += 1)'), 'live runner retries a fresh Electron profile once when a profile-level pass hits transient UI timing noise');
check('runner-writes-machine-readable-evidence', runner.includes('pass345-blackbox-electron-release-e2e-result.json') && runner.includes('pass345-blackbox-electron-release-e2e-summary.md'));
check('runner-covers-profile-dialog-regression', runner.includes("'profile-switcher'") && runner.includes('#profile-dialog') && runner.includes("waitForOpenState(page, '#profile-dialog', true") && runner.includes('Profile dialog closed during restored-window settle'));
check('runner-covers-mission-export', runner.includes('#mission-pin-active-page') && runner.includes('mission-export-preview') && runner.includes('redaction-required-before-copy-save'));

check('docs-present-and-wired', docs.includes('npm run test:blackbox-e2e') && docs.includes('Playwright') && docs.includes('release-candidate/generated/pass345-blackbox-electron-release-e2e/'));

fs.mkdirSync(outDir, { recursive: true });
const report = {
  pass: 'PASS345',
  result: checks.every((entry) => entry.ok) ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
  checks,
};
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`PASS345_REPORT=${path.relative(root, outPath).replace(/\\/g, '/')}`);
if (report.result !== 'PASS') process.exit(1);
