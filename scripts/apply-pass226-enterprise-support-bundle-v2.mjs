#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS226 — Enterprise Support Bundle v2';
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
  'src/shared/enterprise-support-bundle-v2-contract.ts',
  'src/shared/enterprise-support-bundle-v2.ts',
  'scripts/verify-pass-226-enterprise-support-bundle-v2.mjs',
  'docs/enterprise-support-bundle-v2.md',
  'docs/qa/pass226-enterprise-support-bundle-v2.md'
];
[
  'package.json',
  ...requiredPatchFiles
].forEach(mustExist);

const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
pkg.scripts['verify:pass-226-enterprise-support-bundle-v2'] = 'node scripts/verify-pass-226-enterprise-support-bundle-v2.mjs';

const releaseBlockers = pkg.scripts['verify:release-blockers'];
if (typeof releaseBlockers === 'string' && !releaseBlockers.includes('verify:pass-226-enterprise-support-bundle-v2')) {
  if (releaseBlockers.includes('&& npm run build')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace('&& npm run build', '&& npm run verify:pass-226-enterprise-support-bundle-v2 && npm run build');
  } else {
    pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-226-enterprise-support-bundle-v2`;
  }
}
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`[PASS226][OK] Applied ${PASS}. Run npm run verify:pass-226-enterprise-support-bundle-v2 before release-blocker verification.`);
