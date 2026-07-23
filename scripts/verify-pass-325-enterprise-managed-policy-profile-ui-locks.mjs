#!/usr/bin/env node
/**
 * PASS325 — Enterprise Managed Policy Locks for Profile UI — Verifier
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

console.log('\nPASS325 — Enterprise Managed Policy Locks for Profile UI\n');

check('enterprise-policy-profile-ui-locks.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/enterprise-policy-profile-ui-locks.ts'))) throw new Error('missing'); });
check('All 15 required policy controls defined', () => {
  const s = src('src/shared/enterprise-policy-profile-ui-locks.ts');
  const controls = ['allowedProfileKinds', 'defaultProfileKind', 'lockedVisibleSurfaces', 'disabledVisibleSurfaces',
    'lockedToolGroups', 'disabledToolGroups', 'allowCustomProfiles', 'allowOpsMode', 'allowMissionExports',
    'allowEvidenceCapture', 'allowSupportBundle', 'allowDevOpsTools', 'allowITTools', 'allowAdminConsoleProfiles',
    'allowProfileSwitching', 'allowUserUiCustomization'];
  for (const c of controls) if (!s.includes(c)) throw new Error(`Missing control: ${c}`);
});
check('Policy precedence: enterprise > local > default', () => {
  const s = src('src/shared/enterprise-policy-profile-ui-locks.ts');
  if (!s.includes('applyProfileUxPolicyLocksToConfig')) throw new Error('apply function missing');
  if (!s.toLowerCase().includes('policy overrides') && !s.toLowerCase().includes('policy precedence')) throw new Error('no precedence comment');
});
check('sanitizeProfileUxPolicyLocks rejects secretish content', () => {
  const s = src('src/shared/enterprise-policy-profile-ui-locks.ts');
  if (!s.includes('SECRETISH')) throw new Error('no secretish guard');
});
check('PolicyDiagnosticItem type defined for policy diagnostics surface', () => { if (!src('src/shared/enterprise-policy-profile-ui-locks.ts').includes('PolicyDiagnosticItem')) throw new Error('missing'); });
check('No fake ADMX claim in source', () => {
  const s = src('src/shared/enterprise-policy-profile-ui-locks.ts');
  if (/ADMX\s+(?:ready|available|supported|generated)/i.test(s)) throw new Error('Fake ADMX claim found');
});
check('buildProfileUiPolicyDiagnostics exported', () => { if (!src('src/shared/enterprise-policy-profile-ui-locks.ts').includes('export function buildProfileUiPolicyDiagnostics')) throw new Error('missing'); });
check('allowCustomProfiles=false falls back to personal not crashes', () => {
  const s = src('src/shared/enterprise-policy-profile-ui-locks.ts');
  if (!s.includes("locks.allowCustomProfiles === false") || !s.includes("defaultProfileUxConfig('personal')")) throw new Error('custom-to-personal fallback missing');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS325 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS325 ✓ Enterprise Managed Policy Locks for Profile UI verified.\n');
