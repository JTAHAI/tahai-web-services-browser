#!/usr/bin/env node
/* Verify PASS266 — Final Version Truth + Store Gate Chain Repair */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS266';
const finalVersion = '2.0.14';
const remainingPassesAfterThisPass = 5;
const oldVersionRegex = /2\.0\.(9|10|11|12|13)/;
const requiredFiles = [
  'scripts/apply-pass266-final-version-truth-store-gate-chain-repair.mjs',
  'scripts/verify-pass266-final-version-truth-store-gate-chain-repair.mjs',
  'scripts/gate-pass266-final-version-truth-store-gate-chain.mjs',
  'docs/store/PASS266-final-version-truth-store-gate-chain-repair.md',
  'docs/store/pass266-final-version-truth-gate-chain-repair.template.json',
  'tests/runtime/pass266-final-version-truth-required-gates.json',
  'PASS266_README.md',
  'PATCH_MANIFEST.json'
];
const scriptVersionFiles = [
  "scripts/gate-pass260-installed-recipe-quad-store-smoke.mjs",
  "scripts/gate-pass261-store-submission-packet.mjs",
  "scripts/gate-pass262-store-asset-evidence-pack.mjs",
  "scripts/gate-pass263-store-listing-copy-truth-pack.mjs",
  "scripts/gate-pass264-store-submission-dry-run-evidence.mjs",
  "scripts/gate-pass265-store-handoff-freeze-operator-approval.mjs",
  "scripts/verify-pass260-installed-recipe-quad-store-smoke-evidence.mjs",
  "scripts/verify-pass261-store-submission-packet-finalizer.mjs",
  "scripts/verify-pass262-store-asset-evidence-pack.mjs",
  "scripts/verify-pass263-store-listing-copy-truth-pack.mjs",
  "scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs",
  "scripts/verify-pass265-store-handoff-freeze-operator-approval.mjs"
];
const jsonVersionFiles = [
  "docs/store/pass260-installed-recipe-quad-smoke-evidence.template.json",
  "docs/store/pass261-store-submission-packet.template.json",
  "docs/store/pass261-store-screenshot-manifest.template.json",
  "docs/store/pass262-store-asset-evidence-pack.template.json",
  "docs/store/pass262-store-listing-image-checklist.template.json",
  "docs/store/pass262-public-url-review.template.json",
  "docs/store/pass263-store-listing-copy.template.json",
  "docs/store/pass263-partner-center-field-map.template.json",
  "docs/store/pass263-copy-claim-review.template.json",
  "docs/store/pass264-store-submission-dry-run-evidence.template.json",
  "docs/store/pass264-store-submission-dry-run-checklist.template.json",
  "docs/store/pass265-store-handoff-freeze-operator-approval.template.json",
  "docs/store/pass265-store-closeout-manifest.template.json",
  "docs/store/pass265-operator-approval-checklist.template.json",
  "tests/runtime/pass260-installed-recipe-quad-smoke-checks.json",
  "tests/runtime/pass262-store-asset-required-slots.json",
  "tests/runtime/pass263-store-listing-claim-rules.json",
  "tests/runtime/pass264-store-submission-dry-run-required-gates.json",
  "tests/runtime/pass265-store-handoff-freeze-required-gates.json"
];
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readText(relPath) { return fs.readFileSync(path.join(root, relPath), 'utf8'); }
function readJson(relPath) { return JSON.parse(readText(relPath)); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0,0,0]; }
function versionLt(a, b) { const x = parseVersion(a), y = parseVersion(b); for (let i=0;i<3;i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; }
function hasFinalVersionString(text) { return text.includes(`'${finalVersion}'`) || text.includes(`"${finalVersion}"`) || text.includes(finalVersion); }
function fail(blockers) {
  console.error('PASS266_FINAL_VERSION_TRUTH_STORE_GATE_CHAIN_REPAIR=FAIL');
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}
const blockers = [];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) blockers.push('Missing required PASS266 file: ' + file);

