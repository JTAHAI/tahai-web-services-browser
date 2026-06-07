#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/webview-focus-input-boundary-contract.ts');
const electronSecurity = read('src/shared/electron-security-contract.ts');
const preload = read('src/preload/preload.ts');
const globalTypes = read('src/renderer/global.d.ts');
const main = read('src/main/main.ts');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const doc = read('docs/pass-188-webview-focus-input-boundary.md');
const summary = read('PASS_188_WEBVIEW_FOCUS_INPUT_BOUNDARY_SUMMARY.md');

ok(pkg.version === '1.8.30', 'PASS188 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-188-webview-focus-input-boundary'] === 'node scripts/verify-pass-188-webview-focus-input-boundary.mjs', 'package.json exposes PASS188 verifier.');
ok(getReleaseBlockersContract(pkg).includes('verify:pass-188-webview-focus-input-boundary'), 'release-blockers chain includes PASS188 verifier.');

for (const token of [
  'PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION',
  'pass188-webview-focus-input-boundary-v1',
  'Pass188FocusSurface',
  'Pass188InputBoundaryCommand',
  'Pass188InputBoundaryPayload',
  'PASS188_FOCUS_INPUT_BOUNDARY_COMMANDS',
  'PASS188_FOCUS_INPUT_BOUNDARY_SURFACES',
  'PASS188_FOCUS_INPUT_BOUNDARY_MATRIX',
  'pass188NormalizeBeforeInputCommand',
  'pass188FocusInputBoundaryCaseIds',
  'webview-guest',
  'focus-address',
  'command-palette',
  'history-back',
  'history-forward',
  'mission-pane-1',
  'mission-pane-4',
  'Ctrl/Cmd+L',
  'Ctrl/Cmd+K',
  'Ctrl/Cmd+Alt+1..4'
]) ok(contract.includes(token), `PASS188 contract missing token: ${token}`);

const caseCount = (contract.match(/id: 'pass188-/g) || []).length;
ok(caseCount >= 9, `PASS188 matrix must include at least 9 focus/input cases; found ${caseCount}.`);

for (const token of [
  "'tahai-browser:pass188-input-boundary'",
  'TahaiTrustedRendererEventChannel'
]) ok(electronSecurity.includes(token), `PASS188 trusted channel missing token: ${token}`);

for (const token of [
  'Pass188InputBoundaryPayload',
  'onPass188InputBoundary',
  "ipcRenderer.on('tahai-browser:pass188-input-boundary'",
  "ipcRenderer.removeListener('tahai-browser:pass188-input-boundary'"
]) ok(preload.includes(token), `PASS188 preload bridge missing token: ${token}`);

for (const token of [
  'Pass188InputBoundaryPayload',
  'onPass188InputBoundary'
]) ok(globalTypes.includes(token), `PASS188 renderer global type missing token: ${token}`);

for (const token of [
  'PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION',
  'pass188NormalizeBeforeInputCommand',
  'installPass188WebContentsInputBoundary',
  "contents.on('before-input-event'",
  'pass188ForwardInputBoundaryCommand',
  "sendTrustedRendererEvent(targetWindow, 'tahai-browser:pass188-input-boundary'",
  'fromGuest: source === \'webview-guest\'',
  'installPass188WebContentsInputBoundary(contents)',
  'installPass188WebContentsInputBoundary(window.webContents)'
]) ok(main.includes(token), `PASS188 main process boundary missing token: ${token}`);

for (const token of [
  "from '../shared/webview-focus-input-boundary-contract'",
  'Pass188FocusBoundaryEvent',
  'pass188RecordFocusBoundary',
  'pass188RepairFocusInputBoundaries',
  'pass188BindWebviewFocusInputBoundary',
  'pass188HandleInputBoundaryPayload',
  'pass188MountFocusInputBoundary',
  'document.body.dataset.pass188WebviewFocusInputBoundary',
  'document.body.dataset.pass188LastInputBoundaryCommand',
  'webview.dataset.pass188ShellShortcutRecovery',
  'addressInput.dataset.pass188ShellAccelerator',
  'window.tahaiBrowser.onPass188InputBoundary',
  'pass188BindWebviewFocusInputBoundary(webview, tabId)',
  'pass188MountFocusInputBoundary()'
]) ok(app.includes(token), `PASS188 renderer boundary missing token: ${token}`);

for (const token of [
  'PASS188 WebView Focus/Input Boundary Hardening',
  '[data-pass188-focus-input-boundary="webview-guest"]',
  'body[data-pass188-last-focus-surface="webview-guest"]'
]) ok(css.includes(token), `PASS188 CSS missing token: ${token}`);

for (const token of [
  'PASS188',
  'WebView Focus and Input Boundary Hardening',
  'Ctrl/Cmd+L',
  'Ctrl/Cmd+K',
  'Ctrl/Cmd+Alt+1..4',
  'Remote content remains untrusted',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS188 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS188: 37'), 'PASS188 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS188 docs must not contain TODO markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS188][FAIL] WebView focus/input boundary verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS188][OK] WebView focus/input boundary verified.');
