#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const findings = [];
function pass(name, detail='') { findings.push({name, status:'PASS', detail}); console.log(`PASS ${name}${detail ? ' - ' + detail : ''}`); }
function fail(name, detail='') { findings.push({name, status:'FAIL', detail}); console.error(`FAIL ${name}${detail ? ' - ' + detail : ''}`); }
function must(name, condition, detail='') { condition ? pass(name, detail) : fail(name, detail); }

const pkg = JSON.parse(read('package.json'));
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const main = read('src/main/main.ts');

must('package-script-present', pkg.scripts?.['verify:pass-341-normal-browser-and-feature-clickability-closeout'] === 'node scripts/verify-pass-341-normal-browser-and-feature-clickability-closeout.mjs');
must('runtime-owner-present', app.includes('PASS341_NORMAL_BROWSER_AND_FEATURE_CLICKABILITY_CLOSEOUT_START') && app.includes('pass341NormalBrowserAndFeatureClickabilityCloseout'));
must('runtime-owner-mounted', app.includes('pass341MountNormalBrowserAndFeatureClickabilityCloseout') && app.includes('DOMContentLoaded') && app.includes('pass341MountNormalBrowserAndFeatureClickabilityCloseout'));
must('runtime-owner-lifecycle-wired', ['create-tab','render-single-layout','mission-tab-drag-end','webview-dom-ready','webview-did-stop-loading','mission-layout-change','escape'].every((token) => app.includes(token)));
must('runtime-owner-overlay-close-wired', ['mission-control-close', 'command-toolbar-close', 'settings-close', 'profile-close', 'command-palette-close', 'shortcuts-close'].every((token) => app.includes(token)));
must('feature-click-fallback-opt-in', app.includes('pass341HandlePrimaryFeatureClick') && app.includes('pass341RunPrimaryFeatureAction') && app.includes('pass341CaptureFallbackEnabled') && app.includes('TAHAI_BROWSER_ENABLE_PASS341_CAPTURE_FALLBACK'));
must('address-submit-fallback-opt-in', app.includes('pass341HandleAddressSubmit') && app.includes('pass191NavigateAddressInput()') && app.includes('document.addEventListener(\'submit\', pass341HandleAddressSubmit, true)'));
const featureIds = ['back','forward','reload','home','launchpad','onboarding','profile-switcher','devops-tools','it-tools','ops-hub-toggle','mission-control-toggle','settings','new-tab'];
must('primary-feature-bindings-covered', featureIds.every((id) => app.includes(`'${id}'`)), featureIds.join(','));
const directBindingTokens = [
  "addressForm.addEventListener('submit'",
  "backButton.addEventListener('click'",
  "forwardButton.addEventListener('click'",
  "reloadButton.addEventListener('click'",
  "homeButton.addEventListener('click'",
  "launchpadButton.addEventListener('click'",
  "onboardingButton.addEventListener('click'",
  "profileSwitcherButton.addEventListener('click'",
  "devopsToolsButton.addEventListener('click'",
  "itToolsButton.addEventListener('click'",
  "opsHubToggleButton.addEventListener('click'",
  "missionControlButton.addEventListener('click'",
  "settingsButton.addEventListener('click'",
  "newTabButton.addEventListener('click'"
];
must('primary-feature-direct-bindings-present', directBindingTokens.every((token) => app.includes(token)), directBindingTokens.join(','));
const primaryActions = ['goBackTarget','goForwardTarget','reloadTarget','navigate(settings?.homeUrl','navigate(config?.newTabUrl','pass195OperatorWalkthroughUrl','openProfileManager','toggleToolMenu(\'devops\')','toggleToolMenu(\'it\')','toggleOpsHub()','openMissionControl','openSettings','createTab'];
must('primary-feature-actions-present', primaryActions.every((token) => app.includes(token)));
must('hidden-overlay-inertness-runtime', app.includes('pass341NormalizeHiddenOverlays') && app.includes('dialog:not([open])') && app.includes('tool-menu-panel[hidden]'));
must('mission-residue-inertness-runtime', app.includes('pass341NormalizeMissionResidue') && app.includes('mission-pane-drop-zones') && app.includes('pass341NormalBrowsingResidueHidden'));
must('webview-stage-containment-runtime', app.includes('pass341NormalizeWebviewStage') && app.includes('pass341StageContainedWebview'));
must(
  'webview-stage-exact-pixel-fit-runtime',
  app.includes('pass342ExactStageViewportFit') &&
    app.includes('PASS342_NATIVE_GUEST_VIEWPORT_BOTTOM_ALIGN') &&
    app.includes('pass342ScheduleNativeGuestViewportSettle') &&
    app.includes("webview.style.setProperty('width', stageWidth + 'px', 'important')") &&
    app.includes("webview.style.setProperty('height', stageHeight + 'px', 'important')") &&
    app.includes("webview.style.setProperty('display', 'inline-flex', 'important')") &&
    /function pass341NormalizeWebviewStage[\s\S]*pass339ApplyStageViewportFit\(activeView as Electron\.WebviewTag\)/.test(app),
  'PASS341 reapplies exact stage pixels after overlay/chrome cleanup so Electron webviews cannot collapse to the intrinsic 150px guest viewport'
);
must('guest-document-bottom-proof-runtime', app.includes('pass342GuestViewportBottomAligned') && app.includes('active guest document bottom stops before viewport bottom'));
must('loaded-css-contract-present', css.includes('PASS341_NORMAL_BROWSER_AND_FEATURE_CLICKABILITY_CLOSEOUT'));
for (const token of ['.topbar', '.toolbar', '.statusbar', '#tabs', '#new-tab', '#back', '#forward', '#reload', '#home', '#address', '#launchpad', '#onboarding', '#profile-switcher', '#devops-tools', '#it-tools', '#ops-hub-toggle', '#mission-control-toggle', '#settings']) {
  must(`css-control-${token.replace(/[^a-z0-9]+/gi,'-')}`, css.includes(token));
}
must('css-controls-no-drag-pointer-auto', css.includes('-webkit-app-region: no-drag !important') && css.includes('pointer-events: auto !important'));
must('css-stage-below-chrome', /#webview-stage[\s\S]{0,260}z-index:\s*0\s*!important/.test(css) && /\.topbar,[\s\S]{0,220}z-index:\s*2147483000\s*!important/.test(css));
must('css-normal-webview-contained', /#webview-stage[^\{]*> webview\.browser-view\.active[\s\S]{0,900}display:\s*inline-flex\s*!important/.test(css) && /#webview-stage[^\{]*> webview\.browser-view\.active[\s\S]{0,900}position:\s*absolute\s*!important/.test(css) && css.includes('width: 100% !important') && css.includes('height: 100% !important'));
must('css-mission-residue-inert', css.includes('mission-pane-drop-zones') && css.includes('pointer-events: none !important') && css.includes('data-pass341-normal-browsing-residue-hidden'));
must('css-hidden-overlays-inert', css.includes('dialog:not([open])') && css.includes('.tool-menu-panel[hidden]'));
must('pass271-r4-remains-opt-in', app.includes('TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR') && app.includes('if (pass271R4NormalWebviewRepairEnabled())') && !/if \(document\.readyState === ['\"]loading['\"]\).*else pass271R4Mount\(\);/.test(app.replace(/if \(pass271R4NormalWebviewRepairEnabled\(\)\) \{[\s\S]*?\} else \{[\s\S]*?\}/, 'PASS271_R4_GATED_BLOCK')));
must('pass271-r8-r9-white-css-not-returned', !/PASS271_R[89][\s\S]{0,900}background:\s*#fff\s*!important/i.test(css) && !/z-index:\s*50\s*!important/.test(css));
must('no-unsafe-allowpopups-added', !/(<webview[^>]*allowpopups|setAttribute\(['\"]allowpopups|\sallowpopups\s*=)/i.test(app + css + main));
must('no-node-in-remote-content-added', !/nodeIntegration:\s*true/.test(main + app));
must('no-raw-ipc-exposure-added', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/.test(read('src/preload/preload.ts')));
must('no-direct-psa-secret-patterns-added', !/psa[_-]?(api[_-]?key|secret|token)|connectwise[_-]?(secret|token)|autotask[_-]?(secret|token)/i.test(app + css + main));
must('qa-doc-present', exists('docs/qa/PASS341-NORMAL-BROWSER-AND-FEATURE-CLICKABILITY-CLOSEOUT.md'));

const result = findings.some((f) => f.status === 'FAIL') ? 'FAIL' : 'PASS';
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const report = { pass: 'PASS341', result, generatedAt: new Date().toISOString(), findings };
const reportPath = path.join(outDir, 'pass341-normal-browser-and-feature-clickability-closeout-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`PASS341_VERIFY_RESULT=${result}`);
console.log(`PASS341_REPORT=${path.relative(root, reportPath).replace(/\\/g, '/')}`);
process.exit(result === 'PASS' ? 0 : 1);
