#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const root = process.cwd();
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { if (!exists(rel)) { failures.push(`Missing ${rel}`); return ''; } return fs.readFileSync(path.join(root, rel), 'utf8'); }
function json(rel) { try { return JSON.parse(read(rel)); } catch (e) { failures.push(`${rel}: invalid JSON ${e.message}`); return null; } }
function mustInclude(rel, needle) { if (!read(rel).includes(needle)) failures.push(`${rel}: missing ${needle}`); }

const pkg = json('package.json');
const lock = json('package-lock.json');
const readiness = json('config/msix-store-readiness.example.json');
const listing = json('config/store-listing-submission-packet.example.json');
if (pkg) {
  if (pkg.version !== '2.0.0') failures.push(`package.json version must be 2.0.0; found ${pkg.version}`);
  const scripts = pkg.scripts || {};
  const required = {
    'prepare:win:msix-manifest': 'node scripts/render-msix-manifest-readiness.mjs',
    'prepare:store-submission-packet': 'node scripts/render-store-submission-packet.mjs',
    'package:win:msix': 'node scripts/package-win-msix-lane.mjs',
    'verify:store:git': 'node scripts/verify-store-git-readiness.mjs',
    'verify:pass-247-windows-store-msix-readiness': 'node scripts/verify-pass-247-windows-store-msix-readiness.mjs'
  };
  for (const [k,v] of Object.entries(required)) if (scripts[k] !== v) failures.push(`package.json script ${k} must be ${v}`);
  if (!String(scripts['verify:release-blockers'] || '').includes('verify:pass-247-windows-store-msix-readiness')) failures.push('verify:release-blockers must include PASS247 verifier');
}
if (lock) {
  if (lock.version !== '2.0.0') failures.push(`package-lock root version must be 2.0.0; found ${lock.version}`);
  if (lock.packages?.['']?.version !== '2.0.0') failures.push(`package-lock packages[""].version must be 2.0.0; found ${lock.packages?.['']?.version}`);
}
if (readiness) {
  if (readiness.pass !== 'PASS247') failures.push('msix readiness pass must be PASS247');
  if (readiness.version !== '2.0.0') failures.push('msix readiness version must be 2.0.0');
  if (readiness.storeSubmission?.microsoftStoreSubmissionAllowedBySource !== false) failures.push('source must not allow Store submission by itself');
  if (readiness.storeSubmission?.directDownloadTrustedSigningClaimAllowed !== false) failures.push('source must not allow direct download trusted signing claim');
}
if (listing) {
  if (listing.version !== '2.0.0') failures.push('listing packet version must be 2.0.0');
  if (listing.submissionBlockedBySource !== true) failures.push('listing packet must keep submissionBlockedBySource=true');
}
for (const rel of [
  'src/shared/release-truth.ts',
  'config/msix-manifest.template.xml',
  'packaging/windows/build-windows-msix.ps1',
  'docs/pass247-windows-store-msix-readiness.md',
  'docs/microsoft-store-listing-packet-2.0.0.md',
  'docs/qa/pass247-installed-windows-smoke-before-store.md',
  'scripts/package-win-msix-lane.mjs',
  'scripts/render-msix-manifest-readiness.mjs',
  'scripts/render-store-submission-packet.mjs',
  'scripts/verify-store-git-readiness.mjs'
]) if (!exists(rel)) failures.push(`Missing required PASS247 file ${rel}`);
mustInclude('src/shared/release-truth.ts', "TAHAI_RELEASE_VERSION = '2.0.0'");
mustInclude('config/msix-manifest.template.xml', 'runFullTrust');
mustInclude('config/msix-manifest.template.xml', 'tahai-browser');
mustInclude('packaging/windows/build-windows-msix.ps1', 'npx winapp pack');
mustInclude('docs/pass247-windows-store-msix-readiness.md', 'Store submission remains blocked');
mustInclude('docs/microsoft-store-listing-packet-2.0.0.md', 'TAHAI Web Services Browser 2.0.0');
mustInclude('docs/qa/pass247-installed-windows-smoke-before-store.md', 'installed Windows smoke');
for (const asset of ['Square44x44Logo.png','Square71x71Logo.png','Square150x150Logo.png','Square310x310Logo.png','Wide310x150Logo.png','StoreLogo.png','SplashScreen.png']) if (!exists(`assets/store/windows/${asset}`)) failures.push(`Missing assets/store/windows/${asset}`);
const gitignore = read('.gitignore');
for (const token of ['*.msix','*.msixupload','*.appxupload','*.pfx','PartnerCenter*.json','package-identity.json']) if (!gitignore.includes(token)) failures.push(`.gitignore missing ${token}`);
function walk(dir, out=[]) { if (!exists(dir)) return out; for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { if (['node_modules','dist','release','release-msix','msix-output','artifacts','.git'].includes(e.name)) continue; const rel = path.join(dir,e.name).replace(/\\/g,'/'); if (e.isDirectory()) walk(rel,out); else out.push(rel); } return out; }
const forbiddenPath = /(?:^|\/)(?:.+\.(?:msix|msixbundle|msixupload|appx|appxbundle|appxupload|appinstaller|msixsym|pfx|p12|pem|key|cer|crt|exe|msi|dmg|appimage|rpm|deb)|resources\.pri|Package\.StoreAssociation\.xml|StoreAssociation\.xml|AppxManifest\.xml|Package\.appxmanifest|package-identity\.json|store-identity\.json|PartnerCenter.*\.json|partner-center.*\.json)$/i;
for (const rel of walk('.')) {
  const normalized = rel.replace(/^\.\//,'');
  if (normalized === 'config/msix-manifest.template.xml') continue;
  if (forbiddenPath.test(normalized)) failures.push(`Generated/signing/Store artifact must not be committed: ${normalized}`);
}
const dangerousClaim = /\b(?:submitted to (?:the )?Microsoft Store|Store submission completed|Microsoft Store approved|Store approved|direct-download package is signed|trusted public signed installer|signed MSI|signed EXE|signed MSIX|broad public installer push is approved)\b/i;
const qualifier = /\b(?:not|blocked|until|unless|must not|does not|no |without|future|manual evidence|source-side|placeholder)\b/i;
for (const rel of walk('.')) {
  if (!/\.(md|txt|json|mjs|js|ts|yml|yaml|xml|ps1|css|html)$/i.test(rel)) continue;
  if (/scripts\/verify-pass-/.test(rel)) continue;
  const text = read(rel);
  if (/-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----|PartnerCenterRefreshToken|AZURE_CLIENT_SECRET\s*=|client_secret\s*[:=]/i.test(text)) failures.push(`${rel}: secret-like signing/Partner Center material detected`);
  if (dangerousClaim.test(text) && !qualifier.test(text)) failures.push(`${rel}: possible unsupported Store/signing claim`);
}
if (failures.length) {
  console.error('[PASS247][FAIL] Windows Store/MSIX readiness verifier failed:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('[PASS247][OK] Windows Store/MSIX readiness source gate verified. Store submission remains blocked until installed smoke, Partner Center identity, and package evidence are clean.');
