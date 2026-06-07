#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/app.ts',
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/styles/browser.css',
  'src/renderer/styles/responsive-toolbar.css',
  'scripts/verify-pass-166-runtime-css-state-alignment.mjs',
  'docs/pass-166-runtime-css-state-alignment.md',
  'PASS_166_RUNTIME_CSS_STATE_ALIGNMENT_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const appTs = read('src/renderer/app.ts');
  const siteRailTs = read('src/renderer/site-view-mission-rail.ts');
  const browserCss = read('src/renderer/styles/browser.css');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-166-runtime-css-state-alignment.md');
  const summary = read('PASS_166_RUNTIME_CSS_STATE_ALIGNMENT_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);

  need(pkg.version === '1.8.30', 'PASS166 must not increment version without explicit approval');
  need(pkg.scripts?.['verify:pass-166-runtime-css-state-alignment'] === 'node scripts/verify-pass-166-runtime-css-state-alignment.mjs', 'package script missing PASS166 verifier');
  need(releaseBlockers.includes('verify:pass-166-runtime-css-state-alignment'), 'verify:release-blockers missing PASS166 verifier');
  need(releaseBlockers.indexOf('verify:pass-166-runtime-css-state-alignment') > releaseBlockers.indexOf('verify:pass-165-responsive-mission-recipe-hardening'), 'PASS166 verifier must run after PASS165');
  need(releaseBlockers.indexOf('verify:pass-166-runtime-css-state-alignment') < releaseBlockers.lastIndexOf('npm run build'), 'PASS166 verifier must run before final build');
  need(html.includes('data-pass166-runtime-css-state-alignment="true"'), 'renderer body missing PASS166 runtime/CSS alignment marker');

  const cssActiveBodyFlags = [
    'pass113AdaptiveChromeDensity',
    'pass114ChromeStackGuard',
    'pass115OverflowVisibilityGuard',
    'pass116OverlayArbitration',
    'pass117OverlayFocusRecovery',
    'pass118OverlayDismissRecovery',
    'pass119OverlayAriaContract',
    'pass120OverlayPointerBoundary',
    'pass121OverlayScrollContainment',
    'pass122OverlayViewportReflow',
    'pass123OverlayCycleGuard',
    'pass128GuideMissionTriviewHardening',
    'pass163MoreToolsActionDispatch',
    'pass164MoreToolsFirstClickBroker',
    'pass165MoreToolsKnownActionSettle'
  ];

  for (const flag of cssActiveBodyFlags) {
    const trueSet = `document.body.dataset.${flag} = 'true'`;
    need(responsiveTs.includes(trueSet) || appTs.includes(trueSet) || siteRailTs.includes(trueSet), `CSS-active runtime body flag must remain true: ${flag}`);
    const readySet = `document.body.dataset.${flag} = 'ready'`;
    const initializingSet = `document.body.dataset.${flag} = 'initializing'`;
    need(!responsiveTs.includes(readySet) && !appTs.includes(readySet) && !siteRailTs.includes(readySet), `CSS-active runtime body flag must not be overwritten to ready: ${flag}`);
    need(!responsiveTs.includes(initializingSet) && !appTs.includes(initializingSet) && !siteRailTs.includes(initializingSet), `CSS-active runtime body flag must not be overwritten to initializing: ${flag}`);
  }

  for (const token of [
    'body[data-pass113-adaptive-chrome-density="true"] .toolbar-overflow-menu',
    'body[data-pass114-chrome-stack-guard="true"] .toolbar-overflow-menu',
    'body[data-pass115-overflow-visibility-guard="true"] #toolbar-overflow-items > .in-toolbar-overflow',
    'body[data-pass116-overlay-arbitration="true"] .toolbar-overflow-menu',
    'body[data-pass121-overlay-scroll-containment="true"] .toolbar-overflow-menu',
    'body[data-pass122-overlay-viewport-reflow="true"] [data-pass121-scroll-containment="true"]',
    'body[data-pass164-more-tools-first-click-broker] #toolbar-overflow-items > .in-toolbar-overflow',
    'body[data-pass165-more-tools-known-action-settle] .toolbar-overflow-menu',
    'body[data-pass166-runtime-css-state-alignment="true"] .toolbar-overflow-menu'
  ]) need((browserCss + '\n' + responsiveCss).includes(token), `runtime CSS alignment token missing: ${token}`);

  for (const verifier of [
    'scripts/verify-pass-115-overflow-visibility-guard.mjs',
    'scripts/verify-pass-116-overlay-arbitration.mjs',
    'scripts/verify-pass-117-overlay-focus-recovery.mjs',
    'scripts/verify-pass-118-overlay-dismiss-recovery.mjs',
    'scripts/verify-pass-163-more-tools-mission-reflow.mjs',
    'scripts/verify-pass-164-mission-control-open-race.mjs',
    'scripts/verify-pass-165-responsive-mission-recipe-hardening.mjs'
  ]) {
    const source = read(verifier);
    need(!source.includes("document.body.dataset.pass115OverflowVisibilityGuard = 'ready'") || source.includes("dataset.pass115OverflowVisibilityGuard = 'true'"), `${verifier} must not lock PASS115 to ready only`);
    need(!source.includes("document.body.dataset.pass116OverlayArbitration = 'ready'"), `${verifier} must not lock PASS116 to ready only`);
    need(!source.includes("document.body.dataset.pass117OverlayFocusRecovery = 'ready'"), `${verifier} must not lock PASS117 to ready only`);
    need(!source.includes("document.body.dataset.pass118OverlayDismissRecovery = 'ready'"), `${verifier} must not lock PASS118 body CSS marker to ready only`);
    need(!source.includes("document.body.dataset.pass163MoreToolsActionDispatch = 'ready'"), `${verifier} must not lock PASS163 to ready only`);
    need(!source.includes("document.body.dataset.pass164MoreToolsFirstClickBroker = 'ready'"), `${verifier} must not lock PASS164 to ready only`);
    need(!source.includes("document.body.dataset.pass165MoreToolsKnownActionSettle = 'ready'"), `${verifier} must not lock PASS165 to ready only`);
  }

  need(!responsiveTs.includes('ipcRenderer') && !appTs.includes('ipcRenderer') && !siteRailTs.includes('ipcRenderer'), 'PASS166 must not add raw IPC to renderer runtime CSS alignment');
  need(!responsiveTs.includes('shell.openExternal') && !appTs.includes('shell.openExternal'), 'PASS166 must not add external-open behavior');
  need(doc.includes('PASS166') && doc.includes('CSS-active') && doc.includes('More Tools') && doc.includes('Mission Control'), 'PASS166 doc missing scope/rationale');
  need(summary.includes('PASS166') && summary.includes('Version remains `1.8.30`') && summary.includes('Remaining enterprise GA passes: 0'), 'PASS166 summary missing required markers');
}

if (failures.length) {
  console.error('PASS166 Runtime CSS State Alignment verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS166][OK] Runtime CSS state alignment verified: renderer initialization cannot disable compact-window overlay hardening selectors.');
