#!/usr/bin/env node
/* PASS271-R6 verifier — Popup-As-Tabs Operator Toggle */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pass = 'PASS271_R6';
const failures = [];
const req = (condition, message) => { if (!condition) failures.push(message); };
const file = (rel) => path.join(root, rel);
const text = (rel) => fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : '';
const includes = (rel, needles) => {
  const body = text(rel);
  req(Boolean(body), `missing ${rel}`);
  for (const needle of needles) req(body.includes(needle), `${rel} missing ${needle}`);
  return body;
};

const mainSettings = includes('src/main/settings.ts', [
  'allowPopupsAsTabs: boolean',
  'allowPopupsAsTabs: true',
  'allowPopupsAsTabs: cleanBoolean(rawUi.allowPopupsAsTabs, DEFAULT_BROWSER_SETTINGS.ui.allowPopupsAsTabs)'
]);
const preload = includes('src/preload/preload.ts', ['allowPopupsAsTabs: boolean']);
const fallback = includes('src/renderer/renderer-shell-lifecycle.ts', ['allowPopupsAsTabs: true']);
const html = includes('src/renderer/index.html', [
  'setting-popups-as-tabs',
  'Open popups as new TAHAI tabs',
  'data-pass271-r6-popup-as-tabs="true"',
  'Unsafe popup URLs remain blocked'
]);
const renderer = includes('src/renderer/app.ts', [
  'const settingPopupsAsTabs',
  'settings.ui?.allowPopupsAsTabs !== false',
  'allowPopupsAsTabs: settingPopupsAsTabs.checked',
  'function pass271R6OpenTrustedPopupTab',
  "window.tahaiBrowser.onOpenInTab((url) => pass271R6OpenTrustedPopupTab(url, 'main-process-window-open-handler'))"
]);
const main = includes('src/main/main.ts', [
  'PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE',
  'function pass271R6PopupsAsTabsEnabled',
  'function pass271R6RoutePopupAsTab',
  'readBrowserSettings().ui.allowPopupsAsTabs !== false',
  'const safeUrl = normalizeSafeExternalWindowUrl(url)',
  "sendTrustedRendererEvent(targetWindow, 'tahai-browser:open-in-tab', safeUrl)",
  "return { action: 'deny' }"
]);

req(!/allowpopups\s*=\s*['"]/i.test(renderer + html), 'renderer/html must not set allowpopups attribute');
req(!/setAttribute\(['"]allowpopups['"]/i.test(renderer), 'renderer must not set allowpopups dynamically');
req(/contents\.setWindowOpenHandler\(\(\{ url \}\) => \{[\s\S]*?normalizeSafeExternalWindowUrl\(url\)[\s\S]*?pass271R6RoutePopupAsTab\(contents, safeUrl, 'webview-guest'\)[\s\S]*?return \{ action: 'deny' \}/.test(main), 'webview guest popup handler must sanitize and deny unmanaged popup windows');
req(/window\.webContents\.setWindowOpenHandler\(\(\{ url \}\) => \{[\s\S]*?normalizeSafeExternalWindowUrl\(url\)[\s\S]*?pass271R6RoutePopupAsTab\(window\.webContents, safeUrl, 'browser-window'\)[\s\S]*?return \{ action: 'deny' \}/.test(main), 'BrowserWindow popup handler must sanitize and deny unmanaged popup windows');
const legacyNewWindowBlock = renderer.match(/webview\.addEventListener\('new-window',[\s\S]*?\n  \}\);/);
req(Boolean(legacyNewWindowBlock), 'legacy renderer webview new-window handler missing');
if (legacyNewWindowBlock) req(!legacyNewWindowBlock[0].includes('createTab('), 'legacy renderer webview new-window handler must not directly create popup tabs');

const pkg = JSON.parse(text('package.json') || '{}');
req(pkg.scripts?.['verify:pass-271-r6-popup-as-tabs-operator-toggle'] === 'node scripts/verify-pass271-r6-popup-as-tabs-operator-toggle.mjs', 'package.json missing PASS271-R6 verifier script');
req(fs.existsSync(file('docs/qa/pass271-r6-popup-as-tabs-operator-toggle.md')), 'PASS271-R6 QA doc missing');

const syntaxTargets = [
  'scripts/apply-pass271-r6-popup-as-tabs-operator-toggle.mjs',
  'scripts/verify-pass271-r6-popup-as-tabs-operator-toggle.mjs'
];
for (const target of syntaxTargets) {
  const node = process.execPath;
  const result = spawnSync(node, ['--check', file(target)], { encoding: 'utf8' });
  req(result.status === 0, `syntax check failed for ${target}: ${result.stderr || result.stdout}`);
}

if (failures.length) {
  console.error(`${pass}=FAIL`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`${pass}=PASS`);
console.log(`${pass}_POPUP_MODE=sanitized-main-process-tabs`);
console.log(`${pass}_UNMANAGED_POPUPS=DENIED`);
console.log(`${pass}_ALLOWPOPUPS_ATTRIBUTE=ABSENT`);
