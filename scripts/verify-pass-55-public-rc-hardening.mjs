import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file) => readFileSync(file, 'utf8');
const failures = [];
const pkg = JSON.parse(read('package.json'));
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const renderer = read('src/renderer/app.ts');
const html = read('src/renderer/index.html');
const about = read('browser/about/index.html');

for (const generated of ['dist', 'release', 'node_modules', 'artifacts']) {
  if (existsSync(generated)) failures.push(`generated output must not be present in source package: ${generated}/`);
}
for (const file of ['src/main/credential-vault.ts', 'src/shared/credential-boundary.ts']) {
  if (existsSync(file)) failures.push(`credential vault source must be removed from public browser lane: ${file}`);
}
const firstParty = main + preload + renderer + html;
for (const forbidden of ['safeStorage', 'openCredentialVault', 'Credential Manager', 'credential-dialog', 'tahai-browser:list-credentials', 'tahai-browser:save-credential', 'tahai-browser:reveal-credential-password']) {
  if (firstParty.includes(forbidden)) failures.push(`forbidden credential-vault token found: ${forbidden}`);
}
for (const required of ['secret-boundary', 'openSecretBoundary', 'No browser-side vault', 'Secret Boundary']) {
  if (!firstParty.includes(required)) failures.push(`secret boundary replacement missing: ${required}`);
}
const handlers = [...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((match) => ({ channel: match[1], index: match.index ?? 0 }));
for (let i = 0; i < handlers.length; i += 1) {
  const start = handlers[i].index;
  const end = i + 1 < handlers.length ? handlers[i + 1].index : main.indexOf("app.setPath('userData'", start);
  const body = main.slice(start, end > start ? end : start + 800);
  if (!body.includes('assertTrustedBrowserShellIpc(event)')) failures.push(`IPC handler lacks trusted sender guard: ${handlers[i].channel}`);
}
for (const [file, content] of Object.entries({ 'browser/about/index.html': about, 'browser/onboarding/index.html': read('browser/onboarding/index.html'), 'browser/about/offline.html': read('browser/about/offline.html'), 'browser/error-page/index.html': read('browser/error-page/index.html'), 'browser/new-tab/index.html': read('browser/new-tab/index.html') })) {
  if (/<style>|<script>\s*[^<]/i.test(content) || content.includes("'unsafe-inline'")) failures.push(`local page CSP still allows inline code/styles: ${file}`);
}
for (const text of [html, renderer]) {
  for (const visible of ['coming soon', 'stub']) {
    if (text.toLowerCase().includes(visible)) failures.push(`production-visible placeholder remains: ${visible}`);
  }
}
for (const script of ['verify:visual-regression-fixtures', 'verify:pass-55-public-rc-hardening']) {
  if (!pkg.scripts?.[script]) failures.push(`package script missing: ${script}`);
  if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes(script)) failures.push(`release blockers missing: ${script}`);
}
const [majorVersion, minorVersion, patchVersion] = String(pkg.version).split('.').map((part) => Number.parseInt(part, 10));
if (!(majorVersion === 1 && minorVersion === 8 && Number.isFinite(patchVersion) && patchVersion >= 29)) failures.push(`expected package version >= 1.8.29, got ${pkg.version}`);
if (!existsSync('docs/visual-regression-checklist.md')) failures.push('visual regression checklist missing');
if (!existsSync('PASS_55_PUBLIC_RC_HARDENING_SUMMARY.md')) failures.push('PASS55 summary missing');

if (failures.length) {
  console.error('TAHAI_BROWSER_PASS55_PUBLIC_RC_HARDENING_OK=0');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('TAHAI_BROWSER_PASS55_PUBLIC_RC_HARDENING_OK=1');
