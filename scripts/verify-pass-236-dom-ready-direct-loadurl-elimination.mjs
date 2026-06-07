#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const repo = process.cwd();
const failures = [];
function file(rel) { return path.join(repo, rel); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}
function parseJson(rel) {
  const text = read(rel);
  try { return JSON.parse(text); }
  catch (error) { failures.push(`${rel}: invalid JSON: ${error.message}`); return {}; }
}
function requireIncludes(rel, needle, message) {
  const text = read(rel);
  if (!text.includes(needle)) failures.push(`${rel}: ${message || `missing ${needle}`}`);
}

const app = read('src/renderer/app.ts');
requireIncludes('src/renderer/app.ts', 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION', 'must include PASS236 lifecycle marker');
requireIncludes('src/renderer/app.ts', 'function pass236SafeLoadURL', 'must define src-first safe load wrapper');
requireIncludes('src/renderer/app.ts', "webview.setAttribute('src', safeTarget)", 'safe load wrapper must use src assignment, not loadURL');
requireIncludes('src/renderer/app.ts', 'pass236MarkWebviewDomPending(webview, tabId);', 'created WebViews must be marked dom-ready pending');
requireIncludes('src/renderer/app.ts', 'pass236MarkWebviewDomReady(webview, tabId);', 'dom-ready event must mark WebViews ready');
requireIncludes('src/renderer/app.ts', 'pass236IsDomReadyLifecycleError(event.message)', 'runtime diagnostic must record exact lifecycle error if it still occurs');
requireIncludes('src/renderer/app.ts', 'pass236RecordDomReadyLifecycle', 'must expose non-secret local diagnostics for the remaining boot error');

const forbidden = [
  /\btab\.webview\.loadURL\(/,
  /\bruntimeTab\.webview\.loadURL\(/,
  /\bactiveTab\.webview\.loadURL\(/,
  /\btargetTab\.webview\.loadURL\(/,
  /\bactive\.webview\.loadURL\(/,
  /\bwebview\.loadURL\(/
];
for (const pattern of forbidden) {
  if (pattern.test(app)) failures.push(`src/renderer/app.ts: forbidden direct renderer WebView loadURL call remains: ${pattern}`);
}

const pkg = parseJson('package.json');
if (pkg.scripts?.['verify:pass-236-dom-ready-direct-loadurl-elimination'] !== 'node scripts/verify-pass-236-dom-ready-direct-loadurl-elimination.mjs') {
  failures.push('package.json: verify:pass-236-dom-ready-direct-loadurl-elimination script missing or incorrect');
}
if (typeof getReleaseBlockersContract(pkg) !== 'string' || !getReleaseBlockersContract(pkg).includes('verify:pass-236-dom-ready-direct-loadurl-elimination')) {
  failures.push('package.json: verify:release-blockers must include PASS236 verifier');
}

requireIncludes('docs/webview-dom-ready-direct-loadurl-elimination.md', 'Direct loadURL Elimination', 'PASS236 docs missing title');
requireIncludes('docs/qa/pass236-dom-ready-direct-loadurl-elimination.md', 'The WebView must be attached to the DOM', 'PASS236 QA must include exact runtime diagnostic');
requireIncludes('README-PASS236.md', 'PASS236', 'README-PASS236 must identify the pass');
requireIncludes('NEXT_CHAT_STARTER.md', 'PASS236', 'NEXT_CHAT_STARTER must hand off PASS236');
requireIncludes('docs/known-issues.md', 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION', 'known issues must include PASS236 marker');

if (failures.length) {
  console.error('[PASS236][FAIL] DOM-ready direct loadURL elimination verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('[PASS236][OK] DOM-ready direct loadURL elimination verified. Renderer fallback navigation no longer calls webview.loadURL directly.');
