#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^﻿/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const matrix = JSON.parse(read('tests/runtime/pass345-blackbox-electron-release-matrix.json'));
const runner = read('scripts/run-pass-345-blackbox-electron-release-e2e.mjs');
const docs = read('docs/qa/PASS347-BROWSER-TAB-PINNING-AND-PROFILE-DIALOG-STABILITY.md');
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

const scriptName = 'verify:pass-347-browser-tab-daily-driver-and-profile-dialog-stability';
const scriptCommand = 'node scripts/verify-pass-347-browser-tab-daily-driver-and-profile-dialog-stability.mjs';
const releaseContract = String(pkg.scripts?.['verify:release-blockers:contract'] || '');

check('package-script-present', pkg.scripts?.[scriptName] === scriptCommand, `${scriptName} must run ${scriptCommand}`);
check('release-contract-includes-pass347', releaseContract.includes(`npm run ${scriptName}`), 'PASS347 must be wired into the release blocker contract');
check('release-contract-order', ordered(releaseContract, 'verify:pass-346-browser-history-session-daily-driver', scriptName) && ordered(releaseContract, scriptName, 'npm run build'), 'PASS347 must follow PASS346 and complete before build/runtime runs');

check('body-marker-present', html.includes('data-pass347-browser-tab-daily-driver="true"'), 'renderer body declares the PASS347 contract');
check('browser-kit-tab-flow-dom-present', hasAll(html, ['id="browser-pin-tab"', 'id="browser-next-tab"', 'id="browser-previous-tab"', 'data-browser-kit-action="pin-tab"', 'data-browser-kit-action="next-tab"', 'data-browser-kit-action="previous-tab"']), 'Browser Kit renders tab pinning and tab cycling actions');

check('css-pass347-contract', css.includes('PASS347_BROWSER_TAB_DAILY_DRIVER_AND_PROFILE_DIALOG_STABILITY') && css.includes('.tab-pin') && css.includes('.tab.pinned') && css.includes('.profile-dialog[data-pass347-profile-dialog-viewport]'), 'loaded stylesheet carries PASS347 tab and profile dialog stability styles');
check('browser-kit-grid-layout-contract', hasAll(responsiveCss, ['body[data-pass347-browser-tab-daily-driver="true"] #browser-kit-panel', 'grid-template-columns: minmax(0, 1fr)', 'body[data-pass347-browser-tab-daily-driver="true"] #browser-kit-panel .tool-menu-section', 'grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))', 'overflow-x: hidden !important', '#browser-kit-history-list', '#browser-kit-closed-list', '[data-command-toolbar-scroll]', '[data-command-toolbar-back]']) && responsiveCss.includes('Browser Kit daily-driver panel'), 'responsive toolbar stylesheet preserves Browser Kit as a stacked panel with internal multi-row card grids instead of a shallow horizontal rail');

check('tab-model-and-ordering-functions-present', hasAll(app, ['pinned: boolean', 'type SessionRecoveryTabSnapshot', 'browserTabsInVisualOrder', 'reorderBrowserTabs', 'setActiveRelativeTab', 'activateTabByOrdinal', 'setBrowserTabPinned', 'toggleBrowserTabPin']), 'renderer owns pinned browser-tab state and visual-order routing');
check('session-recovery-persists-pinned-tabs', hasAll(app, ['currentSessionTabSnapshots()', 'tabs: tabsInSession', 'pinned: tab.pinned || undefined', 'if (entry.pinned) setBrowserTabPinned(createdTabId, true, \'restore-session\', false);']), 'session recovery stores and restores pinned browser tabs');
check('tab-button-markup-carries-pin-control', app.includes('<span class="tab-pin"') && app.includes('toggleBrowserTabPin(tabId, \'tab-button\')'), 'tab strip renders a dedicated pin hit target and routes it to the tab owner');

