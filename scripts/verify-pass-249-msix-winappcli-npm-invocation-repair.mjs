#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function relPath(rel) { return path.join(root, rel); }
function exists(rel) { return fs.existsSync(relPath(rel)); }
function read(rel) {
  if (!exists(rel)) { failures.push(`Missing ${rel}`); return ''; }
  return fs.readFileSync(relPath(rel), 'utf8');
}
function json(rel) {
  try { return JSON.parse(read(rel)); }
  catch (error) { failures.push(`${rel}: invalid JSON ${error.message}`); return null; }
}
function mustInclude(rel, needle) {
  const content = read(rel);
  if (!content.includes(needle)) failures.push(`${rel}: missing ${needle}`);
}
function mustNotInclude(rel, needle, label = needle) {
  const content = read(rel);
  if (content.includes(needle)) failures.push(`${rel}: must not include ${label}`);
}

const pkg = json('package.json');
if (pkg) {
  const scripts = pkg.scripts || {};
  if (scripts['package:win:msix'] !== 'node scripts/package-win-msix-lane.mjs') failures.push('package.json package:win:msix script drifted');
  if (scripts['verify:pass-249-msix-winappcli-npm-invocation-repair'] !== 'node scripts/verify-pass-249-msix-winappcli-npm-invocation-repair.mjs') failures.push('package.json missing PASS249 verifier script');
  if (scripts['apply:pass-249-msix-winappcli-npm-invocation-repair'] !== 'node scripts/apply-pass249-msix-winappcli-npm-invocation-repair.mjs') failures.push('package.json missing PASS249 apply script');
  if (!String(scripts['verify:release-blockers'] || '').includes('verify:pass-249-msix-winappcli-npm-invocation-repair')) failures.push('verify:release-blockers must include PASS249 verifier');
}

const ps1 = read('packaging/windows/build-windows-msix.ps1');
if (!ps1.trimStart().startsWith('param(')) failures.push('build-windows-msix.ps1 must start with param(');
for (const needle of [
  'Get-Command winapp',
  '@microsoft/winappcli',
  '$npmExecArgs = @("exec", "--yes", "--package", "@microsoft/winappcli", "--", "winapp") + $packArgs',
  '& npm @npmExecArgs',
  'Bare `npx winapp` tries to fetch a non-existent `winapp` package',
  'if ($LASTEXITCODE -ne 0) { Fail "WinApp CLI MSIX pack failed',
  'C:\\dev\\browser\\app'
]) {
  if (!ps1.includes(needle)) failures.push(`build-windows-msix.ps1 missing ${needle}`);
}
for (const forbidden of [
  'npx winapp pack',
  '@("winapp", "pack"',
  '& npx @packArgs',
  '"winapp@"'
]) {
  if (ps1.includes(forbidden)) failures.push(`build-windows-msix.ps1 must not include stale bare-winapp invocation: ${forbidden}`);
}

mustInclude('scripts/verify-pass-247-windows-store-msix-readiness.mjs', '@microsoft/winappcli');
mustInclude('scripts/verify-pass-247-windows-store-msix-readiness.mjs', 'must not use bare npx winapp package lookup');
mustInclude('scripts/verify-pass-247-windows-store-msix-readiness.mjs', '& npm @npmExecArgs');
mustInclude('scripts/verify-pass-248-msix-local-blocker-repair.mjs', '@microsoft/winappcli');
mustInclude('scripts/verify-pass-248-msix-local-blocker-repair.mjs', '& npm @npmExecArgs');
mustInclude('scripts/package-win-msix-lane.mjs', 'build-windows-msix.ps1');
mustInclude('README-PASS249.md', 'PASS249');
mustInclude('docs/pass249-msix-winappcli-npm-invocation-repair.md', '@microsoft/winappcli');
mustInclude('NEXT_CHAT_STARTER.md', 'PASS249');

const textExtensions = new Set(['.md','.txt','.mjs','.js','.ts','.json','.ps1','.xml','.yml','.yaml']);
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(relPath(dir), { withFileTypes: true })) {
    if (['node_modules','dist','release','release-msix','msix-output','artifacts','.git'].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}
for (const rel of walk('.')) {
  if (!textExtensions.has(path.extname(rel).toLowerCase())) continue;
  const buf = fs.readFileSync(relPath(rel));
  if (buf.includes(0x08) || buf.includes(0x07)) failures.push(`${rel}: contains control character from escaped Windows path or regex drift`);
}

if (failures.length) {
  console.error('[PASS249][FAIL] MSIX WinApp CLI npm invocation repair verifier failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS249][OK] MSIX WinApp CLI npm invocation repair verified. Bare npx winapp is removed, installed winapp is preferred, and @microsoft/winappcli npm fallback is wired.');
