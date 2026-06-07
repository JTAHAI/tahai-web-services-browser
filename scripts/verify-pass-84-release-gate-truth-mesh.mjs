import fs from 'fs';
import path from 'path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS84][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS84 Release Gate Truth Mesh');
includes('src/renderer/app.ts', 'pass84RunReleaseGateTruthMesh');
includes('src/renderer/app.ts', 'pass84CopyReleaseGateTruthMesh');
includes('src/renderer/app.ts', 'pass84MountReleaseGateTruthMesh');
includes('src/renderer/app.ts', 'pass84RequiredCommandIds');
includes('src/renderer/app.ts', 'pass84RequiredShortcutRows');
includes('src/renderer/app.ts', 'pass84RequiredGuardMountFlags');
includes('src/renderer/app.ts', 'pass84EnsureCommandTruth');
includes('src/renderer/app.ts', 'pass84EnsureShortcutTruth');
includes('src/renderer/app.ts', 'pass84EnsureExportTruth');
includes('src/renderer/app.ts', 'pass84EnsureMissionPaneTruth');
includes('src/renderer/app.ts', 'pass84EnsureLaunchRecipeTruth');
includes('src/renderer/app.ts', 'release-gate-truth-mesh');
includes('src/renderer/app.ts', 'copy-release-gate-truth-mesh');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+V');
includes('src/renderer/app.ts', 'pass84MountReleaseGateTruthMesh();');
includes('src/renderer/styles/browser.css', 'PASS84 release gate truth mesh');
includes('src/renderer/styles/browser.css', 'pass84-release-gate-warning');
includes('src/renderer/styles/browser.css', 'textarea[data-pass84-release-output-contract="true"]');
includes('PASS_84_RELEASE_GATE_TRUTH_MESH_SUMMARY.md', 'PASS84');

for (const required of ['pass81AllSurfaceGuardMounted', 'pass82EnterpriseSurfaceAssuranceMounted', 'pass83OperatorSafetyMounted']) {
  need(app.includes(`'${required}'`), `missing prior guard mount truth flag ${required}`);
}
for (const command of ['mission-view-doctor', 'mission-view-repaint-fit', 'all-surface-doctor', 'enterprise-surface-assurance', 'operator-safety-contract', 'release-gate-truth-mesh']) {
  need(app.includes(`'${command}'`), `missing required command coverage ${command}`);
}
for (const shortcut of ['Ctrl+Alt+Shift+S', 'Ctrl+Alt+Shift+A', 'Ctrl+Alt+Shift+M', 'Ctrl+Alt+Shift+V']) {
  need(app.includes(shortcut), `missing required shortcut ${shortcut}`);
}

const pass84CommandList = app.match(/const pass84RequiredCommandIds = \[([\s\S]*?)\];/);
need(pass84CommandList, 'PASS84 required command list missing');
const commandCount = (pass84CommandList[1].match(/'[^']+'/g) || []).length;
need(commandCount >= 24, `expected at least 24 required command ids, found ${commandCount}`);

need(String(pkg.scripts?.['verify:pass-84-release-gate-truth-mesh'] || '').includes('verify-pass-84-release-gate-truth-mesh.mjs'), 'package script missing PASS84 verifier');
need(getReleaseBlockersContract(pkg).includes('verify:pass-84-release-gate-truth-mesh'), 'verify:release-blockers missing PASS84 verifier');

// PASS88 release-blocker hardening: source verifiers may be run after `npm ci`.
// Check repository exclusion policy here; ZIP artifact exclusion is verified during packaging.
const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

console.log(`[PASS84][OK] Release Gate Truth Mesh verified with ${commandCount} required command ids.`);
