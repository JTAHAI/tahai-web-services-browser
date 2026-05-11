import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS86][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS86 Source Contract Sentinel');
includes('src/renderer/app.ts', 'pass86RunSourceContractSentinel');
includes('src/renderer/app.ts', 'pass86CopySourceContractSentinel');
includes('src/renderer/app.ts', 'pass86MountSourceContractSentinel');
includes('src/renderer/app.ts', 'pass86EnsurePriorMounts');
includes('src/renderer/app.ts', 'pass86EnsureSurfaceContracts');
includes('src/renderer/app.ts', 'pass86EnsureCommandRegistryContracts');
includes('src/renderer/app.ts', 'pass86EnsureRecipeContracts');
includes('src/renderer/app.ts', 'pass86EnsurePaneAndWebviewContracts');
includes('src/renderer/app.ts', 'pass86EnsureRedactionAndDialogContracts');
includes('src/renderer/app.ts', 'pass86EnsureStatusTruthContract');
includes('src/renderer/app.ts', 'pass86RequiredPriorMountFlags');
includes('src/renderer/app.ts', 'pass86RequiredCommandIds');
includes('src/renderer/app.ts', 'pass86SourceContractSelectors');
includes('src/renderer/app.ts', 'source-contract-sentinel');
includes('src/renderer/app.ts', 'copy-source-contract-sentinel');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+X');
includes('src/renderer/app.ts', 'pass86MountSourceContractSentinel();');
includes('src/renderer/styles/browser.css', 'PASS86 source contract sentinel');
includes('src/renderer/styles/browser.css', 'pass86-source-contract-warning');
includes('src/renderer/styles/browser.css', '[data-pass86-source-contract="true"]');
includes('src/renderer/styles/browser.css', 'textarea[data-pass86-redaction-contract="true"]');
includes('src/renderer/styles/browser.css', 'webview[data-pass86-webview-contract="direct-stage-child-fit"]');
includes('PASS_86_SOURCE_CONTRACT_SENTINEL_SUMMARY.md', 'PASS86');
includes('NEXT_CHAT_STARTER.md', 'PASS86');

for (const required of [
  'pass81AllSurfaceGuardMounted',
  'pass82EnterpriseSurfaceAssuranceMounted',
  'pass83OperatorSafetyMounted',
  'pass84ReleaseGateTruthMounted',
  'pass85EnterpriseContractLedgerMounted'
]) {
  need(app.includes(`'${required}'`), `missing prior guard mount flag ${required}`);
}

for (const command of ['enterprise-contract-ledger', 'source-contract-sentinel', 'copy-source-contract-sentinel']) {
  need(app.includes(`'${command}'`), `missing command coverage ${command}`);
}

for (const token of ['pass153PopupBoundary', 'autosize', 'nodeintegration', 'data-pass86-webview-contract', 'data-pass86-mission-drop-boundary']) {
  need(app.includes(token), `missing webview/pane/drop source contract token ${token}`);
}

const selectorList = app.match(/const pass86SourceContractSelectors: Array<\[string, string, string\]> = \[([\s\S]*?)\];/);
need(selectorList, 'PASS86 source contract selector list missing');
const selectorCount = (selectorList[1].match(/\[[^\]]+\]/g) || []).length;
need(selectorCount >= 14, `expected at least 14 source contract selectors, found ${selectorCount}`);

const priorMountList = app.match(/const pass86RequiredPriorMountFlags = \[([\s\S]*?)\];/);
need(priorMountList, 'PASS86 prior mount list missing');
const priorMountCount = (priorMountList[1].match(/'[^']+'/g) || []).length;
need(priorMountCount >= 5, `expected at least 5 prior mount flags, found ${priorMountCount}`);

const requiredScript = String(pkg.scripts?.['verify:pass-86-source-contract-sentinel'] || '');
need(requiredScript.includes('verify-pass-86-source-contract-sentinel.mjs'), 'package script missing PASS86 verifier');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-86-source-contract-sentinel'), 'verify:release-blockers missing PASS86 verifier');

// PASS88 release-blocker hardening: source verifiers may be run after `npm ci`.
// Check repository exclusion policy here; ZIP artifact exclusion is verified during packaging.
const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

console.log(`[PASS86][OK] Source Contract Sentinel verified with ${selectorCount} guarded surfaces and ${priorMountCount} prior guard mounts.`);
