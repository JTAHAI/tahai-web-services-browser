#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
function check(id, ok, detail) { checks.push({ id, ok: Boolean(ok), detail }); }

check('pass340-runtime-owner-installed', app.includes('PASS340_CHROME_INPUT_HITTEST_CLOSEOUT_START') && app.includes('function pass340RecoverChromeInput'), 'renderer owns bounded chrome input hit-test closeout');
check('pass340-chrome-controls-covered', app.includes('#back') && app.includes('#devops-tools') && app.includes('#mission-control-toggle') && app.includes('#settings') && app.includes('#new-tab'), 'primary browser chrome controls are sampled');
check('pass340-webview-contained-to-stage', app.includes('pass340ForceNormalWebviewContainment') && app.includes("view.style.display = isActive ? 'inline-flex' : 'none'") && app.includes("view.style.zIndex = isActive ? '1' : '0'"), 'active webview is forced to inline-flex geometry inside #webview-stage');
check(
  'pass340-reapplies-exact-stage-fit',
  /function pass340ForceNormalWebviewContainment[\s\S]*pass339ApplyStageViewportFit\(tab\.webview\)/.test(app) &&
    !/view\.style\.width = isActive \? ['"]100%['"]/.test(app) &&
    !/view\.style\.height = isActive \? ['"]100%['"]/.test(app),
  'PASS340 does not overwrite active webview pixels with 100% sizing after PASS339 exact fit'
);
check('pass340-pointer-pause-over-chrome', app.includes('pass340PauseWebviewForChrome') && app.includes('pointer-over-chrome') && app.includes("activeTab.webview.style.pointerEvents = 'none'"), 'webview pointer ownership pauses while pointer is over chrome');
check('pass340-schedules-after-load', app.includes("pass340ScheduleChromeInputCloseout('dom-ready')") && app.includes("pass340ScheduleChromeInputCloseout('did-stop-loading')") && app.includes("pass340ScheduleChromeInputCloseout('create-tab')"), 'closeout runs after createTab, dom-ready, and stop-loading');
check('css-pass340-installed', css.includes('PASS340_CHROME_INPUT_HITTEST_CLOSEOUT') && css.includes('z-index: 2147483000') && css.includes('body[data-pass340-webview-pointer-paused]'), 'loaded stylesheet protects chrome and has pointer-pause fallback');
check('css-webview-inline-flex-display', /#webview-stage[^{}]*> webview\.browser-view\.active[\s\S]*display:\s*inline-flex\s*!important/.test(css), 'normal active webview uses inline-flex display so the Electron guest viewport follows the stage');
check('css-toolbar-no-drag', css.includes('.toolbar *') && css.includes('-webkit-app-region: no-drag !important'), 'toolbar controls are no-drag click targets');
check('pass339-verifier-updated', read('scripts/verify-pass-339-normal-browsing-input-paint-closeout.mjs').includes('display:\\s*inline-flex'), 'PASS339 verifier requires inline-flex normal webview display');
check('pass271-r4-still-gated', app.includes('TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR') && !/else\s+pass271R4Mount\(\);\s*\/\*\s*unconditional/i.test(app), 'PASS271_R4 remains opt-in only');
check('no-unsafe-webview-popups-added', !/setAttribute\(\s*['"]allowpopups['"]/i.test(app) && !/<webview[^>]*allowpopups/i.test(css), 'PASS340 did not add unsafe allowpopups behavior');
check('package-script-present', pkg.scripts?.['verify:pass-340-chrome-input-hittest-closeout'] === 'node scripts/verify-pass-340-chrome-input-hittest-closeout.mjs', 'package.json exposes PASS340 verifier');

const failed = checks.filter((entry) => !entry.ok);
const report = { pass: 'PASS340', name: 'Chrome Input Hit-Test Closeout', result: failed.length ? 'FAIL' : 'PASS', generatedAt: new Date().toISOString(), checks };
fs.writeFileSync(path.join(outDir, 'pass340-chrome-input-hittest-closeout-report.json'), JSON.stringify(report, null, 2));
for (const entry of checks) console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.id} - ${entry.detail}`);
console.log(`PASS340_VERIFY_RESULT=${report.result}`);
console.log('PASS340_REPORT=release-candidate/generated/pass340-chrome-input-hittest-closeout-report.json');
if (failed.length) process.exit(1);
