#!/usr/bin/env node
/**
 * PASS320 — Daily Driver Settings Parity Shell — Verifier
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0; let failed = 0; const failures = [];
function check(label, fn) {
  try { const r = fn(); if (r === false) throw new Error('returned false'); console.log(`  ✓ ${label}`); passed++; }
  catch (err) { console.error(`  ✗ ${label}: ${err.message}`); failed++; failures.push({ label, error: err.message }); }
}
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('\nPASS320 — Daily Driver Settings Parity Shell\n');

check('daily-driver-settings-parity-contract.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/daily-driver-settings-parity-contract.ts'))) throw new Error('missing'); });
check('All 16 required settings sections defined', () => {
  const s = src('src/shared/daily-driver-settings-parity-contract.ts');
  const required = ['profiles', 'search-engine', 'startup', 'appearance', 'tabs', 'privacy-security',
    'site-permissions', 'downloads', 'languages', 'accessibility', 'system-performance',
    'reset-settings', 'about', 'enterprise-policy', 'ops-mission-control', 'ui-customization'];
  for (const id of required) if (!s.includes(`'${id}'`)) throw new Error(`Missing section: ${id}`);
});
check('No stale pass chatter or fake GA claims in settings parity', () => {
  const s = src('src/shared/daily-driver-settings-parity-contract.ts');
  if (/GA(?:\s+ready|\s+shipped|\s+complete)/i.test(s)) throw new Error('Fake GA claim found');
  if (/PASS\d{2,3} complete/i.test(s)) throw new Error('Stale pass chatter found');
});
check('enterprise-policy section only shown for IT/admin profiles', () => {
  const s = src('src/shared/daily-driver-settings-parity-contract.ts');
  if (!s.includes('policy-diagnostics') || !s.includes('itToolsEnabled')) throw new Error('Policy section not gated by profile');
});
check('ops-mission-control section gated by missionControlEnabled', () => {
  const s = src('src/shared/daily-driver-settings-parity-contract.ts');
  if (!s.includes('missionControlEnabled')) throw new Error('Not gated by missionControlEnabled');
});
check('settingsSectionsForProfile exported', () => { if (!src('src/shared/daily-driver-settings-parity-contract.ts').includes('export function settingsSectionsForProfile')) throw new Error('missing'); });
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS320 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS320 ✓ Daily Driver Settings Parity Shell verified.\n');
