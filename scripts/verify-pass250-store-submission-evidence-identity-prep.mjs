#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const pass = 'PASS250';
const requiredFiles = [
  'docs/store/PASS250-microsoft-store-submission-readiness.md',
  'docs/store/PARTNER_CENTER_IDENTITY_PREP.md',
  'docs/store/MICROSOFT_STORE_LISTING_PACKET.md',
  'docs/store/WINDOWS_INSTALLED_SMOKE_EVIDENCE_TEMPLATE.md',
  'docs/store/KNOWN_ISSUES_TRUTH_TEMPLATE.md',
  'docs/store/pass250-store-submission-readiness.template.json',
  'packaging/windows/msix/package-identity.store.example.json',
  'scripts/apply-pass250-store-submission-evidence-identity-prep.mjs',
  'scripts/capture-store-package-evidence.mjs',
  'scripts/init-store-submission-evidence.mjs',
  'scripts/reset-store-submission-evidence-placeholder.mjs',
  'scripts/verify-pass250-store-submission-evidence-identity-prep.mjs',
  'scripts/verify-store-submission-gate.mjs',
  'scripts/create-pass250-full-source-zip.ps1'
];
const requiredScripts = [
  'pass250:apply',
  'store:evidence:capture',
  'store:evidence:init',
  'store:evidence:refresh',
  'store:evidence:reset-placeholder',
  'verify:pass-250-store-submission-evidence-identity-prep',
  'verify:store:submission',
  'source:zip:pass250'
];
const requiredIgnorePatterns = [
  'release/',
  'release-msix/',
  '*.msix',
  '*.msixupload',
  '*.appxupload',
  '*.msi',
  '*.exe',
  '*.pfx',
  '*.cer',
  'release-candidate/generated/'
];
const generatedExts = new Set(['.msi', '.exe', '.msix', '.msixupload', '.appxupload', '.appx', '.pfx', '.p12', '.cer', '.key']);
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'build', 'coverage', '.next']);

function fail(message, details = []) {
  console.error(`${pass}_VERIFY=FAIL`);
  console.error(message);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function readJson(file) {
  return JSON.parse(read(file));
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name) && !rel.startsWith('release-candidate/generated/')) walk(full, results);
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

const missingFiles = requiredFiles.filter((file) => !exists(file));
if (missingFiles.length) fail('PASS250 required files are missing. Overlay the PASS250 patch first.', missingFiles);

let pkg;
try {
  pkg = readJson('package.json');
} catch (error) {
  fail('package.json could not be read or parsed.', [error.message]);
}
const missingScripts = requiredScripts.filter((name) => !pkg.scripts || !pkg.scripts[name]);
if (missingScripts.length) fail('PASS250 package scripts are missing. Run node scripts/apply-pass250-store-submission-evidence-identity-prep.mjs.', missingScripts);
if (getReleaseBlockersContract(pkg) && !getReleaseBlockersContract(pkg).includes('verify:pass-250-store-submission-evidence-identity-prep')) {
  fail('verify:release-blockers does not include the PASS250 verifier. Run the PASS250 apply script.', ['verify:release-blockers']);
}

const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const missingIgnores = requiredIgnorePatterns.filter((pattern) => !gitignore.split(/\r?\n/).some((line) => line.trim() === pattern));
if (missingIgnores.length) fail('Generated package/certificate artifact exclusions are missing from .gitignore.', missingIgnores);

const template = readJson('docs/store/pass250-store-submission-readiness.template.json');
if (template.submissionStatus !== 'BLOCKED') fail('Store readiness template must be fail-closed with submissionStatus BLOCKED.');
for (const section of ['partnerCenterIdentity', 'privacySupport', 'listing', 'packageArtifact', 'installedSmoke', 'automatedInstalledRuntime', 'knownIssues', 'releaseTruth']) {
  if (!template[section]) fail(`Store readiness template missing section: ${section}`);
}
if (!String(template.automatedInstalledRuntime.caveat || '').includes('does not replace the manual Store installed smoke checklist')) {
  fail('Automated installed runtime evidence must not replace the manual Store smoke checklist.', ['automatedInstalledRuntime.caveat']);
}
if (template.releaseTruth.storeSubmissionClaim !== 'blocked-not-submitted') {
  fail('Store readiness template must not claim submission readiness before evidence exists.', ['releaseTruth.storeSubmissionClaim must be blocked-not-submitted']);
}

const identity = readJson('packaging/windows/msix/package-identity.store.example.json');
if (identity.status !== 'PARTNER_CENTER_PENDING') fail('Package identity example must remain Partner Center pending.');
const expectedMsixVersion = `${pkg.version}.0`;
if (identity.version !== expectedMsixVersion) fail('Package identity example version must track the current four-part MSIX version.', [`expected ${expectedMsixVersion}`, `found ${identity.version}`]);
const identityText = JSON.stringify(identity);
if (!identityText.includes('REPLACE_WITH_PARTNER_CENTER')) fail('Package identity example must contain explicit replacement placeholders.');

const captureScript = read('scripts/capture-store-package-evidence.mjs');
for (const phrase of ['storePackageCandidateStatus', 'currentVersionArtifactCount', 'legacyStoreArtifactCount', 'LEGACY_STORE_PACKAGE_ONLY', 'sourceTagReview', 'workingTreeReview']) {
  if (!captureScript.includes(phrase)) fail('Package evidence capture must classify current Store artifacts fail-closed.', [phrase]);
}
const initScript = read('scripts/init-store-submission-evidence.mjs');
for (const phrase of ['BLOCKED_LEGACY_STORE_PACKAGE_ONLY', 'BLOCKED_NO_STORE_PACKAGE_ARTIFACT', 'currentVersionArtifactCount', 'storePackageCandidateStatus', 'workingTreeReview', 'automatedInstalledRuntime', 'document bottom']) {
  if (!initScript.includes(phrase)) fail('Store submission evidence init must preserve current-version package blockers.', [phrase]);
}
const storeGate = read('scripts/verify-store-submission-gate.mjs');
for (const phrase of ['current-version Store package', 'CURRENT_STORE_PACKAGE_FOUND', 'currentVersionArtifactCount', 'sourceTagReview', 'workingTreeReview', 'automatedInstalledRuntime', 'guest viewport', 'document bottom']) {
  if (!storeGate.includes(phrase)) fail('Store submission gate must reject legacy-only package artifacts.', [phrase]);
}

const readinessDoc = read('docs/store/PASS250-microsoft-store-submission-readiness.md');
for (const phrase of ['STORE_SUBMISSION_STATUS: BLOCKED', 'not yet submitted to Microsoft Store', 'not approved by Microsoft Store', 'not public GA']) {
  if (!readinessDoc.includes(phrase)) fail('Readiness doc is missing required release-truth language.', [phrase]);
}

const sourceGenerated = walk(root).filter((rel) => generatedExts.has(path.extname(rel).toLowerCase()));
if (sourceGenerated.length) fail('Generated package/certificate artifacts are present in source-controlled paths.', sourceGenerated.slice(0, 50));

console.log(`${pass}_VERIFY=PASS`);
console.log(`${pass}_STORE_SUBMISSION_STATUS=BLOCKED_UNTIL_REAL_EVIDENCE`);
console.log(`${pass}_FILES_CHECKED=${requiredFiles.length}`);
console.log('NEXT_OPTIONAL=npm run store:evidence:capture');
console.log('NEXT_OPTIONAL=npm run store:evidence:init');
console.log('STORE_GATE=npm run verify:store:submission');
