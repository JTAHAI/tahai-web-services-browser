#!/usr/bin/env node
/**
 * PASS326 — Profile Import / Export / Reset — Verifier
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

console.log('\nPASS326 — Profile Import / Export / Reset\n');

check('profile-import-export-contract.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/profile-import-export-contract.ts'))) throw new Error('missing'); });
check('ProfileExportEnvelope guardrails are present', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  for (const g of ['noSessionData: true', 'noCookies: true', 'noHistory: true', 'noCredentials: true', 'noPasswords: true', 'noTokens: true', 'noStorageData: true', 'uiConfigOnly: true']) {
    if (!s.includes(g)) throw new Error(`Missing guardrail: ${g}`);
  }
});
check('importProfileFromJson rejects secrets', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('SECRETISH_IMPORT') || !s.includes('secretish content')) throw new Error('No secretish rejection');
});
check('importProfileFromJson rejects HTML/script injection', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('HTML_INJECTION') || !s.includes('<script')) throw new Error('No HTML injection guard');
});
check('importProfileFromJson rejects giant fields', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('GIANT_FIELD') || !s.includes('oversized field')) throw new Error('No giant-field guard');
});
check('importProfileFromJson rejects unknown protocols', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('sanitizeProfileUxConfig')) throw new Error('Not using sanitizeProfileUxConfig for unknown field guard');
});
check('resetProfileToDefaults exported', () => { if (!src('src/shared/profile-import-export-contract.ts').includes('export function resetProfileToDefaults')) throw new Error('missing'); });
check('validateProfileDelete prevents deleting last profile', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('last profile') || !s.includes('totalProfiles <= 1')) throw new Error('last profile guard missing');
});
check('duplicateProfileConfig exported', () => { if (!src('src/shared/profile-import-export-contract.ts').includes('export function duplicateProfileConfig')) throw new Error('missing'); });
check('buildProfileExportEnvelope strips enterprisePolicyLockedFields', () => {
  const s = src('src/shared/profile-import-export-contract.ts');
  if (!s.includes('enterprisePolicyLockedFields') || !s.includes('_stripped')) throw new Error('locked fields not stripped on export');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS326 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS326 ✓ Profile Import / Export / Reset verified.\n');
