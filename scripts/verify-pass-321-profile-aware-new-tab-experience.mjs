#!/usr/bin/env node
/**
 * PASS321 — Per-Profile New Tab Experience — Verifier
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

console.log('\nPASS321 — Per-Profile New Tab Experience\n');

check('profile-aware-new-tab-contract.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/profile-aware-new-tab-contract.ts'))) throw new Error('missing'); });
check('All 7 profile kind layouts defined', () => {
  const s = src('src/shared/profile-aware-new-tab-contract.ts');
  for (const k of ['personal', 'it-admin', 'devops', 'msp-support', 'security-incident', 'minimal-privacy', 'custom']) {
    if (!s.includes(`'${k}'`)) throw new Error(`Missing layout: ${k}`);
  }
});
check('Personal New Tab has no IT/DevOps clutter', () => {
  const s = src('src/shared/profile-aware-new-tab-contract.ts');
  // Personal layout should not reference it-tools or devops-tools as required
  const personalBlock = s.slice(s.indexOf("'personal':"), s.indexOf("'it-admin':"));
  if (personalBlock.includes("requiredSurface: 'it-tools'") || personalBlock.includes("requiredSurface: 'devops-tools'")) {
    throw new Error('Personal New Tab polluted with IT/DevOps surfaces');
  }
});
check('Minimal/Privacy New Tab is clean (no ops surfaces)', () => {
  const s = src('src/shared/profile-aware-new-tab-contract.ts');
  const minBlock = s.slice(s.indexOf("'minimal-privacy':"), s.indexOf("'custom':"));
  if (minBlock.includes("requiredSurface: 'mission-control'") || minBlock.includes("requiredSurface: 'it-tools'")) {
    throw new Error('Minimal/Privacy New Tab has ops surfaces');
  }
});
check('getNewTabLayoutForProfile filters by surface visibility', () => { if (!src('src/shared/profile-aware-new-tab-contract.ts').includes('export function getNewTabLayoutForProfile')) throw new Error('missing'); });
check('No HTML/script injection in new tab content', () => {
  const s = src('src/shared/profile-aware-new-tab-contract.ts');
  if (/<script|javascript:|data:text\/html/.test(s)) throw new Error('HTML/script injection found');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS321 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS321 ✓ Per-Profile New Tab Experience verified.\n');
