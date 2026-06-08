#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const css = read('src/renderer/styles/browser.css');
const preload = read('src/preload/preload.ts');
const runtimeHarness = read('src/shared/runtime-e2e-harness-contract.ts');
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

function functionBody(name) {
  const marker = `function ${name}`;
  const start = app.indexOf(marker);
  if (start < 0) return '';
  const next = app.indexOf('\nfunction ', start + marker.length);
  return app.slice(start, next < 0 ? app.length : next);
}

const scriptName = 'verify:pass-343-it-devops-priority-browser-kit';
const scriptCommand = 'node scripts/verify-pass-343-it-devops-priority-browser-kit.mjs';
const releaseContract = pkg.scripts?.['verify:release-blockers:contract'] || '';

check('package-script-present', pkg.scripts?.[scriptName] === scriptCommand, `${scriptName} must run ${scriptCommand}`);
check('release-blockers-contract-includes-pass343', releaseContract.includes(`npm run ${scriptName}`), 'PASS343 must be in the enterprise release-blocker contract');
check('release-blockers-order', ordered(releaseContract, 'verify:pass-342-restored-window-profile-dialog-closeout', 'verify:pass-343-it-devops-priority-browser-kit') && ordered(releaseContract, 'verify:pass-343-it-devops-priority-browser-kit', 'npm run build'), 'PASS343 runs after PASS342 and before build/runtime E2E');

check('loaded-stylesheet-pass343-contract', css.includes('PASS343_IT_DEVOPS_PRIORITY_BROWSER_KIT') && html.includes('<link rel="stylesheet" href="./styles/browser.css"'), 'loaded browser.css carries the PASS343 clickability/product contract');
check('body-marker-present', html.includes('data-pass343-it-devops-priority-browser-kit="true"'), 'renderer body declares the PASS343 feature contract');
check('it-devops-priority-dom-order', ordered(html, 'id="devops-tools"', 'id="it-tools"') && ordered(html, 'id="it-tools"', 'id="browser-kit"'), 'DevOps and IT remain ahead of Browser Kit in toolbar DOM order');

const browserKitIds = [
  'browser-kit', 'browser-kit-panel', 'browser-new-tab', 'browser-close-tab', 'browser-find', 'browser-print',
  'browser-copy-url', 'browser-open-external', 'browser-bookmarks', 'browser-downloads',
  'browser-zoom-out', 'browser-zoom-reset', 'browser-zoom-in'
];
check('browser-kit-dom-ids-present', browserKitIds.every((id) => html.includes(`id="${id}"`)), 'Browser Kit button, panel, and cards are present');
check('find-bar-dom-present', ['find-bar', 'find-input', 'find-prev', 'find-next', 'find-status', 'find-close'].every((id) => html.includes(`id="${id}"`)), 'Find bar controls are present');
check('browser-kit-actions-declared', ['new-tab', 'close-tab', 'find', 'print', 'copy-url', 'open-external', 'bookmarks', 'downloads', 'zoom-out', 'zoom-reset', 'zoom-in'].every((action) => html.includes(`data-browser-kit-action="${action}"`)), 'Browser Kit cards declare deterministic action IDs');

check('css-no-drag-pointer-contract', hasAll(css, ['#browser-kit', '#find-bar', 'pointer-events: auto !important', '-webkit-app-region: no-drag !important']), 'Browser Kit and Find are explicit no-drag/pointer-events-auto surfaces when visible');
check('css-hidden-inert-contract', hasAll(css, ['#browser-kit-panel[hidden]', '#find-bar[hidden]', 'pointer-events: none !important']), 'Hidden Browser Kit and Find surfaces are inert');
check('css-stage-below-chrome', css.includes('#webview-stage') && css.includes('z-index: 0 !important') && css.includes('z-index: 2147483000 !important'), 'webview stage remains below browser chrome');

check('tool-menu-type-includes-browser', app.includes("type ToolMenuName = PrimaryToolMenuName | 'browser'") && app.includes("['devops', 'it', 'browser'] as ToolMenuName[]"), 'overlay tool menu type and close loop include Browser Kit');
check('last-tool-lane-stays-it-devops', app.includes("if (name === 'browser') return;") && app.includes("function lastToolLane(): PrimaryToolMenuName"), 'Browser Kit does not overwrite the last DevOps/IT lane preference');
check('overlay-owners-include-browser-kit', app.includes('browserKitPanel && !browserKitPanel.hidden') && app.includes('devopsToolsPanel, itToolsPanel, browserKitPanel'), 'PASS118/PASS122 overlay owners include Browser Kit');
check('input-boundary-includes-browser-kit', app.includes('browserKitButton, newTabButton') && app.includes('panel === browserKitPanel ?') && app.includes('findBar].filter(Boolean)'), 'PASS188 focus/input boundary includes Browser Kit and Find');

check('webview-command-contracts', hasAll(app, ["'findInPage'", "'stopFindInPage'", "'setZoomFactor'", 'pass343SafeFindInPage', 'pass343SafeStopFindInPage']), 'safe webview command lifecycle covers Find and Zoom');
check('browser-kit-functions-present', ['setActivePageZoom', 'copyActivePageUrl', 'openActivePageExternally', 'openBrowserBookmarks', 'focusDownloadArtifacts', 'openFindBar', 'closeFindBar', 'runFindInPage', 'runBrowserKitAction'].every((name) => app.includes(`function ${name}`)), 'single-source Browser Kit action functions exist');
check('browser-kit-actions-route-active-target', hasAll(functionBody('pass343ActiveTarget'), ['activeNavigationTarget(intent)']) && hasAll(functionBody('setActivePageZoom'), ["pass343ActiveTarget('zoom')", 'setZoomFactor']), 'Browser Kit webview actions target active tab or active Mission pane');

