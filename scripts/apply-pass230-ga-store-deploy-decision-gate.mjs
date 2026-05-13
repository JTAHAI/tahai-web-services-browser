#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS230 — GA / Store Deploy Decision Gate';
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
function appendOnce(rel, marker, block) {
  const current = fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : '';
  if (current.includes(marker)) return;
  const next = `${current}${current.endsWith('\n') || current.length === 0 ? '' : '\n'}${block.trimEnd()}\n`;
  write(rel, next);
}

const requiredPatchFiles = [
  'scripts/render-ga-store-deploy-decision-gate.mjs',
  'scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs',
  'config/ga-store-deploy-decision-gate.example.json',
  'docs/ga-store-deploy-decision-gate.md',
  'docs/qa/pass230-ga-store-deploy-decision-gate.md',
  'README-PASS230.md'
];
[
  'package.json',
  'scripts/package-win-msix-lane.mjs',
  'scripts/render-msix-manifest-readiness.mjs',
  'scripts/render-store-submission-packet.mjs',
  'scripts/verify-pass-229-microsoft-store-listing-submission-packet.mjs',
  'config/msix-store-readiness.example.json',
  'config/msix-manifest.template.xml',
  'config/store-listing-submission-packet.example.json',
  'docs/microsoft-store-listing-submission-packet.md',
  ...requiredPatchFiles
].forEach(mustExist);

const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
pkg.scripts['prepare:ga-store-deploy-decision-gate'] = 'node scripts/render-ga-store-deploy-decision-gate.mjs';
pkg.scripts['verify:pass-230-ga-store-deploy-decision-gate'] = 'node scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs';

const releaseBlockers = pkg.scripts['verify:release-blockers'];
if (typeof releaseBlockers === 'string' && !releaseBlockers.includes('verify:pass-230-ga-store-deploy-decision-gate')) {
  if (releaseBlockers.includes('&& npm run build')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace('&& npm run build', '&& npm run verify:pass-230-ga-store-deploy-decision-gate && npm run build');
  } else {
    pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-230-ga-store-deploy-decision-gate`;
  }
}
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

appendOnce('.gitignore', '# PASS230 GA / Store deploy decision generated artifacts', `
# PASS230 GA / Store deploy decision generated artifacts
ga-store-deploy-decision-generated/
ga-store-deploy-decision-summary.json
store-deploy-decision-output/
production-release-output/
public-ga-generated/
store-review-generated/
`);

console.log(`[PASS230][OK] Applied ${PASS}. Run npm run prepare:ga-store-deploy-decision-gate and npm run verify:pass-230-ga-store-deploy-decision-gate before release-blocker verification.`);
