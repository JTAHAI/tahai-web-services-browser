#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const need = (ok, message) => { if (!ok) failures.push(message); };

const required = [
  'package.json',
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/site-view-mission-rail.ts',
  'scripts/verify-pass-168-overlay-open-age-stamp.mjs',
  'docs/pass-168-overlay-open-age-stamp.md',
  'PASS_168_OVERLAY_OPEN_AGE_STAMP_SUMMARY.md'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const pkg = JSON.parse(read('package.json'));
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/app.ts');
  const responsive = read('src/renderer/responsive-toolbar.ts');
  const siteView = read('src/renderer/site-view-mission-rail.ts');
  const release = getReleaseBlockersContract(pkg);

  need(pkg.version === '1.8.30', 'PASS168 must not increment version without explicit approval');
  need(pkg.scripts?.['verify:pass-168-overlay-open-age-stamp'] === 'node scripts/verify-pass-168-overlay-open-age-stamp.mjs', 'package script missing PASS168 verifier');
  need(release.includes('verify:pass-167-overlay-source-safe-close'), 'release blockers must include PASS167 source-safe close gate');
  need(release.includes('verify:pass-168-overlay-open-age-stamp'), 'release blockers must include PASS168 open-age gate');
  need(release.indexOf('verify:pass-167-overlay-source-safe-close') > release.indexOf('verify:pass-166-runtime-css-state-alignment'), 'PASS167 release gate must follow PASS166');
  need(release.indexOf('verify:pass-168-overlay-open-age-stamp') > release.indexOf('verify:pass-167-overlay-source-safe-close'), 'PASS168 release gate must follow PASS167');
  need(release.indexOf('verify:pass-168-overlay-open-age-stamp') < release.lastIndexOf('npm run build'), 'PASS168 release gate must run before final build');

  need(html.includes('data-pass168-overlay-open-age-stamp="true"'), 'renderer body missing PASS168 marker');
  need(app.includes('function pass116MarkActiveChromeOverlay(source: Pass116ChromeOverlaySource'), 'central active-overlay stamp helper missing');
  need(app.includes("document.body.dataset.pass122ActiveOverlayOpenedAt = String(Date.now())"), 'main helper must stamp overlay opened timestamp');
  need(app.includes('document.body.dataset.pass122ActiveOverlayOpenedSource = source'), 'main helper must stamp opened overlay source');
  need(app.includes("document.body.dataset.pass168OverlayOpenAgeStamp = 'true'"), 'main helper/mount must stamp PASS168 runtime marker');
  need(app.includes("pass116MarkActiveChromeOverlay(source, 'local-open')"), 'local open announcement must use age-stamp helper');
  need(app.includes("pass116MarkActiveChromeOverlay(source, 'event-open')"), 'external overlay open event must refresh age stamp');
  need(app.includes("pass116MarkActiveChromeOverlay(keep, 'cycle-keep')"), 'cycle keep path must refresh age stamp for retained overlay');
  need(!app.includes('document.body.dataset.pass116ActiveOverlay = keep;'), 'cycle guard must not restore active overlay without refreshing open-age stamp');

  for (const [name, source, overlay] of [
    ['responsive-toolbar.ts', responsive, 'more-tools'],
    ['site-view-mission-rail.ts', siteView, 'site-view']
  ]) {
    need(source.includes(`document.body.dataset.pass122ActiveOverlayOpenedSource = '${overlay}'`), `${name} must stamp opened overlay source for ${overlay}`);
    need(source.includes('document.body.dataset.pass122ActiveOverlayOpenedAt = String(Date.now())'), `${name} must stamp opened overlay time`);
    need(source.includes("document.body.dataset.pass168OverlayOpenAgeStamp = 'true'"), `${name} must stamp PASS168 marker`);
  }

  const doc = read('docs/pass-168-overlay-open-age-stamp.md');
  const summary = read('PASS_168_OVERLAY_OPEN_AGE_STAMP_SUMMARY.md');
  need(doc.includes('overlay open-age') && doc.includes('More Tools') && doc.includes('Site View'), 'PASS168 doc must describe overlay open-age issue and affected surfaces');
  need(summary.includes('PASS168') && summary.includes('viewport-settle'), 'PASS168 summary must describe viewport-settle fix');
}

if (failures.length) {
  for (const failure of failures) console.error(`[PASS168][FAIL] ${failure}`);
  process.exit(1);
}
console.log('[PASS168][OK] Overlay open-age stamp guard verified.');
