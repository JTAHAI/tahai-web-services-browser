#!/usr/bin/env node
/**
 * PASS318 — Profile Switcher + First-Run Browser Type Choice — Verifier
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0; let failed = 0; const failures = [];

function check(label, fn) {
  try {
    const r = fn(); if (r === false) throw new Error('returned false');
    console.log(`  ✓ ${label}`); passed++;
  } catch (err) { console.error(`  ✗ ${label}: ${err.message}`); failed++; failures.push({ label, error: err.message }); }
}
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('\nPASS318 — Profile Switcher + First-Run Browser Type Choice\n');

check('profile-switcher-contract.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/profile-switcher-contract.ts'))) throw new Error('missing'); });
check('FirstRunProfileChoice type defined', () => { if (!src('src/shared/profile-switcher-contract.ts').includes('FirstRunProfileChoice')) throw new Error('missing'); });
check('All 7 profile choices in FIRST_RUN_PROFILE_CHOICES', () => {
  const s = src('src/shared/profile-switcher-contract.ts');
  for (const k of ['personal', 'it-admin', 'devops', 'msp-support', 'security-incident', 'minimal-privacy', 'custom']) {
    if (!s.includes(`'${k}'`)) throw new Error(`Missing: ${k}`);
  }
});
check('ProfileSwitcherState type defined', () => { if (!src('src/shared/profile-switcher-contract.ts').includes('ProfileSwitcherState')) throw new Error('missing'); });
check('profileSwitchRequiresRestart honest about partition restart', () => {
  const s = src('src/shared/profile-switcher-contract.ts');
  if (!s.includes('requiresRestart: true')) throw new Error('missing restart honesty');
});
check('FirstRunProfileState has guardrails', () => {
  const s = src('src/shared/profile-switcher-contract.ts');
  if (!s.includes('noSessionData: true') || !s.includes('noCredentials: true') || !s.includes('noCookies: true')) throw new Error('guardrails missing');
});
check('profile-ux-manager.ts has first-run support', () => {
  const s = src('src/main/profile-ux-manager.ts');
  if (!s.includes('initProfileUxConfig')) throw new Error('missing initProfileUxConfig');
});
check('No secrets in contract source', () => {
  const s = src('src/shared/profile-switcher-contract.ts');
  if (/api[_-]?key|bearer\s|password\s*=/.test(s)) throw new Error('secretish found');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS318 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS318 ✓ Profile Switcher + First-Run Browser Type Choice verified.\n');
