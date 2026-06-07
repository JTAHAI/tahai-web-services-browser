import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const generatedDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(generatedDir, { recursive: true });

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const findings = [];
function add(kind, severity, detail) {
  findings.push({ kind, severity, detail });
}

const main = read('src/main/main.ts');
const app = read('src/renderer/app.ts');
const loadedCss = read('src/renderer/styles/browser.css');
const orphanCss = read('src/renderer/browser.css');
const pkg = read('package.json');

if (!main.includes('TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE')) {
  add('gpu-disable-not-opt-in', 'critical', 'src/main/main.ts must make PASS271_R9 GPU/compositor disable opt-in only.');
}
if (/app\.disableHardwareAcceleration\s*\(\s*\)/.test(main) && !/TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE[\s\S]{0,700}app\.disableHardwareAcceleration\s*\(\s*\)/.test(main)) {
  add('ungated-disable-hardware-acceleration', 'critical', 'app.disableHardwareAcceleration() appears outside the PASS337 opt-in guard window.');
}
if (/disable-gpu/.test(main) && !main.includes('TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE')) {
  add('ungated-disable-gpu-flag', 'critical', 'disable-gpu flag appears without the PASS337 opt-in guard.');
}

if (!app.includes('TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR')) {
  add('pass271-r4-repair-not-gated', 'critical', 'PASS271_R4 normal webview hard repair call must be gated behind an opt-in env flag.');
}
if (/^\s*pass271R4Mount\(\);/m.test(app)) {
  add('pass271-r4-direct-mount-call', 'critical', 'pass271R4Mount() still appears as a direct active call.');
}
if (/^\s*pass271R9ArmWebviewBlankSurfaceRecovery\([^\n]*\);/m.test(app) && !app.includes('TAHAI_BROWSER_ENABLE_PASS271_R9_BLANK_SURFACE_RECOVERY')) {
  add('pass271-r9-blank-recovery-direct-call', 'high', 'PASS271_R9 blank surface recovery should be opt-in only.');
}

const activeEmergencyImport = /^\s*import\s+["']\.\/(pass(329|330|331|332|334|335|336)[^"']*)["'];/m.exec(app);
if (activeEmergencyImport) {
  add('active-emergency-recovery-import', 'critical', `Emergency recovery import is still active: ${activeEmergencyImport[0]}`);
}

if (!exists('src/renderer/styles/browser.css')) {
  add('loaded-css-missing', 'critical', 'Expected runtime stylesheet src/renderer/styles/browser.css was not found.');
}
if (!loadedCss.includes('PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT')) {
  add('loaded-css-contract-missing', 'critical', 'PASS337 chrome-safe webview contract must be in src/renderer/styles/browser.css, the stylesheet loaded by index.html.');
}
if (orphanCss.includes('PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT') && !loadedCss.includes('PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT')) {
  add('contract-only-in-orphan-css', 'critical', 'Chrome-safe contract appears only in orphan src/renderer/browser.css, not loaded CSS.');
}
if (!loadedCss.includes('rgba(96, 255, 218, 0.92)') && !loadedCss.includes('PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT')) {
  add('browser-accent-not-preserved', 'low', 'Browser accent was not found in loaded CSS.');
}

if (!pkg.includes('verify:pass-337-cursor-root-cause-closeout')) {
  add('package-script-missing', 'critical', 'package.json is missing verify:pass-337-cursor-root-cause-closeout.');
}

const critical = findings.filter((f) => f.severity === 'critical').length;
const high = findings.filter((f) => f.severity === 'high').length;
const warning = findings.filter((f) => f.severity === 'medium' || f.severity === 'low').length;
const result = critical === 0 ? 'PASS' : 'FAIL';

const report = {
  pass: 'PASS337',
  name: 'Cursor Root-Cause Closeout',
  result,
  criticalFindings: critical,
  highFindings: high,
  warningFindings: warning,
  findings,
  checkedFiles: [
    'src/main/main.ts',
    'src/renderer/app.ts',
    'src/renderer/styles/browser.css',
    'src/renderer/browser.css',
    'package.json'
  ],
  generatedAt: new Date().toISOString()
};

const reportPath = path.join(generatedDir, 'pass337-cursor-root-cause-closeout-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`PASS337_VERIFY_RESULT=${result}`);
console.log(`PASS337_CRITICAL_FINDINGS=${critical}`);
console.log(`PASS337_HIGH_FINDINGS=${high}`);
console.log(`PASS337_WARNING_FINDINGS=${warning}`);
console.log(`PASS337_REPORT=${reportPath}`);
if (findings.length) console.log(JSON.stringify(findings, null, 2));

if (critical > 0) process.exit(1);
