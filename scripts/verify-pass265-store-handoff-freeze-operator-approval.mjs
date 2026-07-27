#!/usr/bin/env node
/* Verify PASS265 Store handoff freeze + operator approval packet source scaffolding. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.18';
const remainingPassesAfterThisPass = 0;
const requiredFiles = [
  'scripts/apply-pass265-store-handoff-freeze-operator-approval.mjs',
  'scripts/verify-pass265-store-handoff-freeze-operator-approval.mjs',
  'scripts/gate-pass265-store-handoff-freeze-operator-approval.mjs',
  'docs/store/pass265-store-handoff-freeze-operator-approval.template.json',
  'docs/store/pass265-store-closeout-manifest.template.json',
  'docs/store/pass265-operator-approval-checklist.template.json',
  'docs/store/PASS265-store-handoff-freeze-operator-approval-packet.md',
  'tests/runtime/pass265-store-handoff-freeze-required-gates.json',
  'PASS265_README.md'
];
const requiredPackageScripts = {
  'verify:pass-265-store-handoff-freeze-operator-approval': 'node scripts/verify-pass265-store-handoff-freeze-operator-approval.mjs',
  'gate:pass-265-store-handoff-freeze-operator-approval': 'node scripts/gate-pass265-store-handoff-freeze-operator-approval.mjs'
};
const prohibitedClaims = ['submitted to microsoft store','microsoft store approved','store approved','store certified','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa api','psa connector included','stores psa tokens','stores provider secrets'];
const allowedTemplateStatuses = ['TEMPLATE_PENDING_REAL_OPERATOR_APPROVAL','TEMPLATE_PENDING_REAL_CLOSEOUT','TEMPLATE_PENDING_OPERATOR_REVIEW'];
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
function fail(blockers) {
  console.error('PASS265_VERIFY=FAIL');
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}
const blockers = [];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) blockers.push('Missing required file: ' + file);

let handoff = null;
const handoffFile = path.join(root, 'docs/store/pass265-store-handoff-freeze-operator-approval.template.json');
if (fs.existsSync(handoffFile)) {
  try { handoff = readJson(handoffFile); } catch (error) { blockers.push('Handoff template is invalid JSON: ' + error.message); }
}
if (handoff) {
  if (handoff.schemaVersion !== 1) blockers.push('Handoff template schemaVersion must be 1.');
  if (handoff.pass !== 'PASS265') blockers.push('Handoff template pass must be PASS265.');
  if (handoff.versionTarget !== targetVersion) blockers.push('Handoff template versionTarget must be ' + targetVersion + '.');
  if (handoff.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('Handoff template remainingPassesAfterThisPass must be 0.');
  if (handoff.status !== 'TEMPLATE_PENDING_REAL_OPERATOR_APPROVAL') blockers.push('Handoff template status must remain TEMPLATE_PENDING_REAL_OPERATOR_APPROVAL.');
  const truth = handoff.storeTruth || {};
  if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('Handoff template must preserve not-submitted truth.');
  if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('Handoff template must preserve not-approved truth.');
  if (truth.handoffFreezeOnly !== true) blockers.push('Handoff template must mark handoffFreezeOnly=true.');
  if (truth.noPartnerCenterSubmitPerformedByThisPass !== true) blockers.push('Handoff template must state no Partner Center submit was performed by this pass.');
  if (!Array.isArray(handoff.priorGateResults) || handoff.priorGateResults.length !== 5) blockers.push('Handoff template must include PASS260-PASS264 priorGateResults.');
  for (const key of ['freezeReview','finalAttestations','operatorApproval','goNoGo']) if (!handoff[key] || typeof handoff[key] !== 'object') blockers.push('Handoff template missing ' + key + '.');
}

for (const jsonFile of ['docs/store/pass265-store-closeout-manifest.template.json','docs/store/pass265-operator-approval-checklist.template.json','tests/runtime/pass265-store-handoff-freeze-required-gates.json']) {
  const file = path.join(root, jsonFile);
  if (!fs.existsSync(file)) continue;
  try {
    const parsed = readJson(file);
    if (parsed.pass !== 'PASS265') blockers.push(jsonFile + ' pass must be PASS265.');
    if (parsed.versionTarget !== targetVersion) blockers.push(jsonFile + ' versionTarget must be ' + targetVersion + '.');
    if (parsed.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push(jsonFile + ' remainingPassesAfterThisPass must be 0.');
    if (parsed.status && !allowedTemplateStatuses.includes(parsed.status)) blockers.push(jsonFile + ' has unexpected template status: ' + parsed.status);
  } catch (error) { blockers.push(jsonFile + ' is invalid JSON: ' + error.message); }
}

const required = path.join(root, 'tests/runtime/pass265-store-handoff-freeze-required-gates.json');
if (fs.existsSync(required)) {
  const parsed = readJson(required);
  if (!Array.isArray(parsed.requiredPriorGates) || parsed.requiredPriorGates.map((g) => g.pass).join(',') !== 'PASS260,PASS261,PASS262,PASS263,PASS264') blockers.push('Required gate fixture must require PASS260-PASS264 in order.');
  if (!Array.isArray(parsed.requiredFreezeBooleans) || parsed.requiredFreezeBooleans.length < 10) blockers.push('Required gate fixture must define freeze booleans.');
  if (!Array.isArray(parsed.requiredFinalAttestations) || parsed.requiredFinalAttestations.length < 5) blockers.push('Required gate fixture must define final attestations.');
}

const packageFile = path.join(root, 'package.json');
if (fs.existsSync(packageFile)) {
  let pkg = null;
  try { pkg = readJson(packageFile); } catch (error) { blockers.push('package.json could not be parsed: ' + error.message); }
  if (pkg) {
    for (const [name, command] of Object.entries(requiredPackageScripts)) if ((pkg.scripts || {})[name] !== command) blockers.push('package.json missing script ' + name + '.');
    const version = String(pkg.version || '');
    const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m || Number(m[1]) < 2 || (Number(m[1]) === 2 && Number(m[2]) === 0 && Number(m[3]) < 14)) blockers.push('package.json version must be at least 2.0.18 after apply.');
  }
}

const sourceScanFiles = requiredFiles.filter((name) => name.endsWith('.json') || name.endsWith('.md'));
const sourceText = sourceScanFiles
  .map((name) => {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) return '';
    if (name.endsWith('.json')) {
      try {
        const parsed = readJson(full);
        delete parsed.prohibitedClaims;
        return JSON.stringify(parsed);
      } catch { return fs.readFileSync(full, 'utf8'); }
    }
    return fs.readFileSync(full, 'utf8');
  })
  .join('\n')
  .toLowerCase();
for (const secretPattern of ['psa_api_key','client_secret','refresh_token','authorization:','cookie:','begin private key','bearer ']) {
  if (sourceText.includes(secretPattern)) blockers.push('Secret-like pattern appears in PASS265 source scaffolding: ' + secretPattern + '.');
}

if (blockers.length) fail(blockers);
console.log('PASS265_VERIFY=PASS');
console.log('PASS265_VERSION_TARGET=' + targetVersion);
console.log('PASS265_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS265_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS265_GATE=gate-pass265-store-handoff-freeze-operator-approval');
