#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^﻿/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const matrix = JSON.parse(read('tests/runtime/pass345-blackbox-electron-release-matrix.json'));
const runner = read('scripts/run-pass-345-blackbox-electron-release-e2e.mjs');
const docs = read('docs/qa/PASS345-BLACKBOX-ELECTRON-RELEASE-E2E.md');
const findings = [];

function check(id, ok, detail = '') {
  findings.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' - ' + detail : ''}`);
}

function ordered(source, first, second) {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}

function hasAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

const scriptName = 'verify:pass-346-browser-history-session-daily-driver';
const scriptCommand = 'node scripts/verify-pass-346-browser-history-session-daily-driver.mjs';
const releaseContract = String(pkg.scripts?.['verify:release-blockers:contract'] || '');

check('package-script-present', pkg.scripts?.[scriptName] === scriptCommand, `${scriptName} must run ${scriptCommand}`);
check('release-contract-includes-pass346', releaseContract.includes(`npm run ${scriptName}`), 'PASS346 must be wired into the release blocker contract');
check('release-contract-order', ordered(releaseContract, 'verify:pass-345-blackbox-electron-release-e2e', 'verify:pass-346-browser-history-session-daily-driver') && ordered(releaseContract, 'verify:pass-346-browser-history-session-daily-driver', 'npm run build'), 'PASS346 must follow PASS345 static verification and complete before build/runtime runs');

check('body-marker-present', html.includes('data-pass346-browser-history-session-daily-driver="true"'), 'renderer body declares the PASS346 contract');
check('browser-kit-history-dom-present', hasAll(html, ['id="browser-duplicate-tab"', 'id="browser-reopen-closed-tab"', 'id="browser-restore-session"', 'id="browser-kit-history-list"', 'id="browser-kit-closed-list"']), 'Browser Kit renders the new history/session controls and dynamic hosts');
check('browser-kit-history-actions-declared', ['duplicate-tab', 'reopen-closed-tab', 'restore-session'].every((action) => html.includes(`data-browser-kit-action="${action}"`)), 'Browser Kit recovery cards expose deterministic action ids');

check('css-pass346-contract', css.includes('PASS346_BROWSER_HISTORY_SESSION_DAILY_DRIVER') && css.includes('.browser-kit-dynamic-list') && css.includes('.browser-kit-history-card') && css.includes('.tool-card[disabled]'), 'loaded stylesheet carries PASS346 daily-driver styles');

check('storage-keys-present', hasAll(app, ['browserHistoryStorageKeyPrefix', 'recentlyClosedStorageKeyPrefix', 'sessionRecoveryStorageKeyPrefix']), 'renderer owns per-profile history, recently-closed, and session snapshot storage');
check('history-session-functions-present', ['renderBrowserKitDailyDriver', 'recordBrowserHistoryEntry', 'refreshBrowserHistoryEntryTitle', 'recordRecentlyClosedTab', 'persistSessionRecoverySnapshot', 'restoreSessionRecoverySnapshot', 'duplicateActiveTab', 'reopenClosedTab'].every((name) => app.includes(`function ${name}`)), 'single-source history/session owner functions exist');
check('lifecycle-calls-present', hasAll(app, ["scheduleSessionRecoverySnapshot('set-active')", "scheduleSessionRecoverySnapshot('close-tab')", "scheduleSessionRecoverySnapshot('create-tab')", "scheduleSessionRecoverySnapshot('navigate')", "recordBrowserHistoryEntry(safeUrl, tab.title, 'create-tab')", "recordBrowserHistoryEntry(safeNavigatedUrl, titleFromUrl(safeNavigatedUrl), 'navigate')", 'recordRecentlyClosedTab(tab)', 'renderBrowserKitDailyDriver();']), 'history/session truth is refreshed from tab create/close/route/profile owners');
check('profile-switch-persists-session', app.includes("persistSessionRecoverySnapshot('profile-switch-before-close')") && app.includes('renderProfileBadge();'), 'profile switching snapshots the old session and repaints Browser Kit for the new profile');
check('browser-kit-action-router-covers-pass346', hasAll(app, ["case 'duplicate-tab'", "case 'reopen-closed-tab'", "case 'restore-session'", "case 'open-history-entry'", "case 'reopen-closed-entry'"]), 'Browser Kit action router covers recovery and history entry actions');
check('browser-kit-panel-delegation-carries-datasets', app.includes('runBrowserKitAction(button.dataset.browserKitAction, button.dataset);'), 'delegated Browser Kit click handler forwards entry ids for dynamic lists');

check('menu-router-covers-pass346', hasAll(app, ["if (command === 'duplicate-tab')", "if (command === 'reopen-closed-tab')", "if (command === 'restore-session')"]), 'renderer menu command router handles PASS346 commands');
check('native-menu-covers-pass346', hasAll(main, ["sendMenuCommand(window, 'reopen-closed-tab')", "sendMenuCommand(window, 'duplicate-tab')", "sendMenuCommand(window, 'restore-session')"]), 'native History menu routes PASS346 commands to the renderer owner');
check('keyboard-shortcuts-carry-pass346', hasAll(app, ['Ctrl+Shift+T', 'Ctrl+Alt+Shift+T', 'reopenClosedTab(); return;', 'duplicateActiveTab(); return;']), 'keyboard and shortcut-copy layers carry reopen/duplicate tab flows');
check('command-palette-carries-pass346', ["id: 'duplicate-tab'", "id: 'reopen-closed-tab'", "id: 'restore-session'"].every((token) => app.includes(token)), 'Command Palette exposes the new daily-driver recovery actions');

check('blackbox-matrix-covers-pass346', Array.isArray(matrix.scenarios) && matrix.scenarios.some((entry) => entry.id === 'browser-history-session-recovery'), 'PASS345 black-box matrix now includes history/session recovery');
check('blackbox-runner-covers-pass346', hasAll(runner, ["scenario.id === 'browser-history-session-recovery'", '#browser-duplicate-tab', '#browser-reopen-closed-tab', '#browser-kit-history-list', 'restore session was not available']), 'built-app Playwright runner proves history/session recovery from real UI input');
check('pass345-docs-updated', docs.includes('Browser Kit history/session recovery'), 'PASS345 QA doc reflects the new black-box coverage');

check('non-destructive-session-restore', app.includes('if (existing.has(url)) continue;') && app.includes("setStatus(createdTabIds.length ? 'Session restored' : 'Session already open'"), 'session restore appends missing tabs instead of destructively replacing the active workspace');
check('security-guardrails-preserved', !/(<webview[^>]*allowpopups|setAttribute\(['"]allowpopups|\sallowpopups\s*=)/i.test(app + html + main) && !/nodeIntegration:\s*true/i.test(app + main) && !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/i.test(preload), 'PASS346 does not weaken popup, Node, or IPC boundaries');
check('no-direct-psa-provider-secret-patterns', !/(psa|connectwise|autotask|halo|syncro|kaseya|datto)[_-]?(api[_-]?key|secret|token)\s*[:=]/i.test(app + main + html + preload), 'PASS346 adds no PSA/provider secret patterns');
check('qa-doc-present', exists('docs/qa/PASS346-BROWSER-HISTORY-SESSION-DAILY-DRIVER.md'), 'QA note documents PASS346 scope and acceptance');

const result = findings.every((entry) => entry.ok) ? 'PASS' : 'FAIL';
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, 'pass346-browser-history-session-daily-driver-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ pass: 'PASS346', result, generatedAt: new Date().toISOString(), findings }, null, 2));
console.log(`PASS346_VERIFY_RESULT=${result}`);
console.log(`PASS346_REPORT=${path.relative(root, reportPath).replace(/\\/g, '/')}`);
process.exit(result === 'PASS' ? 0 : 1);
