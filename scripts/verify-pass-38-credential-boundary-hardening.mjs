import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const pkg = JSON.parse(read('package.json'));
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const renderer = read('src/renderer/app.ts');
const html = read('src/renderer/index.html');

for (const removed of ['src/main/credential-vault.ts', 'src/shared/credential-boundary.ts']) {
  if (existsSync(removed)) failures.push(`public browser lane must not ship ${removed}`);
}
for (const token of [
  'safeStorage',
  'listCredentialVaultRecords',
  'saveCredentialVaultRecord',
  'revealCredentialVaultPassword',
  'copyCredentialVaultValue',
  "tahai-browser:list-credentials",
  "tahai-browser:save-credential",
  "tahai-browser:reveal-credential-password",
  'openCredentialVault',
  'credential-dialog',
  'Credential Manager'
]) {
  if ((main + preload + renderer + html).includes(token)) failures.push(`credential vault token still present: ${token}`);
}
for (const token of ['secret-boundary', 'openSecretBoundary', 'No browser-side vault', 'Secret Boundary']) {
  if (!(renderer + html).includes(token)) failures.push(`secret boundary replacement missing: ${token}`);
}
if (!main.includes('assertTrustedBrowserShellIpc')) failures.push('trusted shell IPC guard missing');
if (!String(pkg.scripts?.['verify:pass-38-credential-boundary-hardening'] || '').includes('verify-pass-38-credential-boundary-hardening.mjs')) failures.push('package script missing revised pass38 verifier');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-38-credential-boundary-hardening')) failures.push('pass38 verifier not wired into release blockers');

if (failures.length) {
  console.error('TAHAI_BROWSER_PASS38_SECRET_BOUNDARY_OK=0');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('TAHAI_BROWSER_PASS38_SECRET_BOUNDARY_OK=1');
