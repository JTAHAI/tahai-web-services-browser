export const PUBLIC_REPO_SUPPLY_CHAIN_PASS = 'PASS144' as const;

export const REQUIRED_NODE_MAJOR = 22 as const;

export const REQUIRED_PUBLIC_REPO_FILES = [
  'LICENSE',
  'NOTICE',
  'TRADEMARKS.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SUPPORT.md',
  'README.md',
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/dependabot.yml',
  '.github/workflows/validate-source.yml',
  '.github/workflows/supply-chain-guard.yml',
  '.github/workflows/windows-preview-package.yml',
  'docs/known-issues.md',
  'docs/code-signing-policy.md',
  'docs/privacy-policy.md',
  'docs/public-repo-supply-chain-policy.md',
  'docs/public-repo-supply-chain-pass144.md'
] as const;

export const REQUIRED_GITIGNORE_PATTERNS = [
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
] as const;

export const FORBIDDEN_PUBLIC_SOURCE_PATH_PARTS = [
  '.git',
  'node_modules',
  'dist',
  'release',
  'out',
  'build-output',
  'artifacts',
  '.pass-runs',
  'profiles',
  'user-data',
  '.local-data',
  'mission-data',
  'evidence-data'
] as const;

export const FORBIDDEN_PUBLIC_SOURCE_EXTENSIONS = [
  '.bak',
  '.orig',
  '.tmp',
  '.pfx',
  '.p12',
  '.pem',
  '.key',
  '.exe',
  '.msi',
  '.dmg',
  '.appimage',
  '.deb',
  '.rpm',
  '.blockmap',
  '.zip'
] as const;

export const ALLOWED_LOCKFILE_INSTALL_SCRIPT_PACKAGES = [
  'node_modules/electron',
  'node_modules/electron-winstaller'
] as const;

export const SUPPLY_CHAIN_REQUIRED_NPM_SCRIPTS = [
  'build',
  'verify:public-repo',
  'verify:release-blockers',
  'verify:pass-144-public-repo-supply-chain',
  'audit:runtime',
  'audit:buildchain',
  'generate:sbom'
] as const;
