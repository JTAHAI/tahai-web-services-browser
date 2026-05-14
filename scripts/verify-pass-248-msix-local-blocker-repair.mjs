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
  if (scripts['repair:store-tag:v2.0.0'] !== 'node scripts/repair-store-v2-tag-to-head.mjs') failures.push('package.json missing repair:store-tag:v2.0.0 script');
  if (scripts['verify:pass-248-msix-local-blocker-repair'] !== 'node scripts/verify-pass-248-msix-local-blocker-repair.mjs') failures.push('package.json missing PASS248 verifier script');
  if (!String(scripts['verify:release-blockers'] || '').includes('verify:pass-248-msix-local-blocker-repair')) failures.push('verify:release-blockers must include PASS248 verifier');
}

const ps1 = read('packaging/windows/build-windows-msix.ps1');
if (!ps1.trimStart().startsWith('param(')) failures.push('build-windows-msix.ps1 must start with param( and no stray prefix characters');
if (/^\\\s*param\(/m.test(ps1) || ps1.startsWith('\\')) failures.push('build-windows-msix.ps1 still has stray leading backslash before param');
for (const needle of [
  '& npx @packArgs',
  'if ($LASTEXITCODE -ne 0) { Fail "WinApp CLI MSIX pack failed',
  'if ($LASTEXITCODE -ne 0) { Fail "npm run build failed',
  'if ($LASTEXITCODE -ne 0) { Fail "electron-builder Windows dir build failed',
  'C:\\dev\\browser\\app'
]) if (!ps1.includes(needle)) failures.push(`build-windows-msix.ps1 missing ${needle}`);

mustInclude('scripts/verify-store-git-readiness.mjs', 'npm run repair:store-tag:v2.0.0');
mustInclude('scripts/verify-store-git-readiness.mjs', 'exists but points at');
mustInclude('scripts/repair-store-v2-tag-to-head.mjs', "tagName = 'v2.0.0'");
mustInclude('scripts/repair-store-v2-tag-to-head.mjs', "Working tree is not clean");
mustInclude('scripts/repair-store-v2-tag-to-head.mjs', "tag', '-d', tagName");
mustInclude('scripts/verify-pass-247-windows-store-msix-readiness.mjs', 'build-windows-msix.ps1 must start with param(');
mustInclude('scripts/verify-pass-247-windows-store-msix-readiness.mjs', '& npx @packArgs');
mustInclude('README-PASS248.md', 'PASS248');
mustInclude('docs/pass248-msix-local-blocker-repair.md', 'PowerShell parser blocker');
mustInclude('NEXT_CHAT_STARTER.md', 'PASS248');

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
  console.error('[PASS248][FAIL] MSIX local blocker repair verifier failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS248][OK] MSIX local blocker repair verified. PowerShell parse path, local v2.0.0 tag repair helper, and text-control-character sweep are clean.');
