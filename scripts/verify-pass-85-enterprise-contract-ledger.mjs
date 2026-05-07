import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS85][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS85 Enterprise Contract Ledger');
includes('src/renderer/app.ts', 'pass85RunEnterpriseContractLedger');
includes('src/renderer/app.ts', 'pass85CopyEnterpriseContractLedger');
includes('src/renderer/app.ts', 'pass85MountEnterpriseContractLedger');
includes('src/renderer/app.ts', 'pass85EnsureGuardMountLedger');
includes('src/renderer/app.ts', 'pass85EnsureCriticalSurfaceLedger');
includes('src/renderer/app.ts', 'pass85EnsureNavigationLedger');
includes('src/renderer/app.ts', 'pass85EnsureNonDropLedger');
includes('src/renderer/app.ts', 'pass85EnsureDialogEscapeLedger');
includes('src/renderer/app.ts', 'pass85EnsureExportRedactionLedger');
includes('src/renderer/app.ts', 'pass85EnsureCommandAndRecipeLedger');
includes('src/renderer/app.ts', 'pass85EnsurePaneLedger');
includes('src/renderer/app.ts', 'pass85CriticalSurfaceContracts');
includes('src/renderer/app.ts', 'pass85NavigationContractIds');
includes('src/renderer/app.ts', 'pass85NonDropSurfaceIds');
includes('src/renderer/app.ts', 'enterprise-contract-ledger');
includes('src/renderer/app.ts', 'copy-enterprise-contract-ledger');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+L');
includes('src/renderer/app.ts', 'pass85MountEnterpriseContractLedger();');
includes('src/renderer/app.ts', 'const launchRecipes = premiumLaunchRecipes;');
includes('src/renderer/styles/browser.css', 'PASS85 enterprise contract ledger');
includes('src/renderer/styles/browser.css', 'pass85-contract-ledger-warning');
includes('src/renderer/styles/browser.css', '[data-pass85-navigation-contract="active-pane-aware"]');
includes('src/renderer/styles/browser.css', 'textarea[data-pass85-redaction-ledger="true"]');
includes('PASS_85_ENTERPRISE_CONTRACT_LEDGER_SUMMARY.md', 'PASS85');

for (const required of ['pass81AllSurfaceGuardMounted', 'pass82EnterpriseSurfaceAssuranceMounted', 'pass83OperatorSafetyMounted', 'pass84ReleaseGateTruthMounted']) {
  need(app.includes(`'${required}'`), `missing guard mount flag ${required}`);
}
for (const command of ['release-gate-truth-mesh', 'enterprise-contract-ledger', 'copy-enterprise-contract-ledger']) {
  need(app.includes(`'${command}'`), `missing command coverage ${command}`);
}
for (const id of ['tabs', 'address-form', 'webview-stage', 'statusbar', 'ops-hub', 'command-palette-dialog', 'mission-dialog']) {
  need(app.includes(`#${id}`) || app.includes(`'${id}'`) || app.includes(`"${id}"`), `missing critical surface ${id}`);
}

const pass85SurfaceList = app.match(/const pass85CriticalSurfaceContracts: Array<\[string, string, string\]> = \[([\s\S]*?)\];/);
need(pass85SurfaceList, 'PASS85 critical surface list missing');
const surfaceCount = (pass85SurfaceList[1].match(/\[[^\]]+\]/g) || []).length;
need(surfaceCount >= 10, `expected at least 10 critical surfaces, found ${surfaceCount}`);

const pass85NonDropList = app.match(/const pass85NonDropSurfaceIds = \[([\s\S]*?)\];/);
need(pass85NonDropList, 'PASS85 non-drop surface list missing');
const nonDropCount = (pass85NonDropList[1].match(/'[^']+'/g) || []).length;
need(nonDropCount >= 16, `expected at least 16 non-drop surfaces, found ${nonDropCount}`);

need(String(pkg.scripts?.['verify:pass-85-enterprise-contract-ledger'] || '').includes('verify-pass-85-enterprise-contract-ledger.mjs'), 'package script missing PASS85 verifier');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-85-enterprise-contract-ledger'), 'verify:release-blockers missing PASS85 verifier');

// PASS88 release-blocker hardening: source verifiers may be run after `npm ci`.
// Check repository exclusion policy here; ZIP artifact exclusion is verified during packaging.
const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

console.log(`[PASS85][OK] Enterprise Contract Ledger verified with ${surfaceCount} critical surfaces and ${nonDropCount} non-drop surfaces.`);