for (const file of scriptVersionFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { blockers.push('Missing version-chain script: ' + file); continue; }
  const text = fs.readFileSync(full, 'utf8');
  if (!hasFinalVersionString(text)) blockers.push(file + ' does not reference final package version ' + finalVersion + '.');
  if (oldVersionRegex.test(text)) blockers.push(file + ' still contains stale package version target.');
}
for (const file of jsonVersionFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { blockers.push('Missing version-chain JSON: ' + file); continue; }
  let obj;
  try { obj = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (error) { blockers.push(file + ' is invalid JSON: ' + error.message); continue; }
  const strings = collectStrings(obj);
  if (!strings.includes(finalVersion)) blockers.push(file + ' does not contain final package version ' + finalVersion + '.');
  for (const s of strings) if (oldVersionRegex.test(s)) blockers.push(file + ' still contains stale version value: ' + s);
}

if (!blockers.length) {
  const truth = readJson('docs/store/pass266-final-version-truth-gate-chain-repair.template.json');
  if (truth.schemaVersion !== 1 || truth.pass !== pass) blockers.push('PASS266 version truth template metadata invalid.');
  if (truth.versionTarget !== finalVersion || truth.packageVersion !== finalVersion) blockers.push('PASS266 template must target final package version ' + finalVersion + '.');
  if (truth.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('PASS266 template remaining pass count must be ' + remainingPassesAfterThisPass + '.');
  if (truth.releaseTruth?.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('PASS266 template must preserve not-submitted store truth.');
  if (truth.releaseTruth?.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('PASS266 template must preserve not-approved store truth.');
  if (truth.goNoGo?.readyForPartnerCenterSubmission !== false || truth.goNoGo?.readyForPublicGA !== false) blockers.push('PASS266 template must remain fail-closed for Store/GA.');
  if (!Array.isArray(truth.priorEvidenceVersionMatrix) || truth.priorEvidenceVersionMatrix.length !== 6) blockers.push('PASS266 template must include PASS260-PASS265 version matrix.');
  for (const row of truth.priorEvidenceVersionMatrix || []) if (row.packageVersion !== finalVersion) blockers.push('Version matrix row must use final package version: ' + row.pass);
  const matrix = readJson('tests/runtime/pass266-final-version-truth-required-gates.json');
  if (matrix.versionTarget !== finalVersion || matrix.finalPackageVersion !== finalVersion) blockers.push('PASS266 required-gates fixture version mismatch.');
  if (matrix.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('PASS266 required-gates fixture remaining count mismatch.');
}

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (versionLt(pkg.version, finalVersion)) blockers.push('package.json version must be at least ' + finalVersion + '.');
  if (pkg.scripts?.['verify:pass-266-final-version-truth-store-gate-chain-repair'] !== 'node scripts/verify-pass266-final-version-truth-store-gate-chain-repair.mjs') blockers.push('package.json missing PASS266 verifier script.');
  if (pkg.scripts?.['gate:pass-266-final-version-truth-store-gate-chain'] !== 'node scripts/gate-pass266-final-version-truth-store-gate-chain.mjs') blockers.push('package.json missing PASS266 gate script.');
}
if (!blockers.length) {
  const manifest = readJson('PATCH_MANIFEST.json');
  if (!String(manifest.pass || '').includes('PASS266')) blockers.push('PATCH_MANIFEST must identify PASS266.');
  if (manifest.versionTarget !== finalVersion) blockers.push('PATCH_MANIFEST versionTarget must be ' + finalVersion + '.');
  if (manifest.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('PATCH_MANIFEST remainingPassesAfterThisPass must be ' + remainingPassesAfterThisPass + '.');
}

if (blockers.length) fail(blockers);
console.log('PASS266_FINAL_VERSION_TRUTH_STORE_GATE_CHAIN_REPAIR=PASS');
console.log('PASS266_VERSION_TARGET=' + finalVersion);
console.log('PASS266_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS266_STORE_SUBMISSION=not-submitted');
console.log('PASS266_STORE_APPROVAL=not-approved');
