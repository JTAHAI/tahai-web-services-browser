#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outputDir = path.join(root, 'release-candidate', 'generated', 'store-submission');
const outputPath = path.join(outputDir, 'package-evidence.generated.json');
const packageExtensions = new Set(['.msi', '.exe', '.msix', '.msixupload', '.appxupload']);
const storePackageExtensions = new Set(['.msix', '.msixupload', '.appxupload']);
const scanDirs = ['release', 'release-msix'];

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else if (entry.isFile() && packageExtensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function getPackageJson() {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getGitValue(command) {
  try {
    return execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const pkg = getPackageJson();
const currentVersion = String(pkg.version || '').trim();
const currentMsixVersion = currentVersion ? `${currentVersion}.0` : null;
const artifacts = [];
for (const dir of scanDirs) {
  for (const file of walk(path.join(root, dir))) {
    const stat = fs.statSync(file);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    artifacts.push({
      path: rel,
      fileName: path.basename(file),
      extension: path.extname(file).toLowerCase(),
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
      sha256: sha256(file)
    });
  }
}

function isStorePackage(artifact) {
  return storePackageExtensions.has(String(artifact.extension || '').toLowerCase());
}

function isCurrentVersionArtifact(artifact) {
  const haystack = `${artifact.fileName || ''} ${artifact.path || ''}`;
  return Boolean(currentVersion && haystack.includes(currentVersion)) || Boolean(currentMsixVersion && haystack.includes(currentMsixVersion));
}

function getStorePackageCandidateStatus(storeArtifacts, currentArtifacts) {
  if (currentArtifacts.length) return 'CURRENT_STORE_PACKAGE_FOUND';
  if (storeArtifacts.length) return 'LEGACY_STORE_PACKAGE_ONLY';
  return 'NO_STORE_PACKAGE_ARTIFACT_FOUND';
}

function getSourceTagReview(sourceTag) {
  if (!currentVersion) return 'PACKAGE_JSON_VERSION_MISSING';
  if (!sourceTag) return 'NO_EXACT_SOURCE_TAG_AT_HEAD';
  if (sourceTag === currentVersion || sourceTag === `v${currentVersion}`) return 'MATCHES_PACKAGE_JSON_VERSION';
  return 'SOURCE_TAG_MISMATCH_CURRENT_VERSION';
}

function getWorkingTreeReview(status) {
  return String(status || '').trim() ? 'DIRTY_WORKING_TREE_REVIEW_REQUIRED' : 'CLEAN_WORKING_TREE';
}

const storeArtifacts = artifacts.filter(isStorePackage);
const currentVersionStoreArtifacts = storeArtifacts.filter(isCurrentVersionArtifact);
const legacyStoreArtifacts = storeArtifacts.filter((artifact) => !isCurrentVersionArtifact(artifact));
const sourceCommit = getGitValue('git rev-parse HEAD');
const sourceTag = getGitValue('git describe --tags --exact-match HEAD');
const workingTreeStatus = getGitValue('git status --short');
const storePackageCandidateStatus = getStorePackageCandidateStatus(storeArtifacts, currentVersionStoreArtifacts);
const evidence = {
  schemaVersion: 1,
  generatedBy: 'scripts/capture-store-package-evidence.mjs',
  generatedAt: new Date().toISOString(),
  product: pkg.productName || 'TAHAI Web Services Browser',
  packageName: pkg.name || null,
  version: currentVersion || null,
  msixVersion: currentMsixVersion,
  sourceCommit,
  sourceTag,
  sourceTagReview: getSourceTagReview(sourceTag),
  workingTreeStatus,
  workingTreeReview: getWorkingTreeReview(workingTreeStatus),
  artifactCount: artifacts.length,
  storeArtifactCount: storeArtifacts.length,
  currentVersionArtifactCount: currentVersionStoreArtifacts.length,
  legacyStoreArtifactCount: legacyStoreArtifacts.length,
  storePackageCandidateStatus,
  artifacts,
  currentVersionArtifactCandidates: currentVersionStoreArtifacts,
  legacyVersionArtifactCandidates: legacyStoreArtifacts,
  submissionReadiness: storePackageCandidateStatus === 'CURRENT_STORE_PACKAGE_FOUND'
    ? 'CURRENT_STORE_PACKAGE_CAPTURED_REVIEW_REQUIRED'
    : storePackageCandidateStatus,
  directInstallerTruth: 'MSI/EXE artifacts remain unsigned-preview unless a trusted signing path is added.'
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log('PASS250_PACKAGE_EVIDENCE_CAPTURE=PASS');
console.log(`PASS250_PACKAGE_EVIDENCE_PATH=${path.relative(root, outputPath).replace(/\\/g, '/')}`);
console.log(`PASS250_PACKAGE_ARTIFACT_COUNT=${artifacts.length}`);
console.log(`PASS250_STORE_PACKAGE_STATUS=${storePackageCandidateStatus}`);
console.log(`PASS250_CURRENT_VERSION_ARTIFACT_COUNT=${currentVersionStoreArtifacts.length}`);
if (artifacts.length === 0) {
  console.log('PASS250_PACKAGE_EVIDENCE_NOTE=No package artifacts found under release/ or release-msix/. Build MSI/MSIX locally and rerun.');
} else if (storePackageCandidateStatus === 'LEGACY_STORE_PACKAGE_ONLY') {
  console.log(`PASS250_PACKAGE_EVIDENCE_NOTE=Store artifacts exist, but none match current version ${currentVersion}/${currentMsixVersion}. Build the current MSIX/MSIXUPLOAD and rerun.`);
}
