#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => {
  console.error(`TAHAI_BROWSER_UI_ENCODING_VERIFY_FAIL=${message}`);
  process.exit(1);
};

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.json', '.md', '.yml', '.yaml', '.ps1', '.sh', '.txt', '.svg'
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'release', 'out', '.cache']);
const badChars = [0x00e2, 0x00c3, 0x00c2, 0xfffd].map((code) => String.fromCharCode(code));
const encodedBadEscapes = ['c3', 'e2', 'c2'].map((suffix) => '\\u00' + suffix);
const REQUIRED_HTML_TOKENS = [
  '<meta charset="utf-8"',
  './styles/browser.css',
  './styles/chromium-bookmarks.css',
  './app.js',
  './site-view-mission-rail.js',
  './chromium-bookmarks.js',
  '&larr;',
  '&rarr;',
  '&times;',
  '&hellip;',
];
const REQUIRED_CSS_TOKENS = [
  '.chromium-bookmarks-bar',
  '.chromium-bookmarks-menu',
  '.chromium-bookmarks-manager',
  "content: '\\2605';",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const foundBadChar = badChars.find((char) => text.includes(char));
  const foundEscape = encodedBadEscapes.find((token) => text.toLowerCase().includes(token));
  if (foundBadChar || foundEscape) {
    offenders.push(`${rel}: suspicious mojibake marker found`);
  }
}
if (offenders.length) fail(offenders.slice(0, 30).join(' | '));

const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
for (const token of REQUIRED_HTML_TOKENS) {
  if (!html.includes(token)) fail(`index.html missing required token: ${token}`);
}

const css = fs.readFileSync(path.join(root, 'src/renderer/styles/chromium-bookmarks.css'), 'utf8');
for (const token of REQUIRED_CSS_TOKENS) {
  if (!css.includes(token)) fail(`chromium-bookmarks.css missing required token: ${token}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
if (pkg.scripts?.['verify:ui-encoding'] !== 'node scripts/verify-ui-encoding.mjs') {
  fail('package.json missing verify:ui-encoding script');
}
if (!getReleaseBlockersContract(pkg).includes('verify:ui-encoding')) {
  fail('verify:release-blockers does not include verify:ui-encoding');
}
if (badChars.some((char) => String(pkg.build?.copyright || '').includes(char))) {
  fail('package.json copyright contains mojibake');
}

const builder = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8');
if (badChars.some((char) => builder.includes(char))) {
  fail('electron-builder.yml contains mojibake');
}

console.log('TAHAI_BROWSER_UI_ENCODING_VERIFY=OK');
process.exit(0);
