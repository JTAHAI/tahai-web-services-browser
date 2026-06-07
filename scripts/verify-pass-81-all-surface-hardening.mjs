#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (message) => {
  console.error(`[PASS81][FAIL] ${message}`);
  process.exit(1);
};
const assertIncludes = (file, needle, label = needle) => {
  const text = read(file);
  if (!text.includes(needle)) fail(`${file} missing ${label}`);
};

assertIncludes('src/renderer/app.ts', 'PASS81 All-Surface Hardening Guard');
assertIncludes('src/renderer/app.ts', 'function pass81RunAllSurfaceDoctor');
assertIncludes('src/renderer/app.ts', 'function pass81MountAllSurfaceGuard');
assertIncludes('src/renderer/app.ts', "id: 'all-surface-doctor'");
assertIncludes('src/renderer/app.ts', "id: 'copy-all-surface-doctor'");
assertIncludes('src/renderer/app.ts', 'Ctrl+Alt+Shift+S');
assertIncludes('src/renderer/app.ts', 'pass81NonPaneDropSurfaceSelectors');
assertIncludes('src/renderer/app.ts', 'application/x-tahai-browser-tab-id');
assertIncludes('src/renderer/app.ts', 'application/x-tahai-mission-pane');
assertIncludes('src/renderer/app.ts', 'scanAndRedact');
assertIncludes('src/renderer/app.ts', 'contextIsolation=yes,nodeIntegration=no,sandbox=yes');
assertIncludes('src/renderer/styles/browser.css', 'PASS81 all-surface hardening guard');
assertIncludes('PASS_81_ALL_SURFACE_HARDENING_SUMMARY.md', 'PASS81');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['verify:pass-81-all-surface-hardening']) fail('package.json missing verify:pass-81-all-surface-hardening script');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-81-all-surface-hardening')) fail('verify:release-blockers does not include PASS81 verifier');

// PASS88 release-blocker hardening: source verifiers may run after npm ci/build.
// Validate exclusion policy instead of falsely failing on local generated directories.
const gitignore = read('.gitignore');
for (const name of ['node_modules/', 'dist/', 'release/']) {
  if (!gitignore.includes(name)) fail(`.gitignore missing generated/runtime directory exclusion: ${name}`);
}

console.log('[PASS81][OK] All-surface hardening guard verified.');
