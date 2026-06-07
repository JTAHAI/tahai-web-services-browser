#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const appTs = read('src/renderer/app.ts');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
const html = read('src/renderer/index.html');
const pkg = JSON.parse(read('package.json'));
const releaseBlockers = getReleaseBlockersContract(pkg);

const issues = [];
const need = (condition, message) => { if (!condition) issues.push(message); };

need(html.includes('data-pass171-overlay-focus-epoch-guard="true"'), 'HTML shell must expose PASS171 focus epoch guard marker.');
need(pkg.scripts?.['verify:pass-171-overlay-focus-epoch-guard'] === 'node scripts/verify-pass-171-overlay-focus-epoch-guard.mjs', 'package.json must expose PASS171 verifier.');
need(releaseBlockers.includes('npm run verify:pass-171-overlay-focus-epoch-guard'), 'release blocker chain must include PASS171 verifier.');

need(responsiveTs.includes('let pass171MoreToolsFocusEpoch = 0'), 'More Tools must maintain a focus epoch.');
need(responsiveTs.includes('function pass171BumpMoreToolsFocusEpoch'), 'More Tools must bump focus epoch on open/close.');
need(responsiveTs.includes('const focusEpoch = pass171MoreToolsFocusEpoch'), 'More Tools delayed focus must capture the open epoch.');
need(responsiveTs.includes("focusEpoch !== pass171MoreToolsFocusEpoch"), 'More Tools delayed focus must reject stale epochs.');
need(responsiveTs.includes("document.body.dataset.pass116ActiveOverlay !== 'more-tools'"), 'More Tools delayed focus must verify it is still the active overlay.');
need(responsiveTs.includes("pass171BumpMoreToolsFocusEpoch('open')"), 'More Tools open path must bump focus epoch.');
need(responsiveTs.includes("pass171BumpMoreToolsFocusEpoch('close')"), 'More Tools close path must invalidate pending focus epoch.');
need(responsiveTs.includes("document.body.dataset.pass171OverlayFocusEpochGuard = 'true'"), 'More Tools runtime must stamp PASS171 readiness.');

need(siteViewTs.includes('let pass171SiteViewFocusEpoch = 0'), 'Site View must maintain a focus epoch.');
need(siteViewTs.includes('function pass171BumpSiteViewFocusEpoch'), 'Site View must bump focus epoch on open/close.');
need(siteViewTs.includes('const focusEpoch = pass171SiteViewFocusEpoch'), 'Site View delayed focus must capture the open epoch.');
need(siteViewTs.includes('focusEpoch !== pass171SiteViewFocusEpoch'), 'Site View delayed focus must reject stale epochs.');
need(siteViewTs.includes("document.body.dataset.pass116ActiveOverlay !== 'site-view'"), 'Site View delayed focus must verify active overlay.');
need(siteViewTs.includes("pass171BumpSiteViewFocusEpoch('open')"), 'Site View open path must bump focus epoch.');
need(siteViewTs.includes("pass171BumpSiteViewFocusEpoch('close')"), 'Site View close path must invalidate pending focus epoch.');

need(appTs.includes('let pass171AppOverlayFocusEpoch = 0'), 'App overlay focus must maintain an epoch.');
need(appTs.includes('function pass171BumpAppOverlayFocusEpoch'), 'App overlays must bump focus epoch.');
need(appTs.includes('function pass117FocusFirstIn(scope: HTMLElement, overlaySource: Pass116ChromeOverlaySource)'), 'App delayed focus helper must be source-aware.');
need(appTs.includes('const focusEpoch = pass171AppOverlayFocusEpoch'), 'App delayed focus must capture current epoch.');
need(appTs.includes('focusEpoch !== pass171AppOverlayFocusEpoch'), 'App delayed focus must reject stale epochs.');
need(appTs.includes('pass118ActiveChromeOverlaySource() !== overlaySource'), 'App delayed focus must verify active overlay.');
need(appTs.includes("pass171BumpAppOverlayFocusEpoch('ops-hub', 'open')"), 'Ops Hub open path must bump focus epoch.');
need(appTs.includes("pass117FocusFirstIn(opsHub, 'ops-hub')"), 'Ops Hub focus call must provide overlay source.');
need(appTs.includes("document.body.dataset.pass171OverlayFocusEpochGuard = 'true'"), 'App runtime must stamp PASS171 readiness.');

if (issues.length) {
  console.error('[PASS171][FAIL] Overlay focus epoch guard verification failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}
console.log('[PASS171][OK] Overlay focus epoch guard verified.');
