#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const main = read('src/main/main.ts');
const renderer = read('src/renderer/app.ts');
const contract = read('src/shared/webview-attach-security-contract.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS153, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-153-webview-popup-attach-hardening'] === 'node scripts/verify-pass-153-webview-popup-attach-hardening.mjs', 'package missing PASS153 verifier script');

const pass151Idx = blockers.indexOf('verify:pass-151-enterprise-all-surfaces-release-grade');
const pass152Idx = blockers.indexOf('verify:pass-152-enterprise-evidence-binder');
const pass153Idx = blockers.indexOf('verify:pass-153-webview-popup-attach-hardening');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass151Idx >= 0, 'release blockers missing PASS151');
need(pass152Idx > pass151Idx, 'PASS152 must run after PASS151');
need(pass153Idx > pass152Idx, 'PASS153 must run after PASS152');
need(finalBuildIdx > pass153Idx, 'PASS153 must run before final build');

for (const file of [
  'src/shared/webview-attach-security-contract.ts',
  'scripts/verify-pass-153-webview-popup-attach-hardening.mjs',
  'docs/webview-popup-attach-hardening-pass153.md',
  'PASS_153_WEBVIEW_POPUP_ATTACH_HARDENING_SUMMARY.md'
]) need(exists(file), `missing PASS153 file: ${file}`);

includesAll('src/shared/webview-attach-security-contract.ts', [
  'TAHAI_WEBVIEW_ATTACH_SECURITY_PASS',
  'PASS153',
  'main-process-owned-popup-and-attach-boundary',
  'TAHAI_WEBVIEW_ATTACH_STRIPPED_PARAM_KEYS',
  'allowpopups',
  'nodeintegration',
  'disablewebsecurity',
  'preload',
  'webpreferences',
  'sanitizeTahaiWebviewPartition',
  'isTrustedTahaiWebviewAttachSource',
  'hardenWebviewAttachOptions',
  'webviewAttachSecuritySummary'
]);

includesAll('src/main/main.ts', [
  'will-attach-webview',
  'hardenWebviewAttachOptions',
  'enforcePass153WebviewAttachBoundary',
  'installPass153WebContentsPopupBoundary',
  "contents.setWindowOpenHandler(() => ({ action: 'deny' }))",
  'trustedShellUrls()',
  'TAHAI_WEBVIEW_ATTACH_SECURITY_PASS'
]);

includesAll('src/renderer/app.ts', [
  'pass153PopupBoundary',
  "main-process-owned",
  "webview.addEventListener('new-window'",
  "setStatus('Blocked popup navigation'",
  'normalizeTahaiWebviewPreferences(TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES)'
]);

need(!/setAttribute\(['"]allowpopups['"]/i.test(renderer), 'renderer must not set allowpopups on webviews');
need(!/getAttribute\(['"]allowpopups['"]/i.test(renderer), 'renderer must not treat allowpopups as a falseable policy attribute');
need(!/allowpopups\s*=\s*['"]/i.test(renderer), 'renderer must not template an allowpopups attribute');

const newWindowBlock = renderer.match(/webview\.addEventListener\('new-window',[\s\S]*?\n  \}\);/);
need(Boolean(newWindowBlock), 'renderer new-window denial handler missing');
if (newWindowBlock) need(!newWindowBlock[0].includes('createTab('), 'webview new-window handler must not create tabs from remote popup attempts');

need(!/nodeIntegration\s*:\s*true|nodeIntegration=yes/i.test(`${main}
${renderer}`), 'nodeIntegration must not be enabled');
need(!/contextIsolation\s*:\s*false|contextIsolation=no/i.test(`${main}
${renderer}`), 'contextIsolation must not be disabled');
need(!/webSecurity\s*:\s*false/i.test(`${main}
${renderer}`), 'webSecurity must not be disabled');
need(!/allowRunningInsecureContent\s*:\s*true/i.test(`${main}
${renderer}`), 'allowRunningInsecureContent must not be enabled');
need(!/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(read('src/preload/preload.ts')), 'preload must not expose raw ipcRenderer');

includesAll('docs/webview-popup-attach-hardening-pass153.md', [
  'PASS153',
  'Enterprise WebView Popup/Attach Hardening',
  'boolean attribute',
  'allowpopups',
  'will-attach-webview',
  'default-deny',
  'No generated release artifacts'
]);

includesAll('PASS_153_WEBVIEW_POPUP_ATTACH_HARDENING_SUMMARY.md', [
  'PASS153',
  'webview popup',
  'will-attach-webview',
  'verify:pass-153-webview-popup-attach-hardening',
  'PASS153 runs after PASS152'
]);

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js',
]) need(!exists(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS153][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS153][OK] WebView popup/attach hardening verified.');
