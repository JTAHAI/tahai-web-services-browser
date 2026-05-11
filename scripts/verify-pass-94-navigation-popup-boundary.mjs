#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS94 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/navigation-boundary.ts',[
  'MAX_BROWSER_NAVIGATION_URL_CHARS = 4096',
  "BLOCKED_NAVIGATION_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'ftp:', 'gopher:', 'about:', 'blob:'])",
  'evaluateBrowserNavigationUrl',
  'sanitizeBrowserNavigationUrl',
  'normalizeBrowserNavigationTarget',
  'navigationBoundaryReason',
  'isAllowedExternalNavigationUrl',
  'sanitizeExternalNavigationUrl',
  'Navigation target includes embedded credentials.',
  'Blocked untrusted local file navigation.'
]);
need(/parsed\.username \|\| parsed\.password/.test(boundary),'navigation boundary must block embedded URL credentials');
need(/protocol === 'file:'/.test(boundary) && /trustedLocalMatch/.test(boundary),'navigation boundary must allow only trusted packaged file URLs');
need(/String\(input \?\? ''\)\.length > MAX_BROWSER_NAVIGATION_URL_CHARS/.test(boundary),'navigation boundary must fail closed on overlong URLs');
const renderer=includes('src/renderer/app.ts',[
  "import { normalizeBrowserNavigationTarget, navigationBoundaryReason, sanitizeBrowserNavigationUrl } from '../shared/navigation-boundary'",
  'function browserNavigationSafeUrl',
  'return normalizeBrowserNavigationTarget(raw, {',
  'const updateFromNavigationEvent = (eventUrl: unknown): void => {',
  "setStatus('Blocked unsafe navigation', navigationBoundaryReason(event.url, trustedLocalUrls()))",
  "setStatus('Blocked popup navigation', navigationBoundaryReason(popupUrl || event.url, trustedLocalUrls()))"
]);
need(!/new-window'\, \(event: any\) => \{[\s\S]{0,260}\^https\?:\\\/\\\//.test(renderer),'webview new-window handler must not rely on a raw /^https?:\/\// regex');
need((renderer.match(/browserNavigationSafeUrl\(event\.url\)/g)||[]).length >= 2,'webview will-navigate and new-window paths must both use browserNavigationSafeUrl');
need(renderer.includes('const popupUrl = typeof event.url === \'string\' ? browserNavigationSafeUrl(event.url) : \'\';'),'popup URL must be sanitized before createTab');
const newWindowBlock = renderer.match(/webview\.addEventListener\('new-window',[\s\S]*?\n  \}\);/);
need(Boolean(newWindowBlock), 'webview new-window handler missing');
need(!newWindowBlock[0].includes('createTab('), 'PASS153: popup handler must not create tabs from remote popup attempts');
const safeOpen=includes('src/main/safe-open-external.ts',[
  "import { isAllowedExternalNavigationUrl, sanitizeExternalNavigationUrl } from '../shared/navigation-boundary'",
  'return isAllowedExternalNavigationUrl(value)',
  'const safeUrl = safeExternalUrl(value)',
  'await shell.openExternal(safeUrl)'
]);
const main=includes('src/main/main.ts',[
  'safeExternalUrl as normalizeSafeExternalWindowUrl',
  'const safeUrl = normalizeSafeExternalWindowUrl(url);',
  "if (safeUrl)"
]);
need(
  main.includes("sendTrustedRendererEvent(window, 'tahai-browser:open-in-tab', safeUrl)") ||
  main.includes("window.webContents.send('tahai-browser:open-in-tab', safeUrl)"),
  'BrowserWindow popup handler must send only sanitized safeUrl through the trusted renderer event channel'
);
need(!main.includes("window.webContents.send('tahai-browser:open-in-tab', url)"),'BrowserWindow popup handler must not send raw URL to renderer');
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-94-navigation-popup-boundary']==='node scripts/verify-pass-94-navigation-popup-boundary.mjs','package.json missing PASS94 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-94-navigation-popup-boundary'),'release blockers missing PASS94 verifier');
console.log('PASS94 navigation popup boundary verification passed.');