check('direct-listeners-present', hasAll(app, ['browserKitButton.addEventListener', 'browserKitPanel.addEventListener', "button[data-browser-kit-action]", 'findInput.addEventListener', 'findPrevButton.addEventListener', 'findNextButton.addEventListener', 'findCloseButton.addEventListener']), 'Browser Kit and Find controls have direct/delegated listeners');
check('keyboard-shortcuts-present', hasAll(app, ["event.key.toLowerCase() === 'f'", "event.key.toLowerCase() === 'p'", "event.key.toLowerCase() === 'u'", "event.key === '-'", "event.key === '0'", "event.code === 'Period'"]), 'daily-driver shortcuts are handled by renderer owners');

const handleMenu = functionBody('handleMenuCommand');
check('menu-command-router-present', ['open-browser-kit', 'find-page', 'copy-url', 'open-external', 'bookmarks', 'downloads', 'zoom-in', 'zoom-out', 'zoom-reset'].every((token) => handleMenu.includes(`'${token}'`)), 'renderer menu command router handles Browser Kit commands');
check('native-menu-routes-browser-kit', hasAll(main, ["sendMenuCommand(window, 'find-page')", "sendMenuCommand(window, 'open-browser-kit')", "sendMenuCommand(window, 'zoom-in')", "sendMenuCommand(window, 'zoom-out')", "sendMenuCommand(window, 'zoom-reset')", "sendMenuCommand(window, 'copy-url')", "sendMenuCommand(window, 'open-external')"]), 'native app menu routes daily-driver commands to renderer owners');
check('command-palette-actions-present', ['browser-kit-menu', 'find-page', 'print-page', 'copy-url', 'open-external', 'browser-bookmarks', 'browser-downloads', 'zoom-in', 'zoom-out', 'zoom-reset'].every((id) => app.includes(`id: '${id}'`)), 'Command Palette exposes Browser Kit commands');
check('command-palette-priority-order', ordered(app, "id: 'devops-menu'", "id: 'it-menu'") && ordered(app, "id: 'it-menu'", "id: 'browser-kit-menu'"), 'Command Palette keeps DevOps/IT before Browser Kit');

check('pass341-closeout-includes-browser-kit', browserKitIds.every((id) => app.includes(`'${id}'`)) && app.includes("'#browser-kit-panel[hidden]'") && app.includes("'#find-bar[hidden]'"), 'PASS341 clickability closeout includes Browser Kit controls and hidden inertness');
check('runtime-e2e-clicks-browser-kit', hasAll(app, ['#browser-kit', 'Browser Kit panel did not open', '#browser-find', 'Find bar did not open from Browser Kit']), 'runtime E2E opens/closes Browser Kit and Find');
check('runtime-e2e-contract-list-unchanged', runtimeHarness.includes('shell-overlays-open-close'), 'runtime E2E scenario contract still covers shell overlays');

check('qa-doc-present', exists('docs/qa/PASS343-IT-DEVOPS-PRIORITY-BROWSER-KIT.md'), 'QA note documents Browser Kit scope and acceptance');
check('no-unsafe-allowpopups-added', !/(<webview[^>]*allowpopups|setAttribute\(['"]allowpopups|\sallowpopups\s*=)/i.test(app + main + html), 'webviews still do not enable unsafe allowpopups');
check('no-node-in-remote-content-added', !/nodeIntegration:\s*true/i.test(main + app), 'remote web content still has Node disabled');
check('no-raw-ipc-exposure-added', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/i.test(preload), 'preload still exposes only narrowed bridge methods');
check('safe-external-open-only', main.includes('safeOpenExternal(url)') && !/shell\.openExternal\((?!safe)/.test(main), 'external open remains behind the safe main-process boundary');
check('no-direct-psa-provider-secret-patterns', !/(psa|connectwise|autotask|halo|syncro|kaseya|datto)[_-]?(api[_-]?key|secret|token)\s*[:=]/i.test(app + main + preload + html), 'browser source does not introduce direct PSA/provider secrets');
check('pass271-r4-remains-opt-in', pkg.scripts?.['verify:pass-271-r4-dev-runtime-window-webview-hard-repair'] && app.includes('TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR') && app.includes("=== '1'") && app.includes('PASS271_R4 normal-webview hard repair is opt-in'), 'PASS271_R4 remains opt-in only');
check('pass271-r8-r9-white-high-z-css-not-returned', !/PASS271_R[89][\s\S]{0,240}(white|#fff|999999|2147483647)/i.test(css), 'loaded stylesheet does not reintroduce PASS271_R8/R9 white/high-z-index CSS');

const result = findings.every((entry) => entry.ok) ? 'PASS' : 'FAIL';
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, 'pass343-it-devops-priority-browser-kit-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ pass: 'PASS343', result, generatedAt: new Date().toISOString(), findings }, null, 2));
console.log(`PASS343_VERIFY_RESULT=${result}`);
console.log(`PASS343_REPORT=${path.relative(root, reportPath).replace(/\\/g, '/')}`);
process.exit(result === 'PASS' ? 0 : 1);
