#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_RELEASE_VERIFY_FAIL=${message}`); process.exit(1); };
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const hasUnsupportedPromptCall = (sourceText) => {
  const sourceFile = ts.createSourceFile('verify-enterprise-release.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'prompt') {
        found = true;
        return;
      }
      if (
        ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === 'window'
        && expression.name.text === 'prompt'
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};
const versionAtLeast = (actual, minimum) => {
  const parse = (v) => String(v).split(/[.-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const a = parse(actual), b = parse(minimum);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
};

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
if (!versionAtLeast(pkg.version, '1.8.12')) fail(`expected version >= 1.8.12, got ${pkg.version}`);
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('package-lock version mismatch');
if (pkg.build?.appId !== 'com.tahai.webservices.browser') fail('wrong appId');
if (pkg.build?.productName !== 'TAHAI Web Services Browser') fail('wrong productName');
if (pkg.homepage !== 'https://browser.tahai.net') fail('wrong homepage');
if (pkg.build?.win?.icon !== 'build/icon.ico') fail('missing Windows icon config');
if (!pkg.build?.asar) fail('asar must be enabled');
if (pkg.build?.compression !== 'maximum') fail('package build compression must be maximum');
if (pkg.build?.publish !== null) fail('package build publish must be null');
if (pkg.build?.removePackageScripts !== true) fail('package build removePackageScripts must be true');
if (pkg.build?.nodeGypRebuild !== false) fail('package build nodeGypRebuild must be false');
if (!pkg.scripts?.['verify:builder-truth']) fail('builder truth verifier script missing');
if (!getReleaseBlockersContract(pkg).includes('verify:builder-truth')) fail('release blockers must include builder truth verifier');

const required = [
  'src/main/main.ts',
  'src/renderer/app.ts',
  'src/renderer/index.html',
  'src/renderer/styles/browser.css',
  'browser/about/index.html',
  'browser/about/offline.html',
  'browser/error-page/index.html',
  'browser/onboarding/index.html',
  'browser/new-tab/index.html',
  'build/icon.ico',
  'build/icon.png',
  'electron-builder.yml',
  'packaging/windows/clean-release-windows.ps1',
  'packaging/windows/build-windows-unpacked-zip.ps1',
  'packaging/windows/build-windows-msi.ps1',
  'scripts/create-friend-feedback-release.ps1',
  'scripts/verify-builder-truth.mjs'
];
for (const rel of required) if (!exists(rel)) fail(`missing required file: ${rel}`);

const builder = read('electron-builder.yml');
for (const token of ['appId: com.tahai.webservices.browser', 'productName: TAHAI Web Services Browser', 'artifactName: TAHAI-Web-Services-Browser-${version}-${arch}.${ext}', 'publish: null', 'asar: true']) {
  if (!builder.includes(token)) fail(`electron-builder truth token missing: ${token}`);
}
if (builder.includes('appId: net.tahai.browser')) fail('stale electron-builder appId remains');
if (builder.includes('buildVersion: 1.1.0')) fail('stale electron-builder buildVersion remains');

const renderer = read('src/renderer/app.ts');
const chromiumBookmarks = read('src/renderer/chromium-bookmarks.ts');
for (const [rel, source] of Object.entries({ 'src/renderer/app.ts': renderer, 'src/renderer/chromium-bookmarks.ts': chromiumBookmarks })) {
  if (hasUnsupportedPromptCall(source)) fail(`unsupported renderer prompt usage remains: ${rel}`);
}

const banned = [
  'PASS29_RUNTIME_MENU_LAYOUT_FIX_START',
  'PASS36_TOOL_MENU_LAYOUT_HARDFIX_START',
  'PASS39_TOOL_MENU_REBUILD_LAYOUT_START',
  'PASS40_SAFE_TOOL_MENU_LAYOUT_START',
  'PASS41_TOOLMENU_OPSPANEL_UI_START',
  'PASS42_CLEAN_FAST_BASELINE_START',
  'PASS43_RELEASE_TOOLCARDS_OPSPANEL_START',
  'PASS44_FULL_OVERLAY_TOOLMENUS_START',
  'tahai-pass44-overlay',
  'replaceChildren(shell)',
  'stashOriginalContent(panel)'
];
for (const token of banned) if (renderer.includes(token)) fail(`stale runtime patch remains: ${token}`);

const html = read('src/renderer/index.html');
for (const id of ['devops-tools','it-tools','ops-hub-toggle','onboarding','about']) if (!html.includes(`id="${id}"`)) fail(`missing shell control ${id}`);
for (const id of ['capture','ops-check','deploy','route-map','dev-audit','ops-guard','devtools','it-card','endpoint','triage','secret-boundary']) {
  const re = new RegExp(`<button id="${id}"[\\s\\S]*?<strong>[\\s\\S]*?</strong>[\\s\\S]*?<kbd>[\\s\\S]*?</kbd>[\\s\\S]*?<span>[\\s\\S]*?</span>[\\s\\S]*?</button>`);
  if (!re.test(html)) fail(`tool card ${id} does not use canonical title/kbd/description markup`);
}

const css = read('src/renderer/styles/browser.css');
for (const token of ['grid-template-columns:minmax(86px,108px) max-content minmax(0,1fr)', '.ops-hub { width:min(780px,calc(100vw - 28px))']) {
  if (!css.includes(token)) fail(`required CSS missing: ${token}`);
}

console.log(`TAHAI_BROWSER_RELEASE_VERIFY=OK version=${pkg.version}`);
process.exit(0);
