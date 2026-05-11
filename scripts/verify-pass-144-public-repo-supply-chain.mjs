#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const fail = (message) => {
  console.error(`PASS144_PUBLIC_REPO_SUPPLY_CHAIN_FAIL=${message}`);
  process.exit(1);
};
const rel = (p) => p.split(path.sep).join('/');
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const requiredFiles = [
  'LICENSE',
  'NOTICE',
  'TRADEMARKS.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SUPPORT.md',
  'README.md',
  '.npmrc',
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/dependabot.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/workflows/validate-source.yml',
  '.github/workflows/supply-chain-guard.yml',
  '.github/workflows/windows-preview-package.yml',
  'docs/known-issues.md',
  'docs/code-signing-policy.md',
  'docs/privacy-policy.md',
  'docs/public-repo-supply-chain-policy.md',
  'docs/public-repo-supply-chain-pass144.md',
  'src/shared/public-repo-supply-chain-contract.ts',
  'scripts/verify-pass-144-public-repo-supply-chain.mjs'
];
for (const file of requiredFiles) {
  if (!exists(file)) fail(`missing_required_file:${file}`);
}

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
if (pkg.version !== '1.8.30') fail(`version_changed:${pkg.version}`);
if (pkg.license !== 'Apache-2.0') fail(`license_changed:${pkg.license}`);
if (pkg.packageManager && !String(pkg.packageManager).startsWith('npm@')) fail(`unexpected_package_manager:${pkg.packageManager}`);
if (!lock.lockfileVersion || lock.lockfileVersion < 3) fail(`lockfile_version_too_old:${lock.lockfileVersion}`);
if (lock.name !== pkg.name) fail('lockfile_name_mismatch');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('lockfile_version_mismatch');

const rootPackage = lock.packages?.[''];
if (!rootPackage) fail('lockfile_missing_root_package');
for (const section of ['dependencies', 'optionalDependencies']) {
  if (pkg[section] && Object.keys(pkg[section]).length) fail(`runtime_dependency_section_not_expected:${section}`);
}
const devDeps = pkg.devDependencies || {};
const lockDevDeps = rootPackage.devDependencies || {};
for (const [name, spec] of Object.entries(devDeps)) {
  if (String(spec).startsWith('^') || String(spec).startsWith('~')) fail(`unpinned_dev_dependency:${name}@${spec}`);
  if (lockDevDeps[name] !== spec) fail(`lock_root_dev_dependency_mismatch:${name}`);
}
for (const key of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly']) {
  if (Object.prototype.hasOwnProperty.call(pkg, key)) fail(`root_lifecycle_script_present:${key}`);
}

const requiredScripts = [
  'build',
  'verify:public-repo',
  'verify:release-blockers',
  'verify:pass-144-public-repo-supply-chain',
  'audit:runtime',
  'audit:buildchain',
  'generate:sbom'
];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) fail(`missing_npm_script:${script}`);
}
if (!pkg.scripts['verify:release-blockers'].includes('verify:pass-144-public-repo-supply-chain')) {
  fail('release_blockers_missing_pass144');
}

