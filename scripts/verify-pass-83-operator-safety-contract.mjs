import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS83][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS83 Operator Safety Contract');
includes('src/renderer/app.ts', 'pass83RunOperatorSafetyContract');
includes('src/renderer/app.ts', 'pass83MountOperatorSafetyContract');
includes('src/renderer/app.ts', 'pass83RedactionGatePairs');
includes('src/renderer/app.ts', 'pass83RedactTextareaBeforeAction');
includes('src/renderer/app.ts', 'scanAndRedact(raw)');
includes('src/renderer/app.ts', 'operator-safety-contract');
includes('src/renderer/app.ts', 'copy-operator-safety-contract');
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+M');
includes('src/renderer/app.ts', 'pass83RuntimeFaultCount');
includes('src/renderer/app.ts', 'data-operator-safety-redaction-gate');
includes('src/renderer/app.ts', 'pass83MountOperatorSafetyContract();');
includes('src/renderer/styles/browser.css', 'PASS83 operator safety contract');
includes('PASS_83_OPERATOR_SAFETY_CONTRACT_SUMMARY.md', 'PASS83');

const gateMatch = app.match(/const pass83RedactionGatePairs(?::[^=]+)? = \[([\s\S]*?)\](?: as const)?;/);
need(gateMatch, 'redaction gate pair list missing');
const gateCount = (gateMatch[1].match(/\['[^']+',\s*'[^']+',\s*'[^']+'\]/g) || []).length;
need(gateCount >= 24, `expected at least 24 redaction-gated copy/save actions, found ${gateCount}`);

const requiredButtons = [
  'copy-capture','save-capture','copy-ops','save-ops','copy-deploy','save-deploy','copy-it-card','save-it-card',
  'copy-endpoint','save-endpoint','copy-triage','save-triage','copy-route-map','save-route-map','copy-dev-audit','save-dev-audit',
  'copy-bundle','save-bundle','copy-handoff','save-handoff','copy-ops-guard','save-ops-guard','copy-ops-guard-redacted',
  'mission-copy-export','mission-save-export'
];
for (const id of requiredButtons) {
  need(app.includes(`['${id}',`) || app.includes(`["${id}",`), `missing PASS83 redaction gate for ${id}`);
}

const requiredDialogs = ['mission-dialog','command-palette-dialog','capture-dialog','ops-dialog','deploy-dialog','handoff-dialog','ops-guard-dialog','settings-dialog','profile-dialog'];
for (const id of requiredDialogs) need(app.includes(`'${id}'`), `missing dialog recovery contract for ${id}`);

need(String(pkg.scripts?.['verify:pass-83-operator-safety-contract'] || '').includes('verify-pass-83-operator-safety-contract.mjs'), 'package script missing PASS83 verifier');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-83-operator-safety-contract'), 'verify:release-blockers missing PASS83 verifier');
need(css.includes('pass83-operator-safety-warning') && css.includes('textarea[data-pass83-redacted="true"]'), 'PASS83 CSS state markers missing');

console.log(`[PASS83][OK] Operator safety contract verified with ${gateCount} redaction-gated actions.`);
