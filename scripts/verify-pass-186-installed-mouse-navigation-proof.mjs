#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

const pkg = JSON.parse(read('package.json'));
const expectedVersion = '2.0.18';
const contract = read('src/shared/installed-mouse-navigation-proof-contract.ts');
const runner = read('scripts/run-pass186-installed-mouse-navigation-proof.ps1');
const verifier = read('scripts/verify-pass-186-installed-mouse-navigation-proof.mjs');
const pass185Verifier = read('scripts/verify-pass-185-mouse-history-button-parity.mjs');
const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const doc = read('docs/pass-186-installed-mouse-navigation-proof.md');
const summary = read('PASS_186_INSTALLED_MOUSE_NAVIGATION_PROOF_SUMMARY.md');

ok(pkg.version === expectedVersion, `PASS186 version must remain ${expectedVersion}; found ${pkg.version}.`);
ok(pkg.scripts?.['proof:pass-186-installed-mouse-navigation']?.includes('run-pass186-installed-mouse-navigation-proof.ps1'), 'package.json exposes PASS186 installed proof runner.');
ok(pkg.scripts?.['verify:pass-186-installed-mouse-navigation-proof'] === 'node scripts/verify-pass-186-installed-mouse-navigation-proof.mjs', 'package.json exposes PASS186 verifier.');
ok(getReleaseBlockersContract(pkg).includes('verify:pass-186-installed-mouse-navigation-proof'), 'release-blockers chain includes PASS186 verifier.');

for (const token of [
  'PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_VERSION',
  'Pass186NavigationSurface',
  'Pass186NavigationInput',
  'Pass186ProofExpectation',
  'PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_CASES',
  'normal-active-tab',
  'focused-webview',
  'split-active-pane',
  'tri-view-active-pane',
  'quad-active-pane',
  'menu-command',
  'address-bar',
  'mouse-button-4-back',
  'mouse-button-5-forward',
  'toolbar-back',
  'toolbar-forward',
  'alt-left',
  'alt-right',
  'menu-back',
  'menu-forward',
  'address-submit',
  'targets-active-tab',
  'targets-focused-webview-host-tab',
  'targets-active-mission-pane',
  'safe-noop-when-history-unavailable',
  'does-not-double-navigate',
  'does-not-target-hidden-pane',
  'does-not-break-address-routing',
  'PASS186_REQUIRED_INSTALLED_PROOF_COUNT',
  'pass186InstalledMouseNavigationProofIds'
]) ok(contract.includes(token), `PASS186 contract missing token: ${token}`);

const proofCaseCount = (contract.match(/id: 'pass186-/g) || []).length;
ok(proofCaseCount >= 13, `PASS186 contract must include at least 13 proof cases; found ${proofCaseCount}.`);

for (const token of [
  'Installed Mouse Navigation Proof Harness',
  'pass186-installed-mouse-navigation-proof',
  'TAHAI Web Services Browser.exe',
  'PASS186 proof harness expected at least 12 installed navigation cases',
  'Do not claim PASS186 installed behavior complete until every proof case is marked PASS',
  'UNTESTED',
  'operatorInitials',
  'observedTarget',
  'PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_JSON',
  'PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_MD',
  'Installed EXE was not found'
]) ok(runner.includes(token), `PASS186 PowerShell proof runner missing token: ${token}`);

for (const token of [
  'pass185RouteMouseHistoryButton',
  "goBackTarget('mouse')",
  "goForwardTarget('mouse')",
  'pass185BindWebviewMouseHistoryRouting',
  'pass88ScheduleActivePaneRoutingFailsafe',
  "document.body.dataset.pass185MouseHistoryParity = 'shell-and-webview'",
  "window.addEventListener('mouseup'",
  "window.addEventListener('auxclick'",
  "webview.addEventListener('mousedown'",
  "webview.addEventListener('mouseup'",
  "webview.addEventListener('auxclick'",
  "event.altKey && event.key === 'ArrowLeft'",
  "event.altKey && event.key === 'ArrowRight'",
  "backButton.addEventListener('click', () => goBackTarget('toolbar'))",
  "forwardButton.addEventListener('click', () => goForwardTarget('toolbar'))",
  "navigate(addressInput.value, 'address')",
  "command === 'back'",
  "command === 'forward'"
]) ok(app.includes(token), `PASS186 requires PASS185/PASS134 renderer navigation token: ${token}`);

for (const token of [
  'pass185RouteBrowserHistoryAppCommand',
  'pass185WindowForHistoryAppCommand',
  'hostWebContents',
  'BrowserWindow.getFocusedWindow()',
  "contents.setWindowOpenHandler(() => ({ action: 'deny' }))",
  "on('app-command'",
  "window.on('app-command'",
  'sendMenuCommand(targetWindow, direction)'
]) ok(main.includes(token), `PASS186 requires main-process app-command token: ${token}`);

ok(pass185Verifier.includes('Mouse Button 4/5') && pass185Verifier.includes('active Mission pane'), 'PASS186 must preserve PASS185 verifier coverage.');
ok(!runner.includes('SendKeys') && !runner.includes('mouse_event') && !runner.includes('SetCursorPos'), 'PASS186 proof harness must not fake mouse hardware input.');
ok(!runner.includes('Invoke-WebRequest') && !runner.includes('curl '), 'PASS186 proof harness must not depend on network calls.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS186 docs must not contain TODO markers.');
ok(runner.includes(`versionExpectation = "${expectedVersion}"`), 'PASS186 PowerShell proof runner must target current version.');
ok(doc.includes('PASS186') && doc.includes('Installed Mouse Navigation Proof Harness') && doc.includes('Mouse Button 4/5') && doc.includes('Toolbar Back/Forward') && doc.includes('Alt+Left/Alt+Right') && doc.includes('active Mission pane') && doc.includes(`Version remains \`${expectedVersion}\``), 'PASS186 doc must describe installed mouse navigation proof scope.');
ok(summary.includes('PASS186') && summary.includes(`Version remains \`${expectedVersion}\``) && summary.includes('proof:pass-186-installed-mouse-navigation') && summary.includes('39'), 'PASS186 summary missing closeout markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS186][FAIL] Installed mouse navigation proof verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS186][OK] Installed mouse navigation proof harness verified.');
