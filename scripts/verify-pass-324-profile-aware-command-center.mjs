#!/usr/bin/env node
/**
 * PASS324 — Command Center Profile-Aware Power Surface — Verifier
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

console.log('\nPASS324 — Command Center Profile-Aware Power Surface\n');

check('profile-aware-command-center.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/profile-aware-command-center.ts'))) throw new Error('missing'); });
check('All 13 required categories present', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  const cats = ['daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization', 'it-tools',
    'devops-tools', 'mission-control', 'evidence', 'runbook', 'admin-console-profiles', 'support', 'enterprise-policy'];
  for (const c of cats) if (!s.includes(`'${c}'`)) throw new Error(`Missing category: ${c}`);
});
check('Commands state target scope (not anonymous)', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  for (const scope of ['active-tab', 'browser', 'mission', 'profile', 'settings']) {
    if (!s.includes(`'${scope}'`)) throw new Error(`Missing scope: ${scope}`);
  }
});
check('Disabled commands show profile/policy reason (not silent)', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  if (!s.includes('Disabled by enterprise policy') || !s.includes('Disabled by profile setting')) throw new Error('Missing disabled reasons');
});
check('No hidden-surface command opens forbidden overlay', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  if (!s.includes('availability === \'available\'') || !s.includes('disabled-by-profile')) throw new Error('Availability guard missing');
});
check('Destructive commands require confirmation (not available directly)', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  if (!s.includes('requires-confirmation') || !s.includes('isDestructive: true')) throw new Error('Destructive command guard missing');
});
check('Commands remain discoverable in search when disabled', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  if (!s.includes('showInSearch = true')) throw new Error('Disabled commands not discoverable');
});
check('getCommandsForProfile and getAvailableCommandsForProfile exported', () => {
  const s = src('src/shared/profile-aware-command-center.ts');
  if (!s.includes('export function getCommandsForProfile') || !s.includes('export function getAvailableCommandsForProfile')) throw new Error('missing exports');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS324 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS324 ✓ Command Center Profile-Aware Power Surface verified.\n');