check('browser-kit-router-covers-pass347', hasAll(app, ["case 'pin-tab'", "case 'next-tab'", "case 'previous-tab'"]), 'Browser Kit action router covers pinning and tab switching');
check('browser-kit-avoids-command-rail-chrome', hasAll(app, ['toolMenuUsesCommandRail', "return name !== 'browser';", 'clearToolMenuCommandRailChrome(panel);', 'resetToolMenuScrollPosition(panel, \'open\')', 'resetToolMenuScrollPosition(panel, \'close\')', 'panel.tabIndex = -1;', 'panel.focus({ preventScroll: true })']) && app.includes('daily-driver actions ready'), 'Browser Kit renderer owner skips command-rail chevrons/back chrome, resets stale scroll state, and opens as a dedicated daily-driver surface without racing first-card focus');
check('browser-kit-static-buttons-bound-directly', hasAll(app, ['function bindBrowserKitStaticAction(buttonId: string)', "button.dataset.pass347BrowserKitDirectBound = 'true';", "button.addEventListener('click'", 'event.preventDefault();', 'event.stopPropagation();', "'browser-close-tab'", "'browser-pin-tab'", "'browser-reopen-closed-tab'", "'browser-restore-session'"]), 'static Browser Kit daily-driver buttons have direct click bindings in addition to delegated panel handling');
check('tool-card-activation-path-hardened', hasAll(app, ['PASS345_TOOL_CARD_ACTIVATION_DEDUPE_MS', 'pass345RunToolCardAction', "button.dataset.pass345ToolCardPointerArmed", "button.addEventListener('pointerup'", "button.addEventListener('keydown'", "pass345RunToolCardAction(button, action, 'pointerup')", "pass345RunToolCardAction(button, action, 'click')"]), 'tool cards use a deduped primary-pointer release path plus click/keyboard activation so DevOps and IT dialogs still open when Chromium drops a final click on a hit-test-ready card');
check('browser-kit-tooltip-enrichment-idempotent', hasAll(app, ['function toolCardTooltipBaseTitle', 'card.dataset.pass347ToolCardTooltipBase = base;', 'rawTitle.startsWith(prefix)', 'base === title ? `${title} (${shortcut})`'], 'Browser Kit tooltip enrichment stays idempotent across history/session rerenders and does not keep re-wrapping titles'));
check('menu-router-covers-pass347', hasAll(app, ["if (command === 'pin-tab')", "if (command === 'next-tab')", "if (command === 'previous-tab')"]), 'renderer menu command router handles PASS347 commands');
check('native-menu-covers-pass347', hasAll(main, ["sendMenuCommand(window, 'pin-tab')", "sendMenuCommand(window, 'next-tab')", "sendMenuCommand(window, 'previous-tab')"]), 'native History menu routes PASS347 commands to the renderer owner');
check('keyboard-shortcuts-carry-pass347', hasAll(app, ["event.key === 'Tab'", 'setActiveRelativeTab(event.shiftKey ? -1 : 1', 'activateTabByOrdinal(Number(event.key)', "event.altKey && event.shiftKey && event.key.toLowerCase() === 'f'"]), 'keyboard routing covers Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1..9, and pin-tab toggle');

check('profile-dialog-hardening-present', hasAll(app, ['PASS347_BROWSER_TAB_DAILY_DRIVER_AND_PROFILE_DIALOG_STABILITY', 'PASS347_PROFILE_DIALOG_EXTRA_SETTLE_MS', 'pass347RepairProfileDialogViewport', 'deferred-profile-dialog-repair', 'profile-open-after-refresh']), 'profile dialog viewport repair and extra settle guard exist in the renderer owner');

check('blackbox-matrix-covers-pass347', Array.isArray(matrix.scenarios) && matrix.scenarios.some((entry) => entry.id === 'browser-tab-pinning-and-switching'), 'PASS345 black-box matrix includes browser tab pinning and switching');
check('blackbox-runner-covers-pass347', hasAll(runner, ["scenario.id === 'browser-tab-pinning-and-switching'", '#browser-pin-tab', "page.keyboard.press('Control+Tab')", "page.keyboard.press('Control+Shift+Tab')", "page.keyboard.press('Control+1')"]) && runner.includes('Profile dialog closed during restored-window settle'), 'built-app Playwright runner proves PASS347 tab flow and restored-window profile dialog stability');
check('runtime-harness-covers-pass347', hasAll(app, ["await step('tab-pinning-and-switching'", '#browser-pin-tab', "active tab did not become pinned", 'Ctrl+Shift+Tab did not return to the pinned tab', 'Ctrl+1 did not focus the first visible tab']), 'PASS158 runtime harness exercises pinning and keyboard tab flow');

check('security-guardrails-preserved', !/(<webview[^>]*allowpopups|setAttribute\(['"]allowpopups|\sallowpopups\s*=)/i.test(app + html + main) && !/nodeIntegration:\s*true/i.test(app + main) && !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/i.test(preload), 'PASS347 does not weaken popup, Node, or IPC boundaries');
check('no-direct-psa-provider-secret-patterns', !/(psa|connectwise|autotask|halo|syncro|kaseya|datto)[_-]?(api[_-]?key|secret|token)\s*[:=]/i.test(app + main + html + preload), 'PASS347 adds no PSA/provider secret patterns');
check('qa-doc-present', exists('docs/qa/PASS347-BROWSER-TAB-PINNING-AND-PROFILE-DIALOG-STABILITY.md'), 'QA note documents PASS347 scope and acceptance');

const result = findings.every((entry) => entry.ok) ? 'PASS' : 'FAIL';
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, 'pass347-browser-tab-daily-driver-and-profile-dialog-stability-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ pass: 'PASS347', result, generatedAt: new Date().toISOString(), findings }, null, 2));
console.log(`PASS347_VERIFY_RESULT=${result}`);
console.log(`PASS347_REPORT=${path.relative(root, reportPath).replace(/\\/g, '/')}`);
process.exit(result === 'PASS' ? 0 : 1);