const allowedInstallScripts = new Set(['node_modules/electron', 'node_modules/electron-winstaller']);
const blockedResolvedPrefixes = [/^git\+/, /^git:/, /^ssh:/, /^file:/, /^link:/, /^https?:\/\/github\.com\//i];
for (const [lockPath, meta] of Object.entries(lock.packages || {})) {
  if (meta?.hasInstallScript && !allowedInstallScripts.has(lockPath)) fail(`unexpected_dependency_install_script:${lockPath}`);
  if (meta?.resolved && blockedResolvedPrefixes.some((re) => re.test(meta.resolved))) fail(`unsafe_dependency_resolved:${lockPath}`);
}

const gitignore = read('.gitignore');
const requiredGitignorePatterns = [
  'node_modules/',
  'dist/',
  'release/',
  'out/',
  'build-output/',
  'artifacts/',
  '.pass-runs/',
  'profiles/',
  'user-data/',
  '.local-data/',
  'mission-data/',
  'evidence-data/',
  '*.zip',
  '*.exe',
  '*.msi',
  '*.dmg',
  '*.AppImage',
  '*.deb',
  '*.rpm',
  '*.blockmap',
  '.env',
  '.env.*',
  '*.pfx',
  '*.p12',
  '*.pem',
  '*.key',
  'id_rsa',
  'id_ed25519',
  'credential-vault.json',
  'credential-vault*.json',
  '**/credential-vault.json',
  '**/credential-vault*.json'
];
for (const pattern of requiredGitignorePatterns) {
  if (!gitignore.includes(pattern)) fail(`gitignore_missing:${pattern}`);
}

const npmrc = read('.npmrc');
for (const token of ['package-lock=true', 'save-exact=true', 'audit=true', 'fund=false']) {
  if (!npmrc.includes(token)) fail(`npmrc_missing:${token}`);
}

const dependabot = read('.github/dependabot.yml');
for (const token of ['package-ecosystem: "npm"', 'package-ecosystem: "github-actions"', 'supply-chain', 'groups:', 'commit-message:']) {
  if (!dependabot.includes(token)) fail(`dependabot_missing:${token}`);
}

const workflowExpectations = {
  '.github/workflows/validate-source.yml': ['node-version: "22"', 'npm ci', 'npm run verify:release-blockers'],
  '.github/workflows/supply-chain-guard.yml': ['node-version: "22"', 'npm ci --ignore-scripts --no-audit --no-fund', 'npm run verify:pass-144-public-repo-supply-chain'],
  '.github/workflows/windows-preview-package.yml': ['node-version: "22"', 'npm run verify:release-blockers', 'npm run package:win:release']
};
for (const [file, tokens] of Object.entries(workflowExpectations)) {
  const text = read(file);
  for (const token of tokens) if (!text.includes(token)) fail(`workflow_missing:${file}:${token}`);
}

const policy = read('docs/public-repo-supply-chain-policy.md');
for (const token of ['no generated artifacts', 'npm ci', 'Dependabot', 'GitHub Actions', 'SBOM', 'no direct PSA API']) {
  if (!policy.toLowerCase().includes(token.toLowerCase())) fail(`policy_missing:${token}`);
}

const contract = read('src/shared/public-repo-supply-chain-contract.ts');
for (const token of ['PUBLIC_REPO_SUPPLY_CHAIN_PASS', 'REQUIRED_NODE_MAJOR', 'REQUIRED_PUBLIC_REPO_FILES', 'FORBIDDEN_PUBLIC_SOURCE_PATH_PARTS', 'ALLOWED_LOCKFILE_INSTALL_SCRIPT_PACKAGES']) {
  if (!contract.includes(token)) fail(`contract_missing:${token}`);
}

const blockedPathParts = new Set(['.git', 'node_modules', 'dist', 'release', 'out', 'build-output', 'artifacts', '.pass-runs', 'profiles', 'user-data', '.local-data', 'mission-data', 'evidence-data']);
const blockedExts = new Set(['.bak', '.orig', '.tmp', '.pfx', '.p12', '.pem', '.key', '.exe', '.msi', '.dmg', '.appimage', '.deb', '.rpm', '.blockmap', '.zip']);
const scanExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.html', '.css', '.ps1', '.sh', '.txt']);
const secretPatterns = [
  ['private_key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/],
  ['aws_access_key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github_classic_pat', /\bghp_[A-Za-z0-9_]{30,}\b/],
  ['github_fine_grained_pat', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['openai_secret_key', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['slack_token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['raw_cookie_header', /\bCookie:\s+[^\n]+/i],
  ['raw_authorization_header', /\bAuthorization:\s+(?:Bearer|Basic)\s+[^\n]+/i],
  ['psa_secret_assignment', /\b(?:psa[_-]?api[_-]?key|connectwise[_-]?secret|autotask[_-]?secret|halo[_-]?token)\s*[:=]\s*['\"][^'\"]+['\"]/i]
];
const allowSecretPatternFiles = new Set([
  'src/shared/redaction.ts',
  'src/shared/mission-redaction-contract.ts',
  'src/shared/enterprise-support-bundle-contract.ts',
  'scripts/verify-public-repo.mjs',
  'scripts/verify-pass-143-mission-redaction-closeout.mjs',
  'scripts/verify-pass-144-public-repo-supply-chain.mjs',
  'scripts/verify-pass-162-enterprise-ga-decision-gate.mjs',
  'docs/mission-redaction-closeout-pass143.md',
  'docs/mission-tabs-security-spec.md',
  'docs/public-repo-supply-chain-policy.md',
  'docs/public-repo-supply-chain-pass144.md'
]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = rel(path.relative(root, full));
    if (!relative) continue;
    if (entry.isDirectory()) {
      if (blockedPathParts.has(entry.name)) continue;
      walk(full);
      continue;
    }
    const lowerExt = path.extname(entry.name).toLowerCase();
    if (blockedExts.has(lowerExt)) fail(`forbidden_source_file:${relative}`);
    if (!scanExts.has(lowerExt)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const [name, pattern] of secretPatterns) {
      if (pattern.test(text) && !allowSecretPatternFiles.has(relative)) fail(`potential_secret_pattern:${name}:${relative}`);
    }
  }
}
walk(root);

console.log('PASS144_PUBLIC_REPO_SUPPLY_CHAIN=PASS');
process.exit(0);
