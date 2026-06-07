#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS250';
const requiredScripts = {
  'pass250:apply': 'node scripts/apply-pass250-store-submission-evidence-identity-prep.mjs',
  'store:evidence:capture': 'node scripts/capture-store-package-evidence.mjs',
  'verify:pass-250-store-submission-evidence-identity-prep': 'node scripts/verify-pass250-store-submission-evidence-identity-prep.mjs',
  'verify:store:submission': 'node scripts/verify-store-submission-gate.mjs',
  'source:zip:pass250': 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\create-pass250-full-source-zip.ps1'
};
const releaseBlockerScript = 'npm run verify:pass-250-store-submission-evidence-identity-prep';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensurePackageScripts() {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json not found. Run this script from C:\\dev\\browser\\app.');
  }
  const pkg = readJson(packagePath);
  pkg.scripts = pkg.scripts || {};
  const changes = [];
  for (const [name, command] of Object.entries(requiredScripts)) {
    if (pkg.scripts[name] !== command) {
      pkg.scripts[name] = command;
      changes.push(`script:${name}`);
    }
  }
  if (pkg.scripts['verify:release-blockers'] && !pkg.scripts['verify:release-blockers'].includes('verify:pass-250-store-submission-evidence-identity-prep')) {
    pkg.scripts['verify:release-blockers'] = `${pkg.scripts['verify:release-blockers']} && ${releaseBlockerScript}`;
    changes.push('script:verify:release-blockers');
  }
  writeJson(packagePath, pkg);
  return changes;
}

function ensureGitignore() {
  const gitignorePath = path.join(root, '.gitignore');
  const block = [
    '',
    '# PASS250 Microsoft Store / package-generated artifacts',
    'release/',
    'release-msix/',
    '*.msix',
    '*.msixupload',
    '*.appxupload',
    '*.appx',
    '*.msi',
    '*.exe',
    '*.pfx',
    '*.p12',
    '*.cer',
    '*.key',
    'release-candidate/generated/',
    'release-candidate/store-submission/*.local.json',
    'release-candidate/store-submission/*.generated.json',
    'PartnerCenter*.json',
    'partner-center*.json'
  ];
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const missing = block.filter((line) => line && !line.startsWith('#') && !lines.has(line));
  if (missing.length === 0 && existing.includes('PASS250 Microsoft Store')) {
    return [];
  }
  const suffix = block.filter((line) => line === '' || line.startsWith('#') || missing.includes(line)).join('\n');
  fs.writeFileSync(gitignorePath, `${existing.replace(/\s*$/, '')}\n${suffix}\n`, 'utf8');
  return missing.map((line) => `.gitignore:${line}`);
}

function ensureEvidenceDirectory() {
  const dir = path.join(root, 'release-candidate', 'store-submission');
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `# Store submission evidence\n\nThis directory is for human-reviewed Store submission evidence. Do not commit generated package artifacts, Partner Center credentials, certificates, or private keys. Keep the real evidence file local until it is sanitized for source control.\n`, 'utf8');
    return ['release-candidate/store-submission/README.md'];
  }
  return [];
}

try {
  const changes = [
    ...ensurePackageScripts(),
    ...ensureGitignore(),
    ...ensureEvidenceDirectory()
  ];
  console.log(`${pass}_APPLY=PASS`);
  console.log(`${pass}_CHANGES=${changes.length ? changes.join(',') : 'already-compliant'}`);
  console.log('NEXT_RUN=npm run verify:pass-250-store-submission-evidence-identity-prep');
} catch (error) {
  console.error(`${pass}_APPLY=FAIL`);
  console.error(error.message);
  process.exit(1);
}
