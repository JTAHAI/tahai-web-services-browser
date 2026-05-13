#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS220 — Privacy and Local Data Inventory';
function file(rel) { return path.join(repo, rel); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) throw new Error(`${PASS}: missing ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function write(rel, content) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), content, 'utf8');
}
function mustExist(rel) {
  if (!fs.existsSync(file(rel))) throw new Error(`${PASS}: missing ${rel}`);
}

const requiredPatchFiles = [
  'src/shared/privacy-local-data-inventory-contract.ts',
  'src/shared/privacy-local-data-inventory.ts',
  'scripts/verify-pass-220-privacy-local-data-inventory.mjs',
  'docs/privacy-local-data-inventory.md',
  'docs/qa/pass220-privacy-local-data-inventory.md'
];
[
  'package.json',
  ...requiredPatchFiles
].forEach(mustExist);

const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
pkg.scripts['verify:pass-220-privacy-local-data-inventory'] = 'node scripts/verify-pass-220-privacy-local-data-inventory.mjs';

const releaseBlockers = pkg.scripts['verify:release-blockers'];
if (typeof releaseBlockers === 'string' && !releaseBlockers.includes('verify:pass-220-privacy-local-data-inventory')) {
  if (releaseBlockers.includes('&& npm run build')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace('&& npm run build', '&& npm run verify:pass-220-privacy-local-data-inventory && npm run build');
  } else {
    pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-220-privacy-local-data-inventory`;
  }
}
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`[PASS220][OK] Applied ${PASS}. Run npm run verify:pass-220-privacy-local-data-inventory before release-blocker verification.`);
