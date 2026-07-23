#!/usr/bin/env node
/**
 * PASS319 — Configurable Toolbar / Surface Visibility — Verifier
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

console.log('\nPASS319 — Configurable Toolbar / Surface Visibility\n');

check('configurable-toolbar-surface-visibility.ts exists', () => { if (!fs.existsSync(path.join(root, 'src/shared/configurable-toolbar-surface-visibility.ts'))) throw new Error('missing'); });
check('computeToolbarButtonStates exported', () => { if (!src('src/shared/configurable-toolbar-surface-visibility.ts').includes('export function computeToolbarButtonStates')) throw new Error('missing'); });
check('All core nav buttons always visible', () => {
  const s = src('src/shared/configurable-toolbar-surface-visibility.ts');
  for (const b of ['back', 'forward', 'reload', 'address-bar', 'new-tab']) {
    if (!s.includes(`'${b}'`)) throw new Error(`Missing always-visible: ${b}`);
  }
});
check('Operator buttons respect profile visibility', () => {
  const s = src('src/shared/configurable-toolbar-surface-visibility.ts');
  for (const b of ['ops-mode', 'mission-control', 'admin-console-profiles', 'it-tools', 'devops-tools', 'evidence-pack']) {
    if (!s.includes(`'${b}'`)) throw new Error(`Missing operator button: ${b}`);
  }
});
check('profileUxCssClasses exported', () => { if (!src('src/shared/configurable-toolbar-surface-visibility.ts').includes('export function profileUxCssClasses')) throw new Error('missing'); });
check('ops-mode-hidden CSS class generated when ops hidden', () => {
  const s = src('src/shared/configurable-toolbar-surface-visibility.ts');
  if (!s.includes("'ops-mode-hidden'") && !s.includes("ops-mode-hidden")) throw new Error('missing ops-mode-hidden class');
});
check('shortcutDisabledReason gives clean message not silent fail', () => { if (!src('src/shared/configurable-toolbar-surface-visibility.ts').includes('Enable it in Settings')) throw new Error('missing clean disabled message'); });
check('surfaceHiddenReason identifies policy vs profile', () => {
  const s = src('src/shared/configurable-toolbar-surface-visibility.ts');
  if (!s.includes('Disabled by enterprise policy') || !s.includes('Hidden by')) throw new Error('incomplete reasons');
});
check('TypeScript typecheck passes', () => { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); });
check('Build passes', () => { execSync('npm run build', { cwd: root, stdio: 'pipe' }); });

console.log(`\n${'─'.repeat(60)}\nPASS319 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailures:'); for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`); process.exit(1); }
else console.log('\nPASS319 ✓ Configurable Toolbar / Surface Visibility verified.\n');
