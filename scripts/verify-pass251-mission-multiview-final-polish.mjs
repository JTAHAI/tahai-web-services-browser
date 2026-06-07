#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const marker = 'PASS251_MISSION_MULTIVIEW_FINAL_POLISH_START';
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next']);

function fail(message, details = []) {
  console.error('PASS251_MISSION_MULTIVIEW_FINAL_POLISH=FAIL');
  console.error(message);
  for (const d of details) console.error(`- ${d}`);
  process.exit(1);
}

function walk(dir, matcher, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, acc);
    else if (matcher(full)) acc.push(full);
  }
  return acc;
}

function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found. Run from repo root.');
const pkg = JSON.parse(read(pkgPath));
if (pkg.scripts?.['verify:pass-251-mission-multiview-final-polish'] !== 'node scripts/verify-pass251-mission-multiview-final-polish.mjs') {
  fail('PASS251 package script is missing. Run node scripts/apply-pass251-mission-multiview-final-polish.mjs first.');
}

const cssFiles = walk(root, f => f.endsWith('.css'));
const patched = cssFiles.find(f => read(f).includes(marker));
if (!patched) fail('PASS251 CSS marker not found in a source stylesheet. Run the apply script first.');
const css = read(patched);

const required = [
  'max-height: min(88vh, 980px)',
  'overflow-y: auto',
  'overflow-x: auto',
  'flex-wrap: wrap',
  'min-height: 0',
  'webview',
  'grid-template-columns: 1fr',
];
const missing = required.filter(token => !css.includes(token));
if (missing.length) fail('PASS251 CSS patch is present but incomplete.', missing);

const generatedBad = walk(root, f => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(f) && !/node_modules|release|release-msix|dist|out/.test(rel(f)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS251_MISSION_MULTIVIEW_FINAL_POLISH=PASS');
console.log(`PASS251_CSS_TARGET=${rel(patched)}`);
console.log('PASS251_ASSERTIONS=modal-containment,toolbar-wrap,pane-webview-fill,restored-width-collapse,no-generated-artifacts');
