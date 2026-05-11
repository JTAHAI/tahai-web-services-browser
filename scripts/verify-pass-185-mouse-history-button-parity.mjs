#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

const main = read('src/main/main.ts');
const renderer = read('src/renderer/app.ts');
const html = read('src/renderer/index.html');
const pkg = JSON.parse(read('package.json'));
const doc = read('docs/pass-185-mouse-history-button-parity.md');
const summary = read('PASS_185_MOUSE_HISTORY_BUTTON_PARITY_SUMMARY.md');

ok(pkg.version === '1.8.30', 'PASS185 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-185-mouse-history-button-parity'] === 'node scripts/verify-pass-185-mouse-history-button-parity.mjs', 'package.json exposes PASS185 verifier.');
ok(html.includes('data-pass185-mouse-history-parity="true"'), 'HTML boot state advertises PASS185 mouse history parity.');

for (const token of [
  'type Pass185BrowserHistoryCommand',
  'pass185NormalizeBrowserHistoryAppCommand',
  "normalized === 'browser-backward'",
  "normalized === 'browser-forward'",
  'pass185WindowForHistoryAppCommand',
  'hostWebContents',
  'BrowserWindow.getFocusedWindow()',
  'pass185RouteBrowserHistoryAppCommand',
  'pass185LastMainMouseHistoryRouteAt',
  "contents.setWindowOpenHandler(() => ({ action: 'deny' }))",
  "on('app-command'",
  'hardware mouse Button 4/5 can surface as an app-command',
  'window.on(\'app-command\'',
  'sendMenuCommand(targetWindow, direction)'
]) ok(main.includes(token), `main process missing PASS185 token: ${token}`);

for (const token of [
  'type Pass185MouseHistorySource',
  "'webview-mousedown'",
  "'webview-mouseup'",
  "'webview-auxclick'",
  'pass185MouseHistoryDirection',
  'event.button === 3',
  'event.button === 4',
  'pass185RouteMouseHistoryButton',
  'event.stopImmediatePropagation',
  'pass185MouseHistoryDeduped',
  'setActive(tabId)',
  "goBackTarget('mouse')",
  "goForwardTarget('mouse')",
  'pass185LastMouseHistorySource',
  'pass185BindWebviewMouseHistoryRouting',
  "webview.addEventListener('mousedown'",
  "webview.addEventListener('mouseup'",
  "webview.addEventListener('auxclick'",
  'pass185MouseHistoryRouting',
  'pass185BindWebviewMouseHistoryRouting(webview, tabId)',
  "document.body.dataset.pass185MouseHistoryParity = 'shell-and-webview'"
]) ok(renderer.includes(token), `renderer missing PASS185 token: ${token}`);

ok(!main.includes('globalShortcut.register'), 'PASS185 must not use global shortcuts for mouse buttons.');
ok(!renderer.includes('ipcRenderer'), 'PASS185 must not add raw IPC in renderer.');
ok(!renderer.includes('executeJavaScript(\'window.addEventListener') && !renderer.includes('executeJavaScript(\"window.addEventListener'), 'PASS185 must not inject mouse handlers into remote pages.');
ok(!html.includes('onclick='), 'PASS185 must not add inline handlers.');
ok(doc.includes('PASS185') && doc.includes('Mouse Button 4/5') && doc.includes('active Mission pane') && doc.includes('Version remains `1.8.30`'), 'PASS185 doc must describe mouse history parity.');
ok(summary.includes('PASS185') && summary.includes('Version remains `1.8.30`') && summary.includes('Mouse Button 4/5'), 'PASS185 summary missing closeout markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS185][FAIL] Mouse history button parity verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS185][OK] Mouse history button parity verified.');
