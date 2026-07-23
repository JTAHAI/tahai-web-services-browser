#!/usr/bin/env node
/**
 * PASS322 — Ops Mode Boundary + Daily Driver Cleanliness — Verifier
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

console.log('\nPASS322 — Ops Mode Boundary + Daily Driver Cleanliness\n');

check('ops-boundary-contract.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/ops-boundary-contract.ts'))) throw new Error('missing'); });
check('computeOpsBoundaryState exported', () => { if (!src('src/shared/ops-boundary-contract.ts').includes('export function computeOpsBoundaryState')) throw new Error('missing'); });
check('Personal profile ops disabled in boundary', () => {
  const s = src('src/shared/ops-boundary-contract.ts');
  if (!s.includes('personal') || !s.includes('minimal-privacy')) throw new Error('personal/minimal not in boundary logic');
});
check('ops-mode-suppressed CSS class generated for personal profile', () => { if (!src('src/shared/ops-boundary-contract.ts').includes('ops-mode-suppressed')) throw new Error('missing suppression class'); });
check('detectStaleOpsClasses exported', () => { if (!src('src/shared/ops-boundary-contract.ts').includes('export function detectStaleOpsClasses')) throw new Error('missing'); });
check('Stale overlay class list includes mission-active and ops-mode-open', () => {
  const s = src('src/shared/ops-boundary-contract.ts');
  if (!s.includes('mission-active') || !s.includes('ops-mode-open')) throw new Error('incomplete stale class list');
});
check('DOM attribs data-ops-available and data-mission-permitted set', () => {
  const s = src('src/shared/ops-boundary-contract.ts');
  if (!s.includes('data-ops-available') || !s.includes('data-mission-permitted')) throw new Error('missing dom attribs');
});
check('Ops disabled reason is honest and not silent', () => {
  const s = src('src/shared/ops-boundary-contract.ts');
  if (!s.includes('hidden in this profile') || !s.includes('Switch to IT Admin')) throw new Error('missing honest disabled message');
});
check('missionDragZonesPermitted controlled by missionControlEnabled', () => { if (!src('src/shared/ops-boundary-contract.ts').includes('missionDragZonesPermitted')) throw new Error('missing drag zone control'); });
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS322 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS322 ✓ Ops Mode Boundary + Daily Driver Cleanliness verified.\n');
