import fs from 'fs';
import path from 'path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS88][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS88 Active Pane Routing Failsafe');
includes('src/renderer/app.ts', 'pass88RunActivePaneRoutingFailsafe');
includes('src/renderer/app.ts', 'pass88CopyActivePaneRoutingReport');
includes('src/renderer/app.ts', 'pass88MountActivePaneRoutingFailsafe');
includes('src/renderer/app.ts', 'pass88RepairActivePane');
includes('src/renderer/app.ts', 'pass88ApplyRoutingAttributes');
includes('src/renderer/app.ts', 'pass88RouteMouseNavigation');
includes('src/renderer/app.ts', 'pass88NavigateAddressInput');
includes('src/renderer/app.ts', 'pass88EnsureCommandTargetTruth');
includes('src/renderer/app.ts', 'pass88EnsureLayoutFallbackControls');
includes('src/renderer/app.ts', 'active-pane-routing-failsafe');
includes('src/renderer/app.ts', 'copy-active-pane-routing-report');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+P');
includes('src/renderer/app.ts', 'pass88MountActivePaneRoutingFailsafe();');
includes('src/renderer/app.ts', "addressForm.addEventListener('submit', (event) => { event.preventDefault(); pass88NavigateAddressInput(); });");
includes('src/renderer/app.ts', 'data-pass88-route-target');
includes('src/renderer/app.ts', 'data-pass88-canonical-address-input');
includes('src/renderer/app.ts', 'pass88MouseButtonRouting');
includes('src/renderer/app.ts', 'pass88LastPaneFallback');
includes('src/main/main.ts', 'PASS88: Route OS/browser mouse back-forward app commands');
includes('src/main/main.ts', "normalized === 'browser-backward'");
includes('src/main/main.ts', "normalized === 'browser-forward'");
includes('src/main/main.ts', "sendMenuCommand(window, 'back')");
includes('src/main/main.ts', "sendMenuCommand(window, 'forward')");
includes('src/renderer/styles/browser.css', 'PASS88 active pane routing failsafe');
includes('src/renderer/styles/browser.css', 'pass88-active-routing-warning');
includes('src/renderer/styles/browser.css', '[data-pass88-active-pane-routing]:focus-visible');
includes('src/renderer/styles/browser.css', '#webview-stage[data-pass88-mouse-button-routing="active-pane-aware"]');
includes('PASS_88_ACTIVE_PANE_ROUTING_FAILSAFE_SUMMARY.md', 'PASS88');
includes('NEXT_CHAT_STARTER.md', 'PASS88');

for (const flag of [
  'pass81AllSurfaceGuardMounted',
  'pass82EnterpriseSurfaceAssuranceMounted',
  'pass83OperatorSafetyMounted',
  'pass84ReleaseGateTruthMounted',
  'pass85EnterpriseContractLedgerMounted',
  'pass86SourceContractSentinelMounted',
  'pass87OperatorRecoveryMounted'
]) {
  need(app.includes(`'${flag}'`), `missing PASS88 prior mount flag ${flag}`);
}

for (const command of ['operator-recovery-mesh', 'active-pane-routing-failsafe', 'copy-active-pane-routing-report']) {
  need(app.includes(`'${command}'`), `missing PASS88 command coverage ${command}`);
}

for (const token of ['mouseup', 'auxclick', 'mission-layout-change', 'visible-pane-safe']) {
  need(app.includes(token), `missing active-pane routing token ${token}`);
}
for (const family of [
  ['goBackTarget()', "goBackTarget('mouse')", "goBackTarget('shortcut')", "goBackTarget('menu')"],
  ['goForwardTarget()', "goForwardTarget('mouse')", "goForwardTarget('shortcut')", "goForwardTarget('menu')"]
]) {
  need(family.some((token) => app.includes(token)), `missing active-pane routing token ${family[0]}`);
}

const controlList = app.match(/const pass88RoutingControlIds = \[([^\]]+)\];/);
need(controlList, 'PASS88 routing control list missing');
const controlCount = (controlList[1].match(/'[^']+'/g) || []).length;
need(controlCount >= 8, `expected at least 8 routing controls, found ${controlCount}`);
need(controlList[1].includes("'address'"), 'PASS88 routing must use canonical #address input');
need(!controlList[1].includes('address-input'), 'PASS88 routing must not use stale #address-input selector');

const setActivePaneBlock = app.match(/function setMissionActivePane\(paneId: string\): void \{([\s\S]*?)\n\}/);
need(setActivePaneBlock, 'setMissionActivePane function missing');
need(setActivePaneBlock[1].includes('visiblePanes.includes(requestedPane)'), 'setMissionActivePane must enforce visible-pane fallback');
need(setActivePaneBlock[1].includes('pass88ScheduleActivePaneRoutingFailsafe'), 'setMissionActivePane must reschedule PASS88 routing proof');

const requiredScript = String(pkg.scripts?.['verify:pass-88-active-pane-routing-failsafe'] || '');
need(requiredScript.includes('verify-pass-88-active-pane-routing-failsafe.mjs'), 'package script missing PASS88 verifier');
need(getReleaseBlockersContract(pkg).includes('verify:pass-88-active-pane-routing-failsafe'), 'verify:release-blockers missing PASS88 verifier');

// PASS88 release-blocker hardening: source verifiers may be run after `npm ci`.
// Check repository exclusion policy here; ZIP artifact exclusion is verified during packaging.
const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

console.log(`[PASS88][OK] Active Pane Routing Failsafe verified with ${controlCount} routing controls, source-level mouse app-command routing, and visible-pane fallback.`);
