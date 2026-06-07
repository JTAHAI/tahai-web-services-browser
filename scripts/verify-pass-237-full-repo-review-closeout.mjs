#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const failures = [];
const read = (rel) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
};
const need = (condition, message) => { if (!condition) failures.push(message); };
const includes = (rel, token, message) => need(read(rel).includes(token), `${rel}: ${message || `missing ${token}`}`);

const pkg = JSON.parse(read('package.json') || '{}');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css');
const next = read('NEXT_CHAT_STARTER.md');

need(fs.existsSync(path.join(root, 'build/icon.ico')), 'build/icon.ico must be present as source packaging input');
need(fs.existsSync(path.join(root, 'build/icon.png')), 'build/icon.png must be present as source packaging input');
need(fs.existsSync(path.join(root, 'assets/brand/tahai-spider-icon.ico')), 'brand ICO source must be present');
need(fs.existsSync(path.join(root, 'assets/brand/tahai-spider-icon.png')), 'brand PNG source must be present');

includes('src/renderer/app.ts', 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION', 'PASS236 marker missing');
includes('src/renderer/app.ts', 'function pass236SafeLoadURL', 'PASS236 safe load wrapper missing');
includes('src/renderer/app.ts', "webview.setAttribute('src', safeTarget)", 'PASS236 must use src assignment');
includes('src/renderer/app.ts', 'pass236IsDomReadyLifecycleError(event.message)', 'PASS236 lifecycle diagnostic capture missing');
includes('src/renderer/app.ts', "from './operator-command-center-v2'", 'PASS204 renderer installer import missing');
includes('src/renderer/app.ts', 'installOperatorCommandCenterV2(() => currentMission)', 'PASS204 renderer installer call missing');
includes('src/renderer/styles/mission-control.css', 'PASS204 — Operator Command Center v2', 'PASS204 CSS marker missing');
includes('docs/pass-237-full-repo-review-closeout.md', 'PASS237', 'PASS237 docs missing marker');

for (const pattern of [
  /\btab\.webview\.loadURL\(/,
  /\bruntimeTab\.webview\.loadURL\(/,
  /\bactiveTab\.webview\.loadURL\(/,
  /\btargetTab\.webview\.loadURL\(/,
  /\bactive\.webview\.loadURL\(/,
  /\bwebview\.loadURL\(/
]) {
  need(!pattern.test(app), `forbidden direct renderer WebView loadURL call remains: ${pattern}`);
}

for (const token of [
  'PASS86 Source Contract Sentinel',
  'PASS87 Operator Recovery Mesh',
  'PASS88 Active Pane Routing Failsafe',
  'PASS109 Release Blocker Continuity Repair',
  'PASS113 verify:pass-113-adaptive-chrome-density',
  'PASS127 — Enterprise Release Readiness Evidence',
  'PASS204 — Operator Command Center v2',
  'PASS236',
  'PASS237'
]) {
  need(next.includes(token), `NEXT_CHAT_STARTER.md missing continuity token: ${token}`);
}

need(pkg.scripts?.['verify:pass-236-dom-ready-direct-loadurl-elimination'] === 'node scripts/verify-pass-236-dom-ready-direct-loadurl-elimination.mjs', 'package.json missing PASS236 verifier script');
need(pkg.scripts?.['verify:pass-237-full-repo-review-closeout'] === 'node scripts/verify-pass-237-full-repo-review-closeout.mjs', 'package.json missing PASS237 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-236-dom-ready-direct-loadurl-elimination'), 'release blockers missing PASS236');
need(getReleaseBlockersContract(pkg).includes('verify:pass-237-full-repo-review-closeout'), 'release blockers missing PASS237');

const forbiddenSourceFiles = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'release', 'artifacts', '.pass-runs'].includes(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(exe|msi|msix|appx|zip|pfx|p12|pem|key)$/i.test(name)) forbiddenSourceFiles.push(rel);
  }
}
walk(root);
need(!forbiddenSourceFiles.length, `generated/secret artifacts found in source tree: ${forbiddenSourceFiles.join(', ')}`);

if (failures.length) {
  console.error('[PASS237][FAIL] Full repo review closeout failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('[PASS237][OK] Full repo review closeout verified: PASS236 DOM-ready fix, build icons, PASS204 install path, and continuity markers are sealed.');
