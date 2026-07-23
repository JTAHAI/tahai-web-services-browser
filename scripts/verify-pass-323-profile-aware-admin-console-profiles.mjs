#!/usr/bin/env node
/**
 * PASS323 — Admin Console Profiles by Browser Profile — Verifier
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

console.log('\nPASS323 — Admin Console Profiles by Browser Profile\n');

check('profile-aware-admin-console-profiles.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/profile-aware-admin-console-profiles.ts'))) throw new Error('missing'); });
check('IT Admin consoles include M365, Entra, Google Workspace', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  for (const label of ['Microsoft 365', 'Entra', 'Google Workspace']) if (!s.includes(label)) throw new Error(`Missing: ${label}`);
});
check('DevOps consoles include GitHub, GitHub Actions, Vercel, Firebase', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  for (const label of ['GitHub', 'GitHub Actions', 'Vercel', 'Firebase']) if (!s.includes(label)) throw new Error(`Missing: ${label}`);
});
check('Personal/Minimal profiles return empty consoles', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  if (!s.includes("case 'personal':") || !s.includes("case 'minimal-privacy':")) throw new Error('No empty-return for personal/minimal');
});
check('No secrets or credentials embedded', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  if (/api[_-]?key|bearer\s|password\s*=|client[_-]?secret|access[_-]?token/.test(s)) throw new Error('Secrets found');
});
check('All console URLs are https only', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  const urls = s.match(/url: '([^']+)'/g) || [];
  for (const u of urls) {
    if (!u.includes('https://')) throw new Error(`Non-https URL found: ${u}`);
  }
});
check('validateAdminConsoleUrl exported', () => { if (!src('src/shared/profile-aware-admin-console-profiles.ts').includes('export function validateAdminConsoleUrl')) throw new Error('missing'); });
check('getSafeAdminConsolesForProfile validates URLs', () => { if (!src('src/shared/profile-aware-admin-console-profiles.ts').includes('getSafeAdminConsolesForProfile')) throw new Error('missing'); });
check('IT Docs is browser-side reference only (no PSA API claim)', () => {
  const s = src('src/shared/profile-aware-admin-console-profiles.ts');
  if (!s.includes('browser-side only') || !s.includes('No PSA API calls')) throw new Error('Missing PSA boundary note');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS323 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS323 ✓ Admin Console Profiles by Browser Profile verified.\n');
