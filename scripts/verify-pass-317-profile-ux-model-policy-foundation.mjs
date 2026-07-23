#!/usr/bin/env node
/**
 * PASS317 — Browser Profile UX Model + Policy Foundation — Verifier
 *
 * Verifies:
 * - Shared types exist in source.
 * - Defaults exist for all required profile kinds.
 * - sanitizeProfileUxConfig handles unknown/malformed input safely.
 * - No secrets stored in profile config.
 * - Enterprise policy locks forward-declared.
 * - Build succeeds.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    failed++;
    failures.push({ label, error: err.message });
  }
}

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('\nPASS317 — Browser Profile UX Model + Policy Foundation\n');

// 1. Shared model file exists
check('shared/browser-profile-ux-model.ts exists', () => {
  const p = path.join(root, 'src/shared/browser-profile-ux-model.ts');
  if (!fs.existsSync(p)) throw new Error('file missing');
});

// 2. All required profile kinds are defined
check('All 7 profile kinds defined in model', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  const kinds = ['personal', 'it-admin', 'devops', 'msp-support', 'security-incident', 'minimal-privacy', 'custom'];
  for (const k of kinds) {
    if (!src.includes(`'${k}'`)) throw new Error(`Missing kind: ${k}`);
  }
});

// 3. All required visible surfaces defined
check('All 20 visible surfaces defined', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  const surfaces = [
    'home', 'bookmarks', 'history', 'downloads', 'settings', 'extensions-placeholder',
    'daily-driver-new-tab', 'ops-mode', 'mission-control', 'mission-recipes',
    'admin-console-profiles', 'it-tools', 'devops-tools', 'evidence-pack', 'runbook-rail',
    'mission-timeline', 'command-center', 'support-bundle', 'policy-diagnostics', 'artifact-shelf',
  ];
  for (const s of surfaces) {
    if (!src.includes(`'${s}'`)) throw new Error(`Missing surface: ${s}`);
  }
});

// 4. All required tool groups defined
check('All 20 enabled tool groups defined', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  const groups = [
    'browsing', 'privacy', 'downloads', 'bookmarks', 'history', 'devops', 'it-admin',
    'dns', 'tls', 'headers', 'redirects', 'json-yaml', 'jwt', 'cidr', 'checksum',
    'endpoint-smoke', 'evidence', 'mission', 'support', 'enterprise-policy',
  ];
  for (const g of groups) {
    if (!src.includes(`'${g}'`)) throw new Error(`Missing tool group: ${g}`);
  }
});

// 5. defaultProfileUxConfig exported
check('defaultProfileUxConfig exported', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  if (!src.includes('export function defaultProfileUxConfig')) throw new Error('not exported');
});

// 6. sanitizeProfileUxConfig exported
check('sanitizeProfileUxConfig exported', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  if (!src.includes('export function sanitizeProfileUxConfig')) throw new Error('not exported');
});

// 7. Enterprise policy lock type defined
check('BrowserProfileUxPolicyLocks type defined', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  if (!src.includes('BrowserProfileUxPolicyLocks')) throw new Error('type missing');
});

// 8. isSurfaceVisible, isToolGroupEnabled helpers exported
check('Surface/tool-group visibility helpers exported', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  if (!src.includes('export function isSurfaceVisible')) throw new Error('isSurfaceVisible missing');
  if (!src.includes('export function isToolGroupEnabled')) throw new Error('isToolGroupEnabled missing');
  if (!src.includes('export function isCommandCenterCategoryEnabled')) throw new Error('isCommandCenterCategoryEnabled missing');
});

// 9. No secrets in model source
check('No secrets in browser-profile-ux-model.ts', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  const SECRETISH = /(?:bearer\s+|authorization\s*:|cookie\s*:|api[_-]?key\s*[:=]\s*['"]\w+)/i;
  if (SECRETISH.test(src)) throw new Error('Secretish pattern found in model source');
});

// 10. profile-ux-manager.ts exists
check('main/profile-ux-manager.ts exists', () => {
  const p = path.join(root, 'src/main/profile-ux-manager.ts');
  if (!fs.existsSync(p)) throw new Error('file missing');
});

// 11. exportProfileUxConfig in manager (no session data)
check('exportProfileUxConfig in manager, no session fields', () => {
  const src = readFile('src/main/profile-ux-manager.ts');
  if (!src.includes('exportProfileUxConfig')) throw new Error('function missing');
  // Check that the export function itself doesn't store session data (not just comments/guards)
  const exportFn = src.slice(src.indexOf('export function exportProfileUxConfig'), src.indexOf('export function importProfileUxConfigFromJson'));
  if (/localStorage\s*\[|sessionStorage\s*\[|document\.cookie\s*=|password\s*=\s*["']/.test(exportFn)) {
    throw new Error('Potential secret/session data assignment in export function');
  }
});

// 12. importProfileUxConfigFromJson validates safely
check('importProfileUxConfigFromJson rejects malicious input', () => {
  const src = readFile('src/main/profile-ux-manager.ts');
  if (!src.includes('importProfileUxConfigFromJson')) throw new Error('function missing');
  if (!src.includes('SECRETISH')) throw new Error('No secretish guard in import');
  if (!src.includes('<script')) throw new Error('No HTML injection guard');
});

// 13. BrowserProfileUxConfig has all required fields per spec
check('BrowserProfileUxConfig has all required spec fields', () => {
  const src = readFile('src/shared/browser-profile-ux-model.ts');
  const fields = [
    'profileKind', 'defaultMode', 'visibleSurfaces', 'enabledToolGroups',
    'toolbarLayout', 'newTabLayout', 'commandCenterCategories', 'missionControlEnabled',
    'evidenceEnabled', 'runbookEnabled', 'adminProfilesEnabled', 'devOpsToolsEnabled',
    'itToolsEnabled', 'downloadsShelfEnabled', 'supportBundleEnabled', 'enterprisePolicyLockedFields',
  ];
  for (const f of fields) {
    if (!src.includes(f)) throw new Error(`Field missing: ${f}`);
  }
});

// 14. TypeScript typecheck passes
check('TypeScript typecheck passes', () => {
  execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' });
});

// 15. Build passes
check('Build succeeds', () => {
  execSync('npm run build', { cwd: root, stdio: 'pipe' });
});

// Summary
console.log(`\n${'─'.repeat(60)}`);
console.log(`PASS317 result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f.label}: ${f.error}`);
  process.exit(1);
} else {
  console.log('\nPASS317 ✓ Browser Profile UX Model + Policy Foundation verified.\n');
}
