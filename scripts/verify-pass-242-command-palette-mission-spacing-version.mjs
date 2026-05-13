#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

const pkg = json('package.json');
const lock = json('package-lock.json');
const releaseTruth = read('src/shared/release-truth.ts');
const aboutTruth = json('browser/about/release-truth.json');
const about = read('browser/about/index.html');
const app = read('src/renderer/app.ts');
const browserCss = read('src/renderer/styles/browser.css');
const missionCss = read('src/renderer/styles/mission-control.css');
const summary = read('PASS_242_COMMAND_PALETTE_MISSION_SPACING_VERSION_SUMMARY.md');
const doc = read('docs/pass242-command-palette-mission-spacing-version.md');

need(pkg.version === '1.9.0', `package.json version must be 1.9.0, found ${pkg.version}`);
need(lock.version === '1.9.0', 'package-lock top-level version must be 1.9.0');
need(lock.packages?.['']?.version === '1.9.0', 'package-lock root package version must be 1.9.0');
need(releaseTruth.includes("TAHAI_RELEASE_VERSION = '1.9.0'"), 'release truth must declare 1.9.0');
need(releaseTruth.includes("TAHAI_RELEASE_PASS = 'PASS242'"), 'release truth must declare PASS242');
need(aboutTruth.version === '1.9.0' && aboutTruth.releasePass === 'PASS242', 'about release truth JSON must match 1.9.0/PASS242');
need(about.includes('v1.9.0 public-rc') && about.includes('v1.9.0 / PASS242 responsive modal RC1'), 'about page must show 1.9.0/PASS242 lane');

for (const token of [
  'pass242CommandPaletteIntentionalClose',
  'PASS242_COMMAND_PALETTE_FLASH_GUARD_MS',
  'pass242FocusCommandPaletteInput',
  'pass242ReopenCommandPaletteAfterSpuriousClose',
  'pass242CommandPaletteIdempotentOpen',
  "commandPaletteDialog.addEventListener('cancel'",
]) need(app.includes(token), `app.ts missing ${token}`);

for (const token of [
  'PASS242 — Command Palette maximize stability',
  'contain: layout paint',
  'min-height: 220px',
  '-webkit-line-clamp: 2',
  'grid-template-columns: minmax(0, 1fr) minmax(0, max-content)',
]) need(browserCss.includes(token), `browser.css missing ${token}`);

for (const token of [
  'PASS242 — Mission Control card spacing polish',
  '.mission-command-card strong { -webkit-line-clamp: 2',
  '#mission-recipes .mission-recipe-card',
  '.mission-evidence-v2-diagnostics',
  '.mission-redaction-ux-v2-preview',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
]) need(missionCss.includes(token), `mission-control.css missing ${token}`);

need(summary.includes('PASS242') && summary.includes('1.9.0') && summary.includes('Ctrl+K'), 'PASS242 summary missing markers');
need(doc.includes('PASS242') && doc.includes('1.9.0') && doc.includes('No Microsoft Store/2.0 claim'), 'PASS242 doc missing markers');
need(pkg.scripts?.['verify:pass-242-command-palette-mission-spacing-version'] === 'node scripts/verify-pass-242-command-palette-mission-spacing-version.mjs', 'package missing PASS242 verifier');

if (errors.length) {
  for (const error of errors) console.error(`PASS242_ERROR=${error}`);
  process.exit(1);
}
console.log('PASS242_COMMAND_PALETTE_MISSION_SPACING_VERSION=PASS version=1.9.0');
