import fs from 'fs';
import path from 'path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS87][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS87 Operator Recovery Mesh');
includes('src/renderer/app.ts', 'pass87RunOperatorRecoveryMesh');
includes('src/renderer/app.ts', 'pass87CopyOperatorRecoveryMesh');
includes('src/renderer/app.ts', 'pass87MountOperatorRecoveryMesh');
includes('src/renderer/app.ts', 'pass87EnsurePriorRecoveryMounts');
includes('src/renderer/app.ts', 'pass87EnsureSourceTrueSurfaces');
includes('src/renderer/app.ts', 'pass87EnsureNavigationRecovery');
includes('src/renderer/app.ts', 'pass87EnsureToolAndDropRecovery');
includes('src/renderer/app.ts', 'pass87EnsureCommandShortcutRecovery');
includes('src/renderer/app.ts', 'pass87EnsureEvidenceAndRuntimeRecovery');
includes('src/renderer/app.ts', 'pass87RequiredPriorMountFlags');
includes('src/renderer/app.ts', 'pass87RequiredCommandIds');
includes('src/renderer/app.ts', 'pass87RecoverySurfaces');
includes('src/renderer/app.ts', 'pass87NavigationIds');
includes('src/renderer/app.ts', 'pass87ToolActionIds');
includes('src/renderer/app.ts', 'operator-recovery-mesh');
includes('src/renderer/app.ts', 'copy-operator-recovery-mesh');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+O');
includes('src/renderer/app.ts', 'pass87MountOperatorRecoveryMesh();');
includes('src/renderer/styles/browser.css', 'PASS87 operator recovery mesh');
includes('src/renderer/styles/browser.css', 'pass87-operator-recovery-warning');
includes('src/renderer/styles/browser.css', '[data-pass87-recovery-contract="source-true"]');
includes('src/renderer/styles/browser.css', '[data-pass87-navigation-recovery="active-pane-aware"]');
includes('src/renderer/styles/browser.css', 'webview[data-pass87-navigation-recovery="isolated-direct-stage-child"]');
includes('src/renderer/styles/browser.css', 'textarea[data-pass87-evidence-recovery="redaction-required-before-copy-save"]');
includes('PASS_87_OPERATOR_RECOVERY_MESH_SUMMARY.md', 'PASS87');
includes('NEXT_CHAT_STARTER.md', 'PASS87');

for (const required of [
  'pass81AllSurfaceGuardMounted',
  'pass82EnterpriseSurfaceAssuranceMounted',
  'pass83OperatorSafetyMounted',
  'pass84ReleaseGateTruthMounted',
  'pass85EnterpriseContractLedgerMounted',
  'pass86SourceContractSentinelMounted'
]) {
  need(app.includes(`'${required}'`), `missing prior recovery mount flag ${required}`);
}

for (const command of ['source-contract-sentinel', 'operator-recovery-mesh', 'copy-operator-recovery-mesh']) {
  need(app.includes(`'${command}'`), `missing command coverage ${command}`);
}

for (const id of ['address-form', 'address', 'back', 'forward', 'reload', 'devops-tools-panel', 'it-tools-panel', 'statusbar']) {
  need(app.includes(`'${id}'`) || app.includes(`#${id}`) || app.includes(`"${id}"`), `missing source-true recovery id ${id}`);
}


for (const token of ['pass153PopupBoundary', 'autosize', 'nodeintegration', 'data-pass87-navigation-recovery', 'data-pass87-non-drop-boundary', 'data-pass87-evidence-recovery']) {
  need(app.includes(token), `missing navigation/tool/evidence recovery token ${token}`);
}

const surfaceList = app.match(/const pass87RecoverySurfaces: Array<\[string, string, string\]> = \[([\s\S]*?)\];/);
need(surfaceList, 'PASS87 recovery surface list missing');
const surfaceCount = (surfaceList[1].match(/\[[^\]]+\]/g) || []).length;
need(surfaceCount >= 15, `expected at least 15 recovery surfaces, found ${surfaceCount}`);
need(surfaceList[1].includes("['address', '#address', 'Address input']"), 'canonical #address input selector missing from PASS87 recovery mesh');
need(!surfaceList[1].includes("#address-input"), 'PASS87 recovery mesh must not use stale #address-input selector');

const navList = app.match(/const pass87NavigationIds = \[([\s\S]*?)\];/);
need(navList, 'PASS87 navigation id list missing');
const navCount = (navList[1].match(/'[^']+'/g) || []).length;
need(navCount >= 8, `expected at least 8 navigation controls, found ${navCount}`);

const toolList = app.match(/const pass87ToolActionIds = \[([\s\S]*?)\];/);
need(toolList, 'PASS87 tool action id list missing');
const toolCount = (toolList[1].match(/'[^']+'/g) || []).length;
need(toolCount >= 10, `expected at least 10 tool action controls, found ${toolCount}`);

const requiredScript = String(pkg.scripts?.['verify:pass-87-operator-recovery-mesh'] || '');
need(requiredScript.includes('verify-pass-87-operator-recovery-mesh.mjs'), 'package script missing PASS87 verifier');
need(getReleaseBlockersContract(pkg).includes('verify:pass-87-operator-recovery-mesh'), 'verify:release-blockers missing PASS87 verifier');

// PASS88 release-blocker hardening: source verifiers may be run after `npm ci`.
// Check repository exclusion policy here; ZIP artifact exclusion is verified during packaging.
const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

console.log(`[PASS87][OK] Operator Recovery Mesh verified with ${surfaceCount} source-true surfaces, ${navCount} navigation controls, and ${toolCount} tool actions.`);
