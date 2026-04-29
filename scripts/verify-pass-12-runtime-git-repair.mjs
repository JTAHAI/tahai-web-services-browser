import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'scripts/repair-electron-install.ps1',
  'scripts/reconnect-github-remote.ps1',
  'docs/pass-12-local-runtime-and-git-repair.md'
];
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`Pass 12 verifier failed. Missing ${file}`);
    process.exit(1);
  }
}

const electronRepair = readFileSync('scripts/repair-electron-install.ps1', 'utf8');
const gitRepair = readFileSync('scripts/reconnect-github-remote.ps1', 'utf8');
const docs = readFileSync('docs/pass-12-local-runtime-and-git-repair.md', 'utf8');
const pkg = readFileSync('package.json', 'utf8');

const requiredMarkers = [
  [electronRepair, 'TAHAI_BROWSER_ELECTRON_REPAIR_OK=1'],
  [electronRepair, 'node_modules\\electron'],
  [electronRepair, 'npm ci'],
  [electronRepair, 'npm run verify:release-blockers'],
  [gitRepair, 'https://github.com/JTAHAI/tahai-web-services-browser.git'],
  [gitRepair, 'git remote set-url origin'],
  [gitRepair, 'git push -u origin'],
  [docs, 'Electron failed to install correctly'],
  [docs, 'reconnect-github-remote.ps1'],
  [pkg, 'verify:pass-12-runtime-git-repair']
];

for (const [content, marker] of requiredMarkers) {
  if (!content.includes(marker)) {
    console.error(`Pass 12 verifier failed. Missing marker: ${marker}`);
    process.exit(1);
  }
}

const forbidden = [/ghp_[A-Za-z0-9_]+/, /github_pat_[A-Za-z0-9_]+/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
for (const pattern of forbidden) {
  if (pattern.test(electronRepair) || pattern.test(gitRepair) || pattern.test(docs)) {
    console.error(`Pass 12 verifier failed. Forbidden secret-like pattern found: ${pattern}`);
    process.exit(1);
  }
}

console.log('Pass 12 runtime/Git repair verifier OK');
